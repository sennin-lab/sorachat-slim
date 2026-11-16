import type { NextFunction, Request, Response } from "express";

// セキュリティの共通処理（すべての応答と /api の書き込みに入る）
//  1. Permissions-Policy：使わない機能（マイク・位置情報・決済など）を、ページに許可しない。QR読み取りのカメラだけ自分のサイトに許可
//  2. Origin の確認（CSRF対策）：書き込みは、同じサイトからのものだけ受け付ける
//  3. 回数の制限：IPごとに、書き込みを1分あたり WRITE_LIMIT_PER_MINUTE 回まで（連打・荒らし対策）

const WRITE_LIMIT_PER_MINUTE = 120;
const WINDOW_MS = 60_000;
const windows = new Map<string, { count: number; reset: number }>();

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// 古い記録を片付ける（メモリが増え続けないように）
function sweep(now: number) {
  if (windows.size < 5000) return;
  for (const [key, entry] of windows) {
    if (entry.reset < now) windows.delete(key);
  }
}

export function securityGate(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=(), usb=()");

  if (!WRITE_METHODS.has(req.method)) {
    next();
    return;
  }

  // Origin が付いている書き込みは、このサイトからのものだけ。付いていない（サーバー間の通信など）は通す
  const origin = req.headers.origin;
  if (origin) {
    let sameSite = false;
    try {
      sameSite = new URL(origin).host === req.headers.host;
    } catch {
      sameSite = false;
    }
    if (!sameSite) {
      res.status(403).json({ error: "このサイトからは操作できません。" });
      return;
    }
  }

  const now = Date.now();
  sweep(now);
  const key = req.ip ?? "unknown";
  const entry = windows.get(key);
  if (!entry || entry.reset < now) {
    windows.set(key, { count: 1, reset: now + WINDOW_MS });
    next();
    return;
  }
  entry.count += 1;
  if (entry.count > WRITE_LIMIT_PER_MINUTE) {
    res.status(429).json({ error: "操作が多すぎます。少し待ってから再度お試しください。" });
    return;
  }
  next();
}
