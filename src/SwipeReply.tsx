import { useRef, useState, type ReactNode, type TouchEvent } from "react";

// この距離（px）以上、右から左へ引いたら返信になる。途中で指を離したら戻る
const TRIGGER = 56;
// 引ける最大の距離（px）。引きすぎないように抵抗をつける
const MAX_PULL = 72;

// メッセージを右から左へスワイプすると、そのメッセージへの返信になる（LINE・Instagram と同じ操作）
export function SwipeReply({ enabled, onReply, children }: { enabled: boolean; onReply: () => void; children: ReactNode }) {
  const start = useRef<{ x: number; y: number; axis: "x" | "y" | null } | null>(null);
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const move = (value: number) => {
    offsetRef.current = value;
    setOffset(value);
  };

  const onTouchStart = (e: TouchEvent) => {
    if (!enabled || e.touches.length !== 1) return;
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, axis: null };
  };

  const onTouchMove = (e: TouchEvent) => {
    const s = start.current;
    if (!s || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (!s.axis) {
      // 少し動いたところで、横か縦かを決める（縦はスクロールとして扱い、邪魔しない）
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (s.axis === "x") setDragging(true);
    }
    if (s.axis !== "x") return;
    // 左へだけ引ける（右へは動かさない）
    const pull = dx < 0 ? -Math.min(MAX_PULL, -dx * 0.8) : 0;
    move(pull);
  };

  const finish = (cancelled: boolean) => {
    const s = start.current;
    start.current = null;
    setDragging(false);
    const replyNow = !cancelled && s?.axis === "x" && offsetRef.current <= -TRIGGER;
    move(0);
    if (replyNow) {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
      onReply();
    }
  };

  const hintOpacity = Math.min(1, -offset / TRIGGER);

  return (
    <div
      className="swipe-reply"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => finish(false)}
      onTouchCancel={() => finish(true)}
    >
      <span className="swipe-hint" style={{ opacity: hintOpacity }} aria-hidden="true">
        <i className="fa-solid fa-reply" />
      </span>
      <div
        className="swipe-body"
        style={{ transform: offset ? `translateX(${offset}px)` : undefined, transition: dragging ? "none" : "transform 0.2s ease" }}
      >
        {children}
      </div>
    </div>
  );
}
