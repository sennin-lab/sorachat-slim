-- 06_stamp.sql：スタンプのメッセージを追加する（画像は送らず、スタンプ番号だけを保存する）
-- 01〜05 の後に実行してください。何度実行しても安全です。
alter table public.sc_messages drop constraint if exists sc_messages_kind_check;
alter table public.sc_messages add constraint sc_messages_kind_check
  check (kind in ('text', 'contact', 'system', 'poll', 'game', 'call', 'stamp'));

notify pgrst, 'reload schema';
