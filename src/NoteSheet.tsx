import { useEffect, useState } from "react";
import { ApiError, api, delete_, post } from "./api";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { UserRow } from "./UserRow";
import { useTap } from "./useTap";
import type { NoteDetail } from "./types";

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : "通信に失敗しました。");

// 残りの時間を「あと◯時間」「あと◯分」で出す
const remainingText = (expiresAt: string) => {
  const minutes = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 60_000));
  if (minutes >= 60) return `あと${Math.floor(minutes / 60)}時間`;
  return `あと${minutes}分`;
};

const clockOf = (iso: string) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

// ノートの詳細。本文をダブルタップでいいね、下でコメントできる。投稿者は「いいねした人」も見られる
export function NoteSheet({ noteId, onClose }: { noteId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<NoteDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [burst, setBurst] = useState(0);

  const load = () =>
    api<NoteDetail>(`/api/notes/${noteId}`)
      .then((next) => {
        setDetail(next);
        setFailed(false);
      })
      .catch(() => setFailed(true));

  useEffect(() => {
    void load();
  }, [noteId]);

  // いいね・取り消し。先に画面を変え、失敗したら戻す
  const setLike = async (want: boolean) => {
    if (!detail || detail.isMine || detail.likedByMe === want) return;
    setError("");
    const delta = want ? 1 : -1;
    setDetail({ ...detail, likedByMe: want, likeCount: detail.likeCount + delta });
    try {
      await api(`/api/notes/${noteId}/like`, want ? post() : delete_());
      await load();
    } catch (err) {
      setDetail((d) => (d ? { ...d, likedByMe: !want, likeCount: d.likeCount - delta } : d));
      setError(messageOf(err));
    }
  };

  // 本文をダブルタップ（ダブルクリック）：いいね。すでにいいね済みならハートだけ出す
  const tapCard = useTap(undefined, () => {
    setBurst((n) => n + 1);
    void setLike(true);
  });

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/notes/${noteId}/comments`, post({ body }));
      setText("");
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const removeComment = async (id: string) => {
    setError("");
    try {
      await api(`/api/notes/comments/${id}`, delete_());
      await load();
    } catch (err) {
      setError(messageOf(err));
    }
  };

  return (
    <div className="page note-page" role="dialog" aria-label="ノート">
      <header className="page-bar">
        <button onClick={onClose} aria-label="戻る">
          <Icon name="back" size={26} />
        </button>
        <strong>ノート</strong>
        <span />
      </header>

      {!detail && !failed && <p className="notice center">読み込み中…</p>}
      {failed && <p className="notice center error">ノートを読み込めませんでした。期限が切れたか、見られないノートです。</p>}

      {detail && (
        <>
          <div className="note-owner">
            <Avatar userId={detail.owner.id} hasAvatar={detail.owner.hasAvatar} name={detail.owner.displayName} size={48} />
            <span className="row-text">
              <strong>{detail.owner.displayName}</strong>
              <small>
                @{detail.owner.username} ・ {remainingText(detail.expiresAt)}
              </small>
            </span>
          </div>

          <div className="note-card" onClick={(e) => tapCard(e)} role="presentation">
            <p className="note-card-body">{detail.body}</p>
            {burst > 0 && (
              <span key={burst} className="note-heart big" aria-hidden="true">
                ♥
              </span>
            )}
          </div>
          <p className="muted small center note-hint">{detail.isMine ? "" : "本文を2回押すといいねできます"}</p>

          <div className="note-actions">
            {detail.isMine ? (
              <span className="muted">いいね {detail.likeCount}件</span>
            ) : (
              <button className={`pill ${detail.likedByMe ? "primary" : ""}`} onClick={() => void setLike(!detail.likedByMe)}>
                ♥ {detail.likedByMe ? "いいね済み" : "いいね"}
                {detail.likeCount > 0 && <span className="note-count"> {detail.likeCount}</span>}
              </button>
            )}
          </div>

          {detail.isMine && detail.likers && (
            <>
              <div className="section-label">
                <span>いいねした人</span>
                <span className="section-count">{detail.likers.length}</span>
              </div>
              <ul className="user-list-ul">
                {detail.likers.map((l, i) => (
                  <UserRow key={l.id} index={i} userId={l.id} hasAvatar={l.hasAvatar} name={l.displayName} sub={`@${l.username} ・ ${clockOf(l.likedAt)}`} />
                ))}
              </ul>
              {detail.likers.length === 0 && <p className="muted center pad">まだいいねはありません。</p>}
            </>
          )}

          <div className="section-label">
            <span>コメント</span>
            <span className="section-count">{detail.comments.length}</span>
          </div>
          <ul className="note-comments">
            {detail.comments.map((c) => (
              <li key={c.id} className="note-comment">
                <Avatar userId={c.author.id} hasAvatar={c.author.hasAvatar} name={c.author.displayName} size={34} />
                <div className="note-comment-body">
                  <div className="note-comment-head">
                    <strong>{c.author.displayName}</strong>
                    <small>{clockOf(c.createdAt)}</small>
                  </div>
                  <p>{c.body}</p>
                </div>
                {c.canDelete && (
                  <button className="btn-text danger note-comment-del" onClick={() => void removeComment(c.id)}>
                    削除
                  </button>
                )}
              </li>
            ))}
          </ul>
          {detail.comments.length === 0 && <p className="muted center pad">まだコメントはありません。</p>}

          <div className="note-compose">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              maxLength={200}
              placeholder="コメントを書く"
              aria-label="コメント"
            />
            <button className="btn-small accent" disabled={busy || !text.trim()} onClick={() => void send()}>
              送信
            </button>
          </div>
          {error && <p className="notice center error">{error}</p>}
        </>
      )}
      {!detail && error && <p className="notice center error">{error}</p>}
    </div>
  );
}
