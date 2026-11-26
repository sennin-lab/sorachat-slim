import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "./config.js";
import { cookieBase } from "./security.js";
import { sb } from "./supabase.js";

export const SESSION_COOKIE = "sc_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

// Cookie の共通設定は security.ts にまとめてある
export { cookieBase } from "./security.js";

export const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

// セッションと利用停止の確認は、短いあいだ記憶して Supabase への問い合わせを減らす（ログイン中の全リクエストで2回ぶん減る）
const SESSION_CACHE_MS = 60_000;
const BAN_CACHE_MS = 30_000;
const CACHE_LIMIT = 5_000;
const sessionCache = new Map<string, { userId: string; expiresAt: number; at: number }>();
const banCache = new Map<string, { ban: BanInfo | null; at: number }>();

// 記憶しているセッションから、期限・ユーザーを取り出す（なければ Supabase に問い合わせる）
async function sessionRowOf(token: string): Promise<{ user_id: string; expires_at: string } | null> {
  const key = sha256(token);
  const hit = sessionCache.get(key);
  if (hit && Date.now() - hit.at < SESSION_CACHE_MS) {
    return { user_id: hit.userId, expires_at: new Date(hit.expiresAt).toISOString() };
  }
  const { data, error } = await sb
    .from("sc_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", key)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { user_id: string; expires_at: string };
  if (sessionCache.size > CACHE_LIMIT) sessionCache.clear();
  sessionCache.set(key, { userId: row.user_id, expiresAt: new Date(row.expires_at).getTime(), at: Date.now() });
  return row;
}
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");

export async function startSession(res: Response, userId: string) {
  const token = randomToken();
  const { error } = await sb.from("sc_sessions").insert({
    token_hash: sha256(token),
    user_id: userId,
    expires_at: new Date(Date.now() + SESSION_MS).toISOString()
  });
  if (error) throw error;
  res.cookie(SESSION_COOKIE, token, { ...cookieBase, maxAge: SESSION_MS });
}

export async function endSession(token: unknown) {
  if (typeof token === "string" && token) {
    sessionCache.delete(sha256(token));
    await sb.from("sc_sessions").delete().eq("token_hash", sha256(token));
  }
}

// Cookie の証明書から、有効なログイン中のユーザーIDを取り出す（期限切れや無効なら null）
export async function sessionUserId(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || !token) return null;
  const data = await sessionRowOf(token);
  if (!data || new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.user_id;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== "string" || !token) {
      res.status(401).json({ error: "ログインしてください。" });
      return;
    }
    const data = await sessionRowOf(token);
    if (!data || new Date(data.expires_at).getTime() < Date.now()) {
      res.status(401).json({ error: "セッションが切れました。再ログインしてください。" });
      return;
    }
    // 利用停止中は、セッションが残っていても操作させない。画面に期限を出せるように ban を返す
    const ban = await banOfUser(data.user_id as string);
    if (ban) {
      res.status(403).json({ error: BANNED_MESSAGE, ban });
      return;
    }
    res.locals.userId = data.user_id;
    next();
  } catch (error) {
    next(error);
  }
}

export const currentUserId = (res: Response) => res.locals.userId as string;

export const BANNED_MESSAGE = "このアカウントは利用停止中です。";

// 利用停止の内容。permanent なら期限なし、そうでなければ until（ISO形式）まで
export type BanInfo = { until: string | null; permanent: boolean; reason: string | null };

// いまの利用停止を返す。利用停止でない・期限が過ぎているなら null
export function banOf(row: { banned_at: string | null; banned_until: string | null; ban_reason?: string | null } | null): BanInfo | null {
  if (!row?.banned_at) return null;
  const reason = row.ban_reason ?? null;
  if (!row.banned_until) return { until: null, permanent: true, reason };
  if (new Date(row.banned_until).getTime() <= Date.now()) return null;
  return { until: row.banned_until, permanent: false, reason };
}

export async function banOfUser(userId: string): Promise<BanInfo | null> {
  const hit = banCache.get(userId);
  if (hit && Date.now() - hit.at < BAN_CACHE_MS) return hit.ban;
  const { data, error } = await sb.from("sc_users").select("banned_at, banned_until, ban_reason").eq("id", userId).maybeSingle();
  if (error) throw error;
  const ban = banOf(data as { banned_at: string | null; banned_until: string | null; ban_reason: string | null } | null);
  if (banCache.size > CACHE_LIMIT) banCache.clear();
  banCache.set(userId, { ban, at: Date.now() });
  return ban;
}

// 利用停止の変更があったら、そのユーザーの記憶を消す（すぐ反映させるため）
export function forgetBan(userId: string) {
  banCache.delete(userId);
}

// 強制ログアウトなどでセッションを消したら、そのユーザーの記憶したセッションも消す
export function forgetSessionsOf(userId: string) {
  for (const [key, entry] of sessionCache) {
    if (entry.userId === userId) sessionCache.delete(key);
  }
}

export async function isBanned(userId: string) {
  return (await banOfUser(userId)) !== null;
}

export function signRealtimeToken(userId: string, ttlSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: userId, role: "authenticated", aud: "authenticated", iss: "sorachat", iat: now, exp: now + ttlSeconds });
  const signature = crypto.createHmac("sha256", config.supabaseJwtSecret).update(`${header}.${payload}`).digest("base64url");
  return { token: `${header}.${payload}.${signature}`, expiresIn: ttlSeconds };
}
