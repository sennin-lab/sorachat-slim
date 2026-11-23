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

export async function readImage(path: string) {
  try {
    await ensureBlobTable();
    const rows = await tursoExecute("select content_type, data from sc_blobs where path = ? limit 1", [{ type: "text", value: path }]);
    const row = rows[0];
    if (!row) return null;
    const typeValue = row[0];
    const dataValue = row[1];
    const type = typeValue && typeValue.type === "text" ? typeValue.value : "";
    const data = dataValue && dataValue.type === "blob" ? dataValue.base64 : "";
    return { buffer: Buffer.from(data, "base64"), type: type || "application/octet-stream" };
  } catch (error) {
    console.error("画像の読み込み（Turso）に失敗しました:", error);
    return null;
  }
}

export async function removeImage(path: string | null) {
  if (!path) return;
  try {
    await ensureBlobTable();
    await tursoExecute("delete from sc_blobs where path = ?", [{ type: "text", value: path }]);
  } catch (error) {
    console.error("画像の削除（Turso）に失敗しました:", error);
  }
}
