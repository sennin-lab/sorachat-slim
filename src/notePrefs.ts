// ノートの帯（友だちタブの上）を表示するか。この端末に保存する（prefs.ts と同じ扱い）
// 既定はオフ。オフのあいだは帯を描かず、ノートの通信もしない
const NOTE_STRIP_KEY = "sorachat-note-strip";
export const NOTE_PREFS_EVENT = "sorachat-note-prefs";

export function getNoteStrip(): boolean {
  try {
    return localStorage.getItem(NOTE_STRIP_KEY) === "on";
  } catch {
    return false;
  }
}

export function setNoteStrip(on: boolean) {
  try {
    localStorage.setItem(NOTE_STRIP_KEY, on ? "on" : "off");
  } catch {
    // 保存できなくても、この画面の中では切り替わる
  }
  window.dispatchEvent(new Event(NOTE_PREFS_EVENT));
}
