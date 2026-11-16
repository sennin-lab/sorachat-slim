import { randomUUID } from "node:crypto";
import multer from "multer";
import { IMAGE_BUCKET, sb } from "./supabase.js";

// 保存先は Supabase（データベースと同じ Supabase の Storage）だけ。Turso は使わない
export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
export const FILE_LIMIT = 20 * 1024 * 1024;
export const uploadFile = multer({ storage: multer.memoryStorage(), limits: { fileSize: FILE_LIMIT } });

// 日本語のファイル名がずれて届くことがあるので、UTF-8として読み直す
export function fileNameOf(file: Express.Multer.File) {
  const decoded = Buffer.from(file.originalname, "latin1").toString("utf8");
  const name = decoded.includes("�") ? file.originalname : decoded;
  return name.replace(/[\\/\r\n]/g, "_").trim().slice(0, 120) || "file";
}

const safeExt = (name: string) => {
  const match = name.match(/\.([a-zA-Z0-9]{1,10})$/);
  return match ? match[1].toLowerCase() : "bin";
};

// 中身を Supabase Storage に保存する（同じ名前では上書きしない）
async function saveBlob(path: string, buffer: Buffer, contentType: string) {
  const { error } = await sb.storage.from(IMAGE_BUCKET).upload(path, buffer, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

// 任意ファイルは中身の型を信用せず application/octet-stream で保存する
export async function saveFile(file: Express.Multer.File, folder: string) {
  const path = `${folder}/${randomUUID()}.${safeExt(fileNameOf(file))}`;
  return saveBlob(path, file.buffer, "application/octet-stream");
}

// 中身で形式を確かめた画像を保存する（申告された型は使わない）
export async function saveSniffedImage(buffer: Buffer, mime: string, folder: string) {
  const ext = mime === "image/jpeg" ? "jpg" : mime.replace("image/", "");
  return saveBlob(`${folder}/${randomUUID()}.${ext}`, buffer, mime);
}

export const isAllowedImage = (file?: Express.Multer.File) => Boolean(file && IMAGE_TYPES[file.mimetype]);

export async function saveImage(file: Express.Multer.File, folder: string) {
  const path = `${folder}/${randomUUID()}.${IMAGE_TYPES[file.mimetype]}`;
  return saveBlob(path, file.buffer, file.mimetype);
}

// Supabase Storage から読む。なければ null
export async function readImage(path: string) {
  const { data, error } = await sb.storage.from(IMAGE_BUCKET).download(path);
  if (error || !data) return null;
  return { buffer: Buffer.from(await data.arrayBuffer()), type: data.type || "application/octet-stream" };
}

export async function removeImage(path: string | null) {
  if (!path) return;
  await sb.storage.from(IMAGE_BUCKET).remove([path]);
}
