import { readFileSync } from "node:fs";
import path from "node:path";

// スタンプの一覧は public/stamps/manifest.json（アプリと一緒に配る固定セット）。
// サーバーは一覧にある番号だけを受け付ける（任意の文字列を保存しない）。
export const STAMP_ID = /^[a-z0-9_-]{1,40}$/;

const known = new Set<string>();
try {
  const file = path.join(process.cwd(), "public", "stamps", "manifest.json");
  const manifest = JSON.parse(readFileSync(file, "utf8")) as { items: { id: string }[] };
  for (const item of manifest.items) known.add(item.id);
} catch {
  console.warn("stamps: public/stamps/manifest.json が読めません。スタンプは送れません。");
}

export const isKnownStamp = (id: string) => known.has(id);
