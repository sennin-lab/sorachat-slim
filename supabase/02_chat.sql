-- 02_chat.sql：会話・メンバー・メッセージ・リアクション・投票・ミニゲーム
-- テキスト・連絡先・投票・ミニゲーム・通話カードのトーク。画像・ファイル・スタンプは含まない。
-- 実行順: この番号の順に、Supabase の SQL Editor で実行してください（何度実行しても安全な書き方です）。

create table if not exists public.sc_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_preview text,
  last_sender_id uuid references public.sc_users(id) on delete set null,
  is_group boolean not null default false,
  title text check (title is null or char_length(title) between 1 and 40),
  created_by uuid references public.sc_users(id) on delete set null,
  avatar_path text,
  is_open boolean not null default false,
  description text not null default '' check (char_length(description) <= 200)
);
create index if not exists sc_conversations_open_idx on public.sc_conversations (last_message_at desc) where is_open;

create table if not exists public.sc_members (
  conversation_id uuid not null references public.sc_conversations(id) on delete cascade,
  user_id uuid not null references public.sc_users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  muted boolean not null default false,
  primary key (conversation_id, user_id)
);
create index if not exists sc_members_user_idx on public.sc_members (user_id);
create index if not exists sc_members_conv_idx on public.sc_members (conversation_id);

-- メッセージ。種類は text（文字）・contact（連絡先）・system（お知らせ）・poll（投票）・game（ミニゲーム）・call（通話カード）
create table if not exists public.sc_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.sc_conversations(id) on delete cascade,
  sender_id uuid not null references public.sc_users(id) on delete cascade,
  kind text not null check (kind in ('text', 'contact', 'system', 'poll', 'game', 'call')),
  body text check (body is null or char_length(body) <= 1000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  forwarded boolean not null default false,
  client_id text constraint sc_messages_client_id_length check (client_id is null or char_length(client_id) <= 64),
  contact_user_id uuid references public.sc_users(id) on delete set null,
  reply_to_id uuid references public.sc_messages(id) on delete set null
);
create index if not exists sc_messages_conv_idx on public.sc_messages (conversation_id, created_at desc);
create index if not exists sc_messages_conv_created_idx on public.sc_messages (conversation_id, created_at);

create table if not exists public.sc_reactions (
  message_id uuid not null references public.sc_messages(id) on delete cascade,
  user_id uuid not null references public.sc_users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table if not exists public.sc_poll_votes (
  message_id uuid not null references public.sc_messages(id) on delete cascade,
  user_id uuid not null references public.sc_users(id) on delete cascade,
  option_index int not null check (option_index between 0 and 9),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, option_index)
);

-- ミニゲーム（グループのトーク）。状態は state に入る
create table if not exists public.sc_games (
  message_id uuid primary key references public.sc_messages(id) on delete cascade,
  conversation_id uuid not null references public.sc_conversations(id) on delete cascade,
  kind text not null check (kind in ('tictactoe', 'quiz', 'janken', 'guess', 'tap', 'reflex')),
  status text not null check (status in ('waiting', 'playing', 'finished')),
  creator_id uuid not null references public.sc_users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists sc_games_conversation_idx on public.sc_games (conversation_id);

alter table public.sc_conversations enable row level security;
alter table public.sc_members enable row level security;
alter table public.sc_messages enable row level security;
alter table public.sc_reactions enable row level security;
alter table public.sc_poll_votes enable row level security;
alter table public.sc_games enable row level security;
revoke all on public.sc_conversations, public.sc_members, public.sc_messages, public.sc_reactions, public.sc_poll_votes, public.sc_games from anon, authenticated;

create or replace function public.sc_me()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create or replace function public.sc_is_member(p_conv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.sc_members m where m.conversation_id = p_conv and m.user_id = public.sc_me());
$$;

create or replace function public.sc_shares_with_me(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sc_members x
    join public.sc_members y on y.conversation_id = x.conversation_id
    where x.user_id = public.sc_me() and y.user_id = p_other
  );
$$;

grant execute on function public.sc_me(), public.sc_is_member(uuid), public.sc_shares_with_me(uuid) to authenticated;
grant select on public.sc_conversations, public.sc_members, public.sc_messages, public.sc_reactions to authenticated;

drop policy if exists sc_conversations_select on public.sc_conversations;
create policy sc_conversations_select on public.sc_conversations for select to authenticated using (public.sc_is_member(id));
drop policy if exists sc_members_select on public.sc_members;
create policy sc_members_select on public.sc_members for select to authenticated using (public.sc_is_member(conversation_id));
drop policy if exists sc_messages_select on public.sc_messages;
create policy sc_messages_select on public.sc_messages for select to authenticated using (public.sc_is_member(conversation_id));
drop policy if exists sc_reactions_select on public.sc_reactions;
create policy sc_reactions_select on public.sc_reactions for select to authenticated using (exists (
  select 1 from public.sc_messages msg where msg.id = sc_reactions.message_id and public.sc_is_member(msg.conversation_id)
));

create or replace function public.sc_list_conversations(p_user uuid)
returns table (
  conversation_id uuid,
  is_group boolean,
  name text,
  other_id uuid,
  other_username text,
  has_avatar boolean,
  last_message_at timestamptz,
  last_preview text,
  last_sender_id uuid,
  unread bigint,
  my_role text,
  member_count bigint,
  muted boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.is_group,
    case when c.is_group then c.title else u.display_name end,
    u.id,
    u.username,
    case when c.is_group then (c.avatar_path is not null) else (u.avatar_path is not null) end,
    c.last_message_at,
    c.last_preview,
    c.last_sender_id,
    (select count(*) from public.sc_messages msg
      where msg.conversation_id = c.id
        and msg.created_at > me.last_read_at
        and msg.sender_id <> p_user),
    me.role,
    (select count(*) from public.sc_members mm where mm.conversation_id = c.id),
    me.muted
  from public.sc_members me
  join public.sc_conversations c on c.id = me.conversation_id
  left join public.sc_members o on o.conversation_id = c.id and o.user_id <> p_user and not c.is_group
  left join public.sc_users u on u.id = o.user_id
  where me.user_id = p_user
  order by c.last_message_at desc;
$$;

create or replace function public.sc_create_group(p_me uuid, p_title text, p_members uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  insert into public.sc_conversations (is_group, title, created_by)
  values (true, p_title, p_me)
  returning id into cid;
  insert into public.sc_members (conversation_id, user_id, role) values (cid, p_me, 'owner');
  insert into public.sc_members (conversation_id, user_id)
  select cid, unnest(p_members)
  on conflict do nothing;
  return cid;
end;
$$;

revoke execute on function public.sc_list_conversations(uuid), public.sc_create_group(uuid, text, uuid[]) from public, anon, authenticated;
grant execute on function public.sc_list_conversations(uuid), public.sc_create_group(uuid, text, uuid[]) to service_role;

notify pgrst, 'reload schema';
