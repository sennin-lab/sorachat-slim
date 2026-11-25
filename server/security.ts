// セキュリティの設定をここにまとめる。
// ・プロキシ（Render など）の後ろで動くので trust proxy は 1 段（IP の取得・IP BAN に使う）
// ・HTTP ヘッダー（helmet）：読み込み元を CSP で制限する。画像は blob:（保存済みのアイコン）も許可する
// ・リクエストの大きさ：JSON は 32kb まで
// ・Cookie：httpOnly / sameSite / 本番では secure。セッション・管理者・OAuth の Cookie はこの設定を使う
//
// ほかの関所（それぞれのファイルにある）：
// ・auth.ts        … ログイン・セッション・ログイン必須チェック
// ・admin.ts       … 管理者パネルの Cookie（sameSite: strict）と認証
// ・ipBans.ts      … IP BAN（/api を止める）
// ・maintenance.ts … メンテナンス中の制限
// ・crypto.ts      … メッセージ本文の暗号化（AES-256-GCM）
// ・realtime.ts    … WebSocket の接続元（同じ接続元のみ許可）とトークン確認
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { config } from "./config.js";

// プロキシを何段信用するか（X-Forwarded-For の最後の1つを使う）
export const TRUST_PROXY_HOPS = 1;

// JSON の最大サイズ
export const JSON_BODY_LIMIT = "32kb";

// Cookie の共通設定（セッション・管理者・OAuth で使う）
export const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.nodeEnv === "production",
  path: "/"
};

// Express に共通の安全設定を入れる。順番が大事なので、app を作ったらすぐ呼ぶ
export function applySecurity(app: Express) {
  app.set("trust proxy", TRUST_PROXY_HOPS);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "data:", "blob:"]
        }
      }
    })
  );
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(cookieParser());
}
