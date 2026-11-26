import { Router } from "express";
import { z } from "zod";
import { currentUserId, requireAuth } from "./auth.js";
import { avatarVersionOf } from "./avatarVersion.js";
import { activeNotesOf, friendIdsOf, friendshipOf } from "./friends.js";
import { blockedBetween, UUID } from "./messages.js";
import { sb } from "./supabase.js";

// ノート（友だちに見える24時間のひと言）の詳細・いいね・コメント
// 見られるのは、本人と友だちだけ。いいねした人の一覧は、ノートの本人だけが見られる
export const notes = Router();
notes.use("/notes", requireAuth);

type NoteRow = { id: string; user_id: string; body: string; expires_at: string };
type PersonRow = { id: string; username: string; display_name: string; avatar_path: string | null };

const person = (u: PersonRow) => ({
  id: u.id,
  username: u.username,
  displayName: u.display_name,
  hasAvatar: Boolean(u.avatar_path),
  avatarVersion: avatarVersionOf(u.avatar_path)
});

// 有効期限の内にあるノートを1件取る（なければ null）
async function activeNote(noteId: string): Promise<NoteRow | null> {
  if (!UUID.test(noteId)) return null;
  const { data, error } = await sb.from("sc_notes").select("id, user_id, body, expires_at").eq("id", noteId).maybeSingle();
  if (error) throw error;
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data as NoteRow;
}

// 本人か、ブロックしていない友だちなら見られる
async function canSee(me: string, owner: string): Promise<boolean> {
  if (me === owner) return true;
  if (await blockedBetween(me, owner)) return false;
  return (await friendshipOf(me, owner)) === "friend";
}

// トークの上のノートの帯に必要な分だけ返す（自分のノートと、ノートのある友だち）
// 友だち全員の詳細（bio・テーマなど）は送らない。ノートのない友だちも含めない
notes.get("/notes/strip", async (_req, res) => {
  const me = currentUserId(res);
  const friendIds = [...(await friendIdsOf(me))];
  const [selfNotes, friendNotes] = await Promise.all([activeNotesOf([me]), activeNotesOf(friendIds)]);
  const withNote = friendIds.filter((id) => friendNotes.has(id));
  type StripUser = { id: string; display_name: string; avatar_path: string | null };
  let users: StripUser[] = [];
  if (withNote.length) {
    const { data, error } = await sb
      .from("sc_users")
      .select("id, display_name, avatar_path")
      .in("id", withNote)
      .order("display_name", { ascending: true });
    if (error) throw error;
    users = (data ?? []) as StripUser[];
  }
  res.json({
    self: selfNotes.get(me) ?? null,
    friends: users.map((u) => ({
      id: u.id,
      displayName: u.display_name,
      hasAvatar: Boolean(u.avatar_path),
      avatarVersion: avatarVersionOf(u.avatar_path),
      note: friendNotes.get(u.id) ?? null
    }))
  });
});

notes.get("/notes/:id", async (req, res) => {
  const noteId = String(req.params.id);
  const me = currentUserId(res);
  const note = await activeNote(noteId);
  if (!note || !(await canSee(me, note.user_id))) {
    res.status(404).json({ error: "ノートが見つかりません。" });
    return;
  }
  const mine = note.user_id === me;
  const [ownerRes, countRes, myLikeRes, likersRes, commentsRes] = await Promise.all([
    sb.from("sc_users").select("id, username, display_name, avatar_path").eq("id", note.user_id).maybeSingle(),
    sb.from("sc_note_likes").select("user_id", { count: "exact", head: true }).eq("note_id", noteId),
    sb.from("sc_note_likes").select("user_id").eq("note_id", noteId).eq("user_id", me).maybeSingle(),
    mine
      ? sb
          .from("sc_note_likes")
          .select("created_at, sc_users(id, username, display_name, avatar_path)")
          .eq("note_id", noteId)
          .order("created_at", { ascending: false })
          .limit(300)
      : Promise.resolve({ data: null, error: null }),
    sb
      .from("sc_note_comments")
      .select("id, user_id, body, created_at, sc_users(id, username, display_name, avatar_path)")
      .eq("note_id", noteId)
      .order("created_at", { ascending: true })
      .limit(100)
  ]);
  for (const r of [ownerRes, countRes, myLikeRes, likersRes, commentsRes]) {
    if (r.error) throw r.error;
  }
  const owner = ownerRes.data as PersonRow | null;
  if (!owner) {
    res.status(404).json({ error: "ノートが見つかりません。" });
    return;
  }
  const likers = (likersRes.data ?? []) as unknown as { created_at: string; sc_users: PersonRow }[];
  const comments = (commentsRes.data ?? []) as unknown as { id: string; user_id: string; body: string; created_at: string; sc_users: PersonRow }[];
  res.json({
    id: note.id,
    body: note.body,
    expiresAt: note.expires_at,
    owner: person(owner),
    isMine: mine,
    likeCount: countRes.count ?? 0,
    likedByMe: Boolean(myLikeRes.data),
    // いいねした人の一覧は、ノートの本人だけに見せる（そのほかの人には人数だけ）
    likers: mine ? likers.map((l) => ({ ...person(l.sc_users), likedAt: l.created_at })) : null,
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.created_at,
      mine: c.user_id === me,
      // 自分のコメント、または自分のノートへのコメントは消せる
      canDelete: c.user_id === me || mine,
      author: person(c.sc_users)
    }))
  });
});

notes.post("/notes/:id/like", async (req, res) => {
  const noteId = String(req.params.id);
  const me = currentUserId(res);
  const note = await activeNote(noteId);
  if (!note || !(await canSee(me, note.user_id))) {
    res.status(404).json({ error: "ノートが見つかりません。" });
    return;
  }
  if (note.user_id === me) {
    res.status(400).json({ error: "自分のノートにはいいねできません。" });
    return;
  }
  const { error } = await sb
    .from("sc_note_likes")
    .upsert({ note_id: noteId, user_id: me }, { onConflict: "note_id,user_id", ignoreDuplicates: true });
  if (error) throw error;
  res.json({ ok: true, likedByMe: true });
});

notes.delete("/notes/:id/like", async (req, res) => {
  const noteId = String(req.params.id);
  const me = currentUserId(res);
  if (!UUID.test(noteId)) {
    res.status(404).json({ error: "ノートが見つかりません。" });
    return;
  }
  const { error } = await sb.from("sc_note_likes").delete().eq("note_id", noteId).eq("user_id", me);
  if (error) throw error;
  res.json({ ok: true, likedByMe: false });
});

const commentSchema = z.object({ body: z.string().trim().min(1).max(200) });

notes.post("/notes/:id/comments", async (req, res) => {
  const noteId = String(req.params.id);
  const me = currentUserId(res);
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "コメントは1〜200文字で入力してください。" });
    return;
  }
  const note = await activeNote(noteId);
  if (!note || !(await canSee(me, note.user_id))) {
    res.status(404).json({ error: "ノートが見つかりません。" });
    return;
  }
  const { error } = await sb.from("sc_note_comments").insert({ note_id: noteId, user_id: me, body: parsed.data.body });
  if (error) throw error;
  res.status(201).json({ ok: true });
});

notes.delete("/notes/comments/:commentId", async (req, res) => {
  const commentId = String(req.params.commentId);
  const me = currentUserId(res);
  if (!UUID.test(commentId)) {
    res.status(404).json({ error: "コメントが見つかりません。" });
    return;
  }
  const { data, error } = await sb.from("sc_note_comments").select("user_id, note_id").eq("id", commentId).maybeSingle();
  if (error) throw error;
  if (!data) {
    res.status(404).json({ error: "コメントが見つかりません。" });
    return;
  }
  const { data: owner, error: ownerError } = await sb.from("sc_notes").select("user_id").eq("id", data.note_id).maybeSingle();
  if (ownerError) throw ownerError;
  if (data.user_id !== me && owner?.user_id !== me) {
    res.status(403).json({ error: "このコメントは消せません。" });
    return;
  }
  const { error: deleteError } = await sb.from("sc_note_comments").delete().eq("id", commentId);
  if (deleteError) throw deleteError;
  res.json({ ok: true });
});
