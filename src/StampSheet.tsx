import { useEffect, useState } from "react";
import { useExitClose } from "./useExitClose";
import { ensureStamps, stampSrc, type StampItem } from "./stampCache";

// スタンプの画像。端末に保存済みのものを表示する
export function StampImage({ id, size = 140 }: { id: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void stampSrc(id).then((url) => {
      if (alive) setSrc(url);
    });
    return () => {
      alive = false;
    };
  }, [id]);
  if (!src) return <span className="stamp-fallback" style={{ width: size, height: size }} aria-hidden="true" />;
  return <img className="stamp-img" src={src} alt="スタンプ" width={size} height={size} />;
}

// スタンプを選ぶ画面（選んだ番号だけを送る）
export function StampSheet({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const [items, setItems] = useState<StampItem[] | null>(null);
  const { closing, close } = useExitClose(onClose);
  useEffect(() => {
    void ensureStamps().then((m) => setItems(m?.items ?? []));
  }, []);
  return (
    <div className={`sheet-backdrop${closing ? " is-closing" : ""}`} onClick={() => close()}>
      <div className={`sheet stamp-sheet${closing ? " is-closing" : ""}`} role="dialog" aria-label="スタンプ" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-title-row">
          <span />
          <strong>スタンプ</strong>
          <button type="button" className="icon-btn modal-x" onClick={() => close()} aria-label="閉じる">
            ×
          </button>
        </div>
        {items === null ? (
          <p className="stamp-empty">読み込み中…</p>
        ) : items.length === 0 ? (
          <p className="stamp-empty">スタンプがありません</p>
        ) : (
          <div className="stamp-grid">
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => onPick(item.id)}>
                <StampImage id={item.id} size={72} />
                <small>{item.name}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
