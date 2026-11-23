-- 01_auth_users.sql：ユーザー・セッション・登録・パスワード
-- ユーザー名・パスワード・仙人アカウントのユーザーを管理する。画像は保存しない（アイコンは Turso）。
-- 実行順: この番号の順に、Supabase の SQL Editor で実行してください（何度実行しても安全な書き方です）。

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.sc_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  bio text not null default '' check (char_length(bio) <= 200),
  contact text not null default '' check (char_length(contact) <= 120),
  profile_url text not null default '' check (char_length(profile_url) <= 200),
  avatar_path text,
  password_hash text,
  sennin_id text unique,
  notify_dm boolean not null default true,
  cover_theme text not null default 'green' check (cover_theme in ('green', 'sky', 'sunset', 'lavender', 'sand', 'graphite')),
  ai_enabled boolean not null default false,
  is_bot boolean not null default false,
  banned_at timestamptz,
  banned_until timestamptz,
  ban_reason text,
  signup_ip text,
  last_ip text,
  created_at timestamptz not null default now()
);

create table if not exists public.sc_sessions (
  token_hash text primary key,
  user_id uuid not null references public.sc_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sc_sessions_user_idx on public.sc_sessions (user_id);

-- IP BAN（管理者パネルから登録する）
create table if not exists public.sc_ip_bans (
  ip text primary key,
  reason text,
  created_at timestamptz not null default now()
);

-- メンテナンスモードなど、管理者が切り替える設定
create table if not exists public.sc_system_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 固定のアカウント（ログインできない。is_bot = true）：senninai と 開発チーム（お知らせ）
insert into public.sc_users (id, username, display_name, bio, password_hash, is_bot)
values ('5e11a1ab-0000-4000-8000-000000000001', 'senninai', 'senninai', 'AIチャット', null, true)
on conflict do nothing;
insert into public.sc_users (id, username, display_name, bio, password_hash, is_bot)
values ('b0a7e000-0000-4000-8000-00000000d001', 'sorachat_team', 'SoraChat開発チーム', 'SoraChatからのお知らせ', null, true)
on conflict do nothing;

alter table public.sc_users enable row level security;
alter table public.sc_sessions enable row level security;
alter table public.sc_ip_bans enable row level security;
alter table public.sc_system_settings enable row level security;
revoke all on public.sc_users, public.sc_sessions, public.sc_ip_bans, public.sc_system_settings from anon, authenticated;

create or replace function public.sc_register(p_username text, p_password text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  insert into public.sc_users (username, display_name, password_hash)
  values (lower(p_username), p_name, extensions.crypt(p_password, extensions.gen_salt('bf')))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.sc_check_password(p_username text, p_password text)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select u.id
  from public.sc_users u
  where u.username = lower(p_username)
    and u.password_hash is not null
    and u.password_hash = extensions.crypt(p_password, u.password_hash)
  limit 1;
$$;

create or replace function public.sc_set_password(p_user_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.sc_users
     set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf'))
   where id = p_user_id and is_bot = false;
  return found;
end;
$$;
revoke execute on function public.sc_register(text, text, text) from public, anon, authenticated;
revoke execute on function public.sc_check_password(text, text) from public, anon, authenticated;
revoke execute on function public.sc_set_password(uuid, text) from public, anon, authenticated;
grant execute on function public.sc_register(text, text, text) to service_role;
grant execute on function public.sc_check_password(text, text) to service_role;
grant execute on function public.sc_set_password(uuid, text) to service_role;

notify pgrst, 'reload schema';
