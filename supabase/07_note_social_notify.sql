-- ノートのいいね・コメント、通知に本文を含めるかの設定
-- 実行順: 既存の 01〜06 のあとに実行する

-- ノートごとのID（いいね・コメントはこのIDにひも付く。投稿し直すと新しいIDになる）
alter table public.sc_notes add column if not exists id uuid not null default gen_random_uuid();
create unique index if not exists sc_notes_id_key on public.sc_notes (id);

create table if not exists public.sc_note_likes (
  note_id uuid not null references public.sc_notes(id) on delete cascade,
  user_id uuid not null references public.sc_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

create table if not exists public.sc_note_comments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.sc_notes(id) on delete cascade,
  user_id uuid not null references public.sc_users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists sc_note_comments_note_idx on public.sc_note_comments (note_id, created_at);

alter table public.sc_note_likes enable row level security;
alter table public.sc_note_comments enable row level security;
revoke all on public.sc_note_likes, public.sc_note_comments from anon, authenticated;

alter table public.sc_users add column if not exists notify_preview boolean not null default false;

notify pgrst, 'reload schema';
