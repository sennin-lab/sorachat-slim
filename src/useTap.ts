import { useEffect, useRef } from "react";

// 1回押しと2回押し（ダブルタップ・ダブルクリック）を見分ける。
// 1回押しは、2回目が来ないことを少し待ってから確定する（2回押しの途中で詳細が開かないように）
const WAIT_MS = 260;

export function useTap(onSingle: (() => void) | undefined, onDouble: () => void) {
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (event?: { stopPropagation: () => void }) => {
    event?.stopPropagation();
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = 0;
      onDouble();
      return;
    }
    timer.current = window.setTimeout(() => {
      timer.current = 0;
      onSingle?.();
    }, WAIT_MS);
  };
}

// 決まった回数の連打（2回・3回など）を見分ける。window のあいだに続けて押されたら、その回数に達した時点で action を呼ぶ
export function useMultiTap(count: number, action: () => void, windowMs = 450) {
  const taps = useRef<number[]>([]);
  return (event?: { stopPropagation: () => void }) => {
    event?.stopPropagation();
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < windowMs), now];
    if (taps.current.length >= count) {
      taps.current = [];
      action();
    }
  };
}
