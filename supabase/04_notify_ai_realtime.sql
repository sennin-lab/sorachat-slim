-- 04_notify_ai_realtime.sql：Web Push・senninai の確認待ち・Realtime の公開設定
-- 通知の登録、senninai の送信確認、新着を Realtime で受け取るための設定。
-- 実行順: この番号の順に、Supabase の SQL Editor で実行してください（何度実行しても安全な書き方です）。

-- Web Push の登録（端末ごと）
create table if not exists public.sc_push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.sc_users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists sc_push_user_idx on public.sc_push_subscriptions (user_id);
alter table public.sc_push_subscriptions enable row level security;
revoke all on public.sc_push_subscriptions from anon, authenticated;

-- senninai の送信の確認待ち（「はい／いいえ」の画面用。5分だけ保存）
create table if not exists public.sc_senninai_pending (
  user_id uuid primary key references public.sc_users(id) on delete cascade,
  conversation_id uuid references public.sc_conversations(id) on delete cascade,
  payload jsonb not null,
  expires_at timestamptz not null
);
alter table public.sc_senninai_pending enable row level security;
revoke all on public.sc_senninai_pending from anon, authenticated;

-- 新着・既読・リアクション・メンバーの変化を Realtime（postgres_changes）で受け取る

do $$
declare t text;
begin
  foreach t in array array['sc_messages', 'sc_reactions', 'sc_members', 'sc_conversations', 'sc_notes'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';
