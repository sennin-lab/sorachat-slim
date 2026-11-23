import { idbGet, idbPut } from "./idb";

// スタンプ（固定セット）。初回だけ画像を端末（IndexedDB）に保存し、以後は端末から出す。
// 版（manifest.version）が変わったときだけ取り直す。送信はスタンプ番号だけ。
export type StampItem = { id: string; name: string; file: string };
export type StampManifest = { version: string; items: StampItem[] };
type StampRecord = { v: string; blob: Blob };

let manifest: StampManifest | null = null;
let loading: Promise<StampManifest | null> | null = null;
const urls = new Map<string, string>();

async function load(): Promise<StampManifest | null> {
  const res = await fetch("/stamps/manifest.json", { cache: "no-cache", credentials: "same-origin" });
  if (!res.ok) return null;
  const next = (await res.json()) as StampManifest;
  manifest = next;
  for (const item of next.items) {
    try {
      const stored = await idbGet<StampRecord>("stamps", item.id);
      if (stored?.v === next.version && stored.blob) continue;
      const file = await fetch(`/stamps/${encodeURIComponent(item.file)}`, { credentials: "same-origin" });
      if (!file.ok) continue;
      await idbPut("stamps", item.id, { v: next.version, blob: await file.blob() } satisfies StampRecord);
    } catch {
      // 1つ保存できなくても、残りは続ける（表示時にもう一度取りに行く）
    }
  }
  return next;
}

// スタンプ一覧を読み、足りない画像だけ取る。同時に呼んでも1回にまとめる
export function ensureStamps(): Promise<StampManifest | null> {
  if (!loading) {
    loading = load().catch(() => {
      loading = null;
      return null;
    });
  }
  return loading;
}

// 表示に使うURL。端末に保存済みならオブジェクトURL、なければ通常の取得
export async function stampSrc(id: string): Promise<string> {
  const list = (await ensureStamps()) ?? manifest;
  const item = list?.items.find((i) => i.id === id);
  const version = list?.version ?? "";
  const key = `${id}|${version}`;
  const cached = urls.get(key);
  if (cached) return cached;
  const stored = await idbGet<StampRecord>("stamps", id);
  if (stored?.blob && stored.v === version) {
    const url = URL.createObjectURL(stored.blob);
    urls.set(key, url);
    return url;
  }
  return `/stamps/${encodeURIComponent(item?.file ?? `${id}.svg`)}`;
}
