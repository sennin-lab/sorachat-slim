-- 05_migrate_remove_legacy.sql：既存の Supabase から、削除した機能の残り（テーブル・列・関数・制約）を取り除く
--
-- ⚠ 注意：この SQL は元に戻せません。次のデータを削除します。
--   ・画像・ファイル・スタンプのメッセージ（kind が image / file / stamp の行）
--   ・仙人ストア・senninstudio・SenninPay・拡張機能・senninstudio の作品・紹介・ポイント（ソラチャット側の記録）
-- 実行前に Supabase のバックアップを取ってください。画像の実体（Supabase Storage の sc-images バケット）は
-- この SQL では消えません。必要なら Supabase のダッシュボードの Storage から削除してください。
-- 画像の実体（Turso の sc_blobs のアイコン）は残ります（アイコンは使うため）。
-- 何度実行しても安全です（存在しないものは何もしません）。 01〜04 の後に実行してください。

-- 1) 削除した機能が使っていた Realtime のポリシー（通話・対戦は WebSocket に移したため不要）
drop policy if exists sc_call_select on realtime.messages;
drop policy if exists sc_call_insert on realtime.messages;
drop policy if exists sc_group_call_select on realtime.messages;
drop policy if exists sc_group_call_insert on realtime.messages;
drop policy if exists sc_call_ring_select on realtime.messages;
drop policy if exists sc_call_ring_insert on realtime.messages;

-- 2) 削除した機能の関数（引数の違いに関係なく削除）
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (
        'sc_open_dm', 'sc_topic_user', 'sc_topic_uuid_after',
        'sc_extension_reserve', 'sc_extension_settle',
        'sc_solo_reward', 'sc_solo_begin_withdraw', 'sc_solo_settle_withdraw'
      )
  loop
    execute 'drop function if exists ' || r.sig::text || ' cascade';
  end loop;
end $$;

-- 3) 削除した機能のテーブル
drop table if exists public.sc_store_items cascade;
drop table if exists public.sc_store_purchases cascade;
drop table if exists public.sc_store_overrides cascade;
drop table if exists public.sc_sennin_tokens cascade;
drop table if exists public.sc_user_stamps cascade;
drop table if exists public.sc_pay_transfers cascade;
drop table if exists public.sc_merchants cascade;
drop table if exists public.sc_login_bonus cascade;
drop table if exists public.sc_studio_payouts cascade;
drop table if exists public.sc_studio_reports cascade;
drop table if exists public.sc_studio_images cascade;
drop table if exists public.sc_studio_reviews cascade;
drop table if exists public.sc_studio_works cascade;
drop table if exists public.sc_studio_creators cascade;
drop table if exists public.sc_solo_withdrawals cascade;
drop table if exists public.sc_solo_rounds cascade;
drop table if exists public.sc_solo_wallets cascade;
drop table if exists public.sc_extension_awards cascade;
drop table if exists public.sc_extension_consents cascade;
drop table if exists public.sc_extension_grants cascade;
drop table if exists public.sc_extension_charges cascade;
drop table if exists public.sc_extension_data cascade;
drop table if exists public.sc_battle_subscriptions cascade;
drop table if exists public.sc_referrals cascade;

-- 4) sc_users の削除した機能の列
alter table public.sc_users drop column if exists store_theme;
alter table public.sc_users drop column if exists store_ai_style;
alter table public.sc_users drop column if exists invite_code;

-- 5) sc_messages：画像・ファイル・スタンプの行と列を消す
delete from public.sc_messages where kind in ('image', 'file', 'stamp');
drop index if exists public.sc_messages_image_path_idx;
alter table public.sc_messages drop constraint if exists sc_messages_content;
alter table public.sc_messages drop column if exists image_path;
alter table public.sc_messages drop column if exists file_path;
alter table public.sc_messages drop column if exists file_name;
alter table public.sc_messages drop column if exists file_size;
alter table public.sc_messages drop column if exists stamp_ref;
alter table public.sc_messages drop constraint if exists sc_messages_kind_check;
alter table public.sc_messages add constraint sc_messages_kind_check
  check (kind in ('text', 'contact', 'system', 'poll', 'game', 'call'));

-- 6) ミニゲームの種類（連打・反射神経を含む）
alter table public.sc_games drop constraint if exists sc_games_kind_check;
alter table public.sc_games add constraint sc_games_kind_check
  check (kind in ('tictactoe', 'quiz', 'janken', 'guess', 'tap', 'reflex'));

-- 7) 画像の保存先（Supabase Storage）の旧データ参照。バケットの中身は Storage 画面から削除してください
-- （この SQL では storage スキーマに触れません）

notify pgrst, 'reload schema';
