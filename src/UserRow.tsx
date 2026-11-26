import { useState, type CSSProperties, type ReactNode } from "react";
import { Avatar } from "./Avatar";
import { useTap } from "./useTap";

// 友だち・検索結果・メンバーで共通に使う1行（LINE の友だちリストのような見た目）
// note を渡すと、アイコンの上に Instagram のようなノートの吹き出しを出す。
// 吹き出しは、1回押すと詳細、2回押すといいね（行全体のタップより優先する）
export function UserRow({
  userId,
  hasAvatar,
  name,
  sub,
  right,
  onClick,
  check,
  note,
  onNoteOpen,
  onNoteLike,
  index = 0
}: {
  userId: string;
  hasAvatar: boolean;
  name: string;
  sub?: string | null;
  right?: ReactNode;
  onClick?: () => void;
  // 指定されたときは行全体が選択用のチェック行になる
  check?: { checked: boolean; disabled?: boolean };
  note?: { id: string; body: string } | null;
  onNoteOpen?: () => void;
  onNoteLike?: () => void;
  index?: number;
}) {
  const avatar = <Avatar userId={userId} hasAvatar={hasAvatar} name={name} size={50} />;
  const main = (
    <>
      {note ? (
        <span className="row-avatar has-note">
          <NoteBubble text={note.body} onOpen={onNoteOpen} onLike={onNoteLike} />
          {avatar}
        </span>
      ) : (
        avatar
      )}
      <span className="row-text">
        <strong>{name}</strong>
        {sub && <small>{sub}</small>}
      </span>
    </>
  );
  const style = { "--i": Math.min(index, 14) } as CSSProperties;
  if (check) {
    return (
      <li className="user-li" style={style}>
        <button
          type="button"
          role="checkbox"
          aria-checked={check.checked}
          className={`user-row ${check.checked ? "checked" : ""}`}
          disabled={check.disabled}
          onClick={onClick}
        >
          {main}
          {right}
          <span className={`check-dot ${check.checked ? "on" : ""}`} aria-hidden="true" />
        </button>
      </li>
    );
  }
  // 右側にボタンがあり、かつ行全体も押せる行。ボタンの中にボタンは置けないので、行の本体だけを押せるようにする
  if (onClick && right) {
    return (
      <li className="user-li" style={style}>
        <div className="user-row with-right">
          <button type="button" className="user-main" onClick={onClick}>
            {main}
          </button>
          {right}
        </div>
      </li>
    );
  }
  if (onClick) {
    return (
      <li className="user-li" style={style}>
        <button type="button" className="user-row" onClick={onClick}>
          {main}
        </button>
      </li>
    );
  }
  return (
    <li className="user-li" style={style}>
      <div className="user-row">
        {main}
        {right}
      </div>
    </li>
  );
}

// ノートの吹き出し。1回押すと詳細、2回押すといいね（ハートが出る）
export function NoteBubble({ text, onOpen, onLike }: { text: string; onOpen?: () => void; onLike?: () => void }) {
  const [burst, setBurst] = useState(0);
  const tap = useTap(onOpen, () => {
    setBurst((n) => n + 1);
    onLike?.();
  });
  return (
    <>
      <span
        role="button"
        tabIndex={0}
        className="note-bubble"
        onClick={(e) => tap(e)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onOpen?.();
        }}
        aria-label={`ノート：${text}。押すと詳しく見られます`}
      >
        {text}
      </span>
      {burst > 0 && (
        <span key={burst} className="note-heart" aria-hidden="true">
          ♥
        </span>
      )}
    </>
  );
}
