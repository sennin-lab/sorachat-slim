import { useState, type ChangeEvent } from "react";
import { AvatarCropper } from "./AvatarCropper";
import { ApiError, api, post } from "./api";
import { Avatar } from "./Avatar";
import { COVER_THEMES, Cover } from "./Cover";
import { Icon } from "./Icon";
import type { CoverTheme, Me } from "./types";

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : "通信に失敗しました。");

// プロフィール設定ページ：名前・ユーザー名・ステータス・連絡先・リンク・アイコン・背景を変える（プロフィール画面は見るだけ）
export function ProfileEditSheet({ me, onChange, onClose }: { me: Me; onChange: (me: Me) => void; onClose: () => void }) {
  const [displayName, setDisplayName] = useState(me.displayName);
  const [username, setUsername] = useState(me.username);
  const [bio, setBio] = useState(me.bio);
  const [contact, setContact] = useState(me.contact ?? "");
  const [profileUrl, setProfileUrl] = useState(me.profileUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [cropSource, setCropSource] = useState<string | null>(null);

  const run = async (task: () => Promise<string>) => {
    setBusy(true);
    setStatus("");
    try {
      setStatus(await task());
    } catch (err) {
      setStatus(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      const next = await api<Me>(
        "/api/me",
        post({ displayName, username: username.trim().toLowerCase(), bio, contact: contact.trim(), profileUrl: profileUrl.trim() })
      );
      onChange(next);
      setUsername(next.username);
      return "保存しました。";
    });

  const chooseCover = (id: CoverTheme) =>
    run(async () => {
      if (id === me.coverTheme) return "";
      onChange(await api<Me>("/api/me", post({ coverTheme: id })));
      return "背景を変更しました。";
    });

  const uploadAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("画像ファイルを選択してください。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setCropSource(reader.result);
    };
    reader.onerror = () => setStatus("画像を読み込めませんでした。");
    reader.readAsDataURL(file);
  };

  const saveCroppedAvatar = async (blob: Blob) => {
    setCropSource(null);
    await run(async () => {
      const form = new FormData();
      form.append("file", blob, "profile.jpg");
      onChange(await api<Me>("/api/me/avatar", { method: "POST", body: form }));
      return "プロフィール画像を更新しました。";
    });
  };

  return (
    <div className="page profile-edit-page" role="dialog" aria-label="プロフィール設定">
      <header className="page-bar">
        <button onClick={onClose} aria-label="戻る">
          <Icon name="back" size={26} />
        </button>
        <strong>プロフィール設定</strong>
        <span />
      </header>

      <div className="profile-edit-head">
        <label className="profile-avatar" aria-label="プロフィール画像を変更">
          <Avatar userId={me.id} hasAvatar={me.hasAvatar} name={displayName} size={96} />
          <span className="avatar-badge" aria-hidden="true">
            <Icon name="camera" size={14} />
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={uploadAvatar} disabled={busy} />
        </label>
        <p className="muted small">タップして画像を変更</p>
      </div>

      <div className="section-label flush">
        <span>背景</span>
      </div>
      <div className="page-card cover-choice">
        <Cover theme={me.coverTheme} />
        <div className="cover-picker" role="radiogroup" aria-label="背景">
          {COVER_THEMES.map((t, i) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={me.coverTheme === t.id}
              aria-label={t.label}
              className={`swatch ${me.coverTheme === t.id ? "on" : ""}`}
              style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, animationDelay: `${i * 40}ms` }}
              disabled={busy}
              onClick={() => void chooseCover(t.id)}
            />
          ))}
        </div>
      </div>

      <div className="section-label flush">
        <span>基本情報</span>
      </div>
      <div className="page-card form-card">
        <label className="form-row">
          <span>名前</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
        </label>
        <label className="form-row">
          <span>ユーザー名</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" maxLength={20} />
        </label>
        <label className="form-row">
          <span>ステータス</span>
          <input value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} placeholder="ひとこと" />
        </label>
        <label className="form-row">
          <span>連絡先</span>
          <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} />
        </label>
        <label className="form-row">
          <span>リンク</span>
          <input value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)} maxLength={200} inputMode="url" placeholder="https://" />
        </label>
      </div>
      <div className="profile-edit-foot">
        <button className="btn-primary" disabled={busy} onClick={save}>
          {busy ? "保存中…" : "保存"}
        </button>
      </div>

      {cropSource && (
        <AvatarCropper source={cropSource} onCancel={() => setCropSource(null)} onSave={(blob) => void saveCroppedAvatar(blob)} />
      )}
      {status && <p className="notice center">{status}</p>}
    </div>
  );
}
