import { useEffect, useState } from "react";
import { api } from "./api";
import { Avatar } from "./Avatar";
import { NoteSheet } from "./NoteSheet";
import type { Me } from "./types";

type NoteInfo = { id: string; body: string; expiresAt: string };
type SelfNote = NoteInfo | null;
// 帯に必要な分だけ（ノートのある友だち）。友だちの詳細は含まない
type StripFriend = { id: string; displayName: string; hasAvatar: boolean; avatarVersion?: string | null; note: NoteInfo };
type StripData = { self: SelfNote; friends: StripFriend[] };

const isLive = (note: { expiresAt: string } | null | undefined) => Boolean(note && Date.parse(note.expiresAt) > Date.now());

// トークの上に出す「ノートの帯」。自分（あなた）と、ノートのある友だちだけを横に並べる
// 友だち一覧の行とは別の表示（アイコンの上に、ノートの吹き出しを出す）
export function NoteStrip({
  me,
  version,
  onOpenMe,
  onOpenUser
}: {
  me: Me;
  version: number;
  onOpenMe: () => void;
  onOpenUser: (id: string) => void;
}) {
  const [selfNote, setSelfNote] = useState<SelfNote>(null);
  const [friends, setFriends] = useState<StripFriend[]>([]);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  // 1回の通信で、自分のノートと、ノートのある友だちだけをもらう
  useEffect(() => {
    api<StripData>("/api/notes/strip")
      .then((data) => {
        setSelfNote(isLive(data.self) ? data.self : null);
        setFriends(data.friends.filter((f) => isLive(f.note)));
      })
      .catch(() => {
        setSelfNote(null);
        setFriends([]);
      });
  }, [version]);

  return (
    <>
      <div className="note-strip" role="list" aria-label="ノート">
        <div className="note-strip-item" role="listitem">
          <div className="note-strip-slot">
            {selfNote ? (
              <button type="button" className="note-strip-bubble" onClick={() => setOpenNoteId(selfNote.id)}>
                {selfNote.body}
              </button>
            ) : null}
          </div>
          <button type="button" className="note-strip-avatar" onClick={onOpenMe} aria-label="自分のプロフィールを開く">
            <Avatar userId={me.id} hasAvatar={me.hasAvatar} name={me.displayName} size={56} />
          </button>
          <span className="note-strip-name">あなた</span>
        </div>

        {friends.map((f) => (
          <div className="note-strip-item" role="listitem" key={f.id}>
            <div className="note-strip-slot">
              <button type="button" className="note-strip-bubble" onClick={() => setOpenNoteId(f.note!.id)}>
                {f.note!.body}
              </button>
            </div>
            <button type="button" className="note-strip-avatar" onClick={() => onOpenUser(f.id)} aria-label={`${f.displayName}のプロフィールを開く`}>
              <Avatar userId={f.id} hasAvatar={f.hasAvatar} name={f.displayName} size={56} />
            </button>
            <span className="note-strip-name">{f.displayName}</span>
          </div>
        ))}
      </div>
      {openNoteId && <NoteSheet noteId={openNoteId} onClose={() => setOpenNoteId(null)} />}
    </>
  );
}
