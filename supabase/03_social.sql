-- 03_social.sql：友だち・友だち申請・ブロック・ノート
-- 友だち関係と、24時間で消えるノートを管理する。
-- 実行順: この番号の順に、Supabase の SQL Editor で実行してください（何度実行しても安全な書き方です）。

create table if not exists public.sc_friends (
  user_id uuid not null references public.sc_users(id) on delete cascade,
  friend_id uuid not null references public.sc_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint sc_friends_not_self check (user_id <> friend_id)
);
create index if not exists sc_friends_friend_idx on public.sc_friends (friend_id);

-- 友だち申請（承認されるまでは sc_friends に入れない）
create table if not exists public.sc_friend_requests (
  from_id uuid not null references public.sc_users(id) on delete cascade,
  to_id uuid not null references public.sc_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists sc_friend_requests_to_idx on public.sc_friend_requests (to_id);

create table if not exists public.sc_blocks (
  blocker_id uuid not null references public.sc_users(id) on delete cascade,
  blocked_id uuid not null references public.sc_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists sc_blocks_blocked_idx on public.sc_blocks (blocked_id);

-- ノート（60文字まで・24時間で消える。相手のプロフィールに出す）
create table if not exists public.sc_notes (
  user_id uuid primary key references public.sc_users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 60),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.sc_friends enable row level security;
alter table public.sc_friend_requests enable row level security;
alter table public.sc_blocks enable row level security;
alter table public.sc_notes enable row level security;
revoke all on public.sc_friends, public.sc_friend_requests, public.sc_blocks from anon, authenticated;
revoke all on public.sc_notes from anon, authenticated;
grant select on public.sc_notes to authenticated;

drop policy if exists sc_notes_select on public.sc_notes;
create policy sc_notes_select on public.sc_notes for select to authenticated using (expires_at > now() and (user_id = public.sc_me() or public.sc_shares_with_me(user_id)));

notify pgrst, 'reload schema';
