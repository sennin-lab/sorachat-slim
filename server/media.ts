import { randomUUID } from "node:crypto";
import multer from "multer";
import { ensureBlobTable, tursoExecute } from "./turso.js";

// プロフィール・グループのアイコン画像だけを扱う（メッセージの画像・ファイルは扱わない）
// 中身は Turso（sc_blobs テーブル）に保存する。Supabase には画像を保存しない
export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const isAllowedImage = (file?: Express.Multer.File) => Boolean(file && IMAGE_TYPES[file.mimetype]);

async function saveBlob(path: string, buffer: Buffer, contentType: string) {
  await ensureBlobTable();
  await tursoExecute("insert into sc_blobs (path, content_type, size, data) values (?, ?, ?, ?)", [
    { type: "text", value: path },
    { type: "text", value: contentType },
    { type: "integer", value: String(buffer.length) },
    { type: "blob", base64: buffer.toString("base64") }
  ]);
  return path;
}

export async function saveImage(file: Express.Multer.File, folder: string) {
  const path = `${folder}/${randomUUID()}.${IMAGE_TYPES[file.mimetype]}`;
  return saveBlob(path, file.buffer, file.mimetype);
}

// 読み込んだ画像は、保存先（Turso）へ何度も取りに行かないよう、サーバーのメモリに少しだけ置く。
// パスは画像ごとに新しい UUID なので、同じパスの中身は変わらない（置き換えるときは新しいパスになる）。
const BLOB_CACHE_BYTES = 40 * 1024 * 1024;
const BLOB_CACHE_ITEM_MAX = 2 * 1024 * 1024;
const blobCache = new Map<string, { type: string; buffer: Buffer }>();
let blobCacheBytes = 0;

function forgetBlob(path: string) {
  const entry = blobCache.get(path);
  if (!entry) return;
  blobCacheBytes -= entry.buffer.length;
  blobCache.delete(path);
}

function rememberBlob(path: string, type: string, buffer: Buffer) {
  if (buffer.length > BLOB_CACHE_ITEM_MAX) return;
  forgetBlob(path);
  blobCache.set(path, { type, buffer });
  blobCacheBytes += buffer.length;
  // 古いものから捨てる（Map は入れた順に並ぶ）
  for (const oldest of blobCache.keys()) {
    if (blobCacheBytes <= BLOB_CACHE_BYTES) break;
    forgetBlob(oldest);
  }
}

// 画像の保存先（パス）の記憶。ユーザーや会話ごとに、いまの画像のパスを短く覚える（データベースへの問い合わせを減らす）
const AVATAR_PATH_CACHE_MS = 60_000;
const avatarPathCache = new Map<string, { path: string | null; at: number }>();

export function cachedAvatarPath(key: string): { path: string | null } | undefined {
  const hit = avatarPathCache.get(key);
  if (!hit || Date.now() - hit.at >= AVATAR_PATH_CACHE_MS) return undefined;
  return { path: hit.path };
}

export function rememberAvatarPath(key: string, path: string | null) {
  if (avatarPathCache.size > 5_000) avatarPathCache.clear();
  avatarPathCache.set(key, { path, at: Date.now() });
}

export function forgetAvatarPath(key: string) {
  avatarPathCache.delete(key);
}

export async function readImage(path: string) {
  const cached = blobCache.get(path);
  if (cached) return { buffer: cached.buffer, type: cached.type };
  try {
    await ensureBlobTable();
    const rows = await tursoExecute("select content_type, data from sc_blobs where path = ? limit 1", [{ type: "text", value: path }]);
    const row = rows[0];
    if (!row) return null;
    const typeValue = row[0];
    const dataValue = row[1];
    const type = typeValue && typeValue.type === "text" ? typeValue.value : "";
    const data = dataValue && dataValue.type === "blob" ? dataValue.base64 : "";
    const buffer = Buffer.from(data, "base64");
    const resolvedType = type || "application/octet-stream";
    rememberBlob(path, resolvedType, buffer);
    return { buffer, type: resolvedType };
  } catch (error) {
    console.error("画像の読み込み（Turso）に失敗しました:", error);
    return null;
  }
}

export async function removeImage(path: string | null) {
  if (!path) return;
  forgetBlob(path);
  try {
    await ensureBlobTable();
    await tursoExecute("delete from sc_blobs where path = ?", [{ type: "text", value: path }]);
  } catch (error) {
    console.error("画像の削除（Turso）に失敗しました:", error);
  }
}
