import { useEffect, useState } from "react";
import { api, put } from "./api";
import { Avatar } from "./Avatar";
import { Cover } from "./Cover";
import { Icon } from "./Icon";
import { makeQrImage, profileQrValue } from "./qr";
import { NoteSheet } from "./NoteSheet";
import { ProfileEditSheet } from "./ProfileEditSheet";
import { SettingsSheet } from "./SettingsSheet";
import type { Me } from "./types";

type Note = { id: string; body: string; expiresAt: string } | null;

// 自分のプロフィール（見るだけの画面）。編集はプロフィール設定ページ（ProfileEditSheet）で行う
export function ProfileSheet({
  me,
  theme,
  onThemeChange,
  onClose,
  onChange,
  onLogout
}: {
  me: Me;
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  onClose: () => void;
  onChange: (me: Me) => void;
  onLogout: () => void;
}) {
  const [showEdit, setShowEdit] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [qrImage, setQrImage] = useState("");
  const [note, setNote] = useState<Note>(null);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  // 自分のノートの「いいね・コメント」を開いているときのノートID
  const [viewNoteId, setViewNoteId] = useState<string | null>(null);

  useEffect(() => {
    api<Note>("/api/me/note").then(setNote).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (showQr) makeQrImage(profileQrValue(me.username)).then(setQrImage).catch(() => setQrImage(""));
  }, [showQr, me.username]);

  const saveNote = async () => {
    setBusy(true);
    setStatus("");
    try {
      const body = (noteDraft ?? "").trim();
      if (!body) {
        await api("/api/me/note", { method: "DELETE" });
        setNote(null);
      } else {
        setNote(await api<Note>("/api/me/note", put({ body })));
      }
      setNoteDraft(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "通信に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  if (showEdit) {
    return <ProfileEditSheet me={me} onChange={onChange} onClose={() => setShowEdit(false)} />;
  }

  if (showSettings) {
    return (
      <SettingsSheet
        me={me}
        theme={theme}
        onThemeChange={onThemeChange}
        onChange={onChange}
        onClose={() => setShowSettings(false)}
        onLogout={onLogout}
      />
    );
  }

  return (
    <div className="page profile-page" role="dialog" aria-label="プロフィール">
      <header className="page-bar">
        <button onClick={onClose} aria-label="戻る">
          <Icon name="back" size={26} />
        </button>
        <strong>プロフィール</strong>
        <span />
      </header>

      <div className="profile-top">
        <Cover theme={me.coverTheme}>
          <button className="cover-edit" onClick={() => setShowEdit(true)} aria-label="プロフィールを設定">
            <Icon name="camera" size={18} />
          </button>
        </Cover>
        <button className="profile-avatar" onClick={() => setShowEdit(true)} aria-label="プロフィールを設定">
          <Avatar userId={me.id} hasAvatar={me.hasAvatar} name={me.displayName} size={104} />
        </button>
        <strong className="profile-name">{me.displayName}</strong>
        <p className={`profile-status ${me.bio ? "" : "muted"}`}>{me.bio || "ステータスメッセージを入力"}</p>
        {me.sennin && <p className="muted small">仙人アカウント連携中</p>}
      </div>

      <div className="profile-actions">
        <button className="pill" onClick={() => setShowEdit(true)}>
          <Icon name="edit" size={18} /> プロフィールを設定
        </button>
        <button className="pill" onClick={() => setShowQr((v) => !v)}>
          <Icon name="qr" size={18} /> QRコード
        </button>
        <button className="pill" onClick={() => setShowSettings(true)}>
          <Icon name="settings" size={18} /> 設定
        </button>
      </div>

      {showQr && (
        <div className="qr-card">
          {qrImage && <img src={qrImage} alt={`${me.username} のQRコード`} />}
          <span className="muted">@{me.username}</span>
          <p className="muted small">相手がこのQRコードを読み取ると、友だちに追加できます。</p>
        </div>
      )}

      {noteDraft !== null ? (
        <div className="note editing">
          <span className="note-tag">ノート</span>
          <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} maxLength={60} autoFocus />
          <button className="btn-small accent" disabled={busy} onClick={() => void saveNote()}>
            保存
          </button>
        </div>
      ) : (
        <button className="note" onClick={() => setNoteDraft(note?.body ?? "")}>
          <span className="note-tag">ノート</span>
          <span className={note ? "" : "muted"}>{note ? note.body : "書く（24時間で消えます）"}</span>
          <Icon name="edit" size={16} className="chev" />
        </button>
      )}

      {note && noteDraft === null && (
        <button className="pill note-view" onClick={() => setViewNoteId(note.id)}>
          いいね・コメントを見る
        </button>
      )}

      {status && <p className="notice center">{status}</p>}
      {viewNoteId && <NoteSheet noteId={viewNoteId} onClose={() => setViewNoteId(null)} />}
    </div>
  );
}
