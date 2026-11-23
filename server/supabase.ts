import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

// Supabase はテキスト（ユーザー・会話・メッセージ・友だちなど）だけに使う
export const sb = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
