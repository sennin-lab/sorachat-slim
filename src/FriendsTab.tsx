import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api, delete_, post } from "./api";
import { cachedFriends, saveFriends, syncAvatars } from "./avatarCache";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { NoteSheet } from "./NoteSheet";
import { NoteStrip } from "./NoteStrip";
import { NOTE_PREFS_EVENT, getNoteStrip } from "./notePrefs";
import { UserRow } from "./UserRow";
import type { Friend, Me } from "./types";

type Requests = { incoming: Friend[]; outgoing: Friend[] };

// 期限の内にあるノート（切れていれば null）
const liveNote = (f: Friend) => (f.note && Date.parse(f.note.expiresAt) > Date.now() ? f.note : null);

// 「友だち」タブ：フレンドリクエスト（届いた分・送信中の分）、自分のプロフィール、友だち一覧
export function FriendsTab({
  me,
  onOpenMe,
  onOpenUser,
  onAdd,
  version = 0
}: {
  me: Me;
  onOpenMe: () => void;
  onOpenUser: (id: string) => void;
  onAdd: () => void;
  version?: number;
}) {
  // 保存済みの一覧があれば、データベースを待たずにすぐ表示する
  const [items, setItems] = useState<Friend[] | null>(() => {
    const saved = cachedFriends();
    return saved.length ? saved : null;
  });
  const [requests, setRequests] = useState<Requests>({ incoming: [], outgoing: [] });
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [reload, setReload] = useState(0);
  // 詳細を開いているノート
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  // ノートの帯を出すか（設定。既定はオフ）
  const [noteOn, setNoteOn] = useState(getNoteStrip);
  useEffect(() => {
    const sync = () => setNoteOn(getNoteStrip());
    window.addEventListener(NOTE_PREFS_EVENT, sync);
    return () => window.removeEventListener(NOTE_PREFS_EVENT, sync);
  }, []);

  useEffect(() => {
    api<Friend[]>("/api/friends")
      .then((next) => {
        setItems(next);
        setError("");
        saveFriends(next);
        void syncAvatars([{ id: me.id, hasAvatar: me.hasAvatar, avatarVersion: me.avatarVersion }, ...next], { local: true });
      })
      .catch(() => setError("友だちを読み込めませんでした。"));
    api<Requests>("/api/friends/requests")
      .then(setRequests)
      .catch(() => undefined);
  }, [version, reload]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!items) return [];
    if (!q) return items;
    return items.filter((f) => f.displayName.toLowerCase().includes(q) || f.username.includes(q));
  }, [items, query]);

  // 届いた申請を許可・拒否する
  const answer = async (userId: string, accept: boolean) => {
    setBusy(userId);
    setError("");
    try {
      await api(`/api/friends/requests/${userId}/${accept ? "accept" : "decline"}`, post());
      setReload((n) => n + 1);
    } catch {
      setError("通信に失敗しました。もう一度お試しください。");
    } finally {
      setBusy("");
    }
  };

  // こちらが送った申請を取り消す
  const cancel = async (userId: string) => {
    setBusy(userId);
    setError("");
    try {
      await api(`/api/friends/requests/${userId}`, delete_());
      setReload((n) => n + 1);
    } catch {
      setError("通信に失敗しました。もう一度お試しください。");
    } finally {
      setBusy("");
    }
  };

  // ノートをダブルタップしたとき、そのままいいねする（詳細を開かずに反応できる）
  const likeNote = async (noteId: string) => {
    try {
      await api(`/api/notes/${noteId}/like`, post());
    } catch {
      setError("いいねできませんでした。もう一度お試しください。");
    }
  };

  return (
    <div className="tab-panel" key="friends">
      <header className="tab-head">
        <strong className="tab-title">友だち</strong>
        <button className="icon-btn" onClick={onAdd} aria-label="友だちを追加">
          <Icon name="userPlus" size={24} />
        </button>
      </header>

      <div className="search-bar">
        <label className="search-field">
          <Icon name="search" size={16} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="検索" aria-label="友だちを検索" />
        </label>
      </div>

      {noteOn && <NoteStrip me={me} version={version} onOpenMe={onOpenMe} onOpenUser={onOpenUser} />}

      <ul className="user-list-ul">
        <li className="user-li" style={{ "--i": 0 } as CSSProperties}>
          <button className="user-row me-row" onClick={onOpenMe}>
            <Avatar userId={me.id} hasAvatar={me.hasAvatar} name={me.displayName} size={50} />
            <span className="row-text">
              <strong>{me.displayName}</strong>
              <small>{me.bio || "ステータスメッセージを設定しよう"}</small>
            </span>
          </button>
        </li>
      </ul>

      {requests.incoming.length > 0 && (
        <>
          <div className="section-label">
            <span>フレンドリクエスト</span>
            <span className="section-count">{requests.incoming.length}</span>
          </div>
          <ul className="user-list-ul">
            {requests.incoming.map((f, i) => (
              <UserRow
                key={`in-${f.id}`}
                index={i}
                userId={f.id}
                hasAvatar={f.hasAvatar}
                name={f.displayName}
                sub={`@${f.username}`}
                right={
                  <span className="request-actions">
                    <button className="btn-small" disabled={busy === f.id} onClick={() => void answer(f.id, false)}>
                      拒否
                    </button>
                    <button className="btn-small accent" disabled={busy === f.id} onClick={() => void answer(f.id, true)}>
                      許可
                    </button>
                  </span>
                }
                onClick={() => onOpenUser(f.id)}
              />
            ))}
          </ul>
        </>
      )}

      {requests.outgoing.length > 0 && (
        <>
          <div className="section-label">
            <span>申請中</span>
            <span className="section-count">{requests.outgoing.length}</span>
          </div>
          <ul className="user-list-ul">
            {requests.outgoing.map((f, i) => (
              <UserRow
                key={`out-${f.id}`}
                index={i}
                userId={f.id}
                hasAvatar={f.hasAvatar}
                name={f.displayName}
                sub={`@${f.username}`}
                right={
                  <button className="btn-small" disabled={busy === f.id} onClick={() => void cancel(f.id)}>
                    取り消す
                  </button>
                }
              />
            ))}
          </ul>
        </>
      )}

      {items && (
        <div className="section-label">
          <span>友だち</span>
          <span className="section-count">{items.length}</span>
        </div>
      )}

      {error && <p className="notice error center">{error}</p>}

      {items && !items.length && (
        <div className="tab-empty">
          <p>まだ友だちがいません。</p>
          <button className="btn-primary" onClick={onAdd}>
            友だちを追加
          </button>
        </div>
      )}

      {items && items.length > 0 && !shown.length && <p className="muted center pad">見つかりませんでした。</p>}

      {shown.length > 0 && (
        <ul className="user-list-ul">
          {shown.map((f, i) => (
            <UserRow
              key={f.id}
              index={i + 1}
              userId={f.id}
              hasAvatar={f.hasAvatar}
              name={f.displayName}
              sub={f.bio || `@${f.username}`}
              note={noteOn ? liveNote(f) : null}
              onNoteOpen={() => {
                const n = liveNote(f);
                if (n) setOpenNoteId(n.id);
              }}
              onNoteLike={() => {
                const n = liveNote(f);
                if (n) void likeNote(n.id);
              }}
              onClick={() => onOpenUser(f.id)}
            />
          ))}
        </ul>
      )}

      {openNoteId && <NoteSheet noteId={openNoteId} onClose={() => setOpenNoteId(null)} />}

      {!items && !error && (
        <ul className="skeleton-list" aria-label="読み込み中">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="skeleton-row" />
          ))}
        </ul>
      )}
    </div>
  );
}
