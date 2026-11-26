import { useState } from "react";
import { useMultiTap } from "./useTap";

// /admin を開いたときに出す、SoraChat のトップページ（未ログインのとき）。
// フッターの「© SoraChat」を2回押すと「made by sennin」が出て、それを3回押すと管理者ログインへ進む。
const FEATURES = [
  { title: "1対1のDM", body: "友だちとゆっくり話せるトーク画面です。返信、リアクション、送信の取り消しにも対応しています。" },
  { title: "グループチャット", body: "みんなで予定や話題を共有できます。メンバーの追加・退出・名前の変更もトークに残ります。" },
  { title: "オープンチャット", body: "テーマごとの集まりに参加して、友だち以外の人とも話せます。" },
  { title: "音声通話", body: "1対1でもグループでも、音声で話せます。通話の開始や終了もトークに残ります。" },
  { title: "スタンプ・投票", body: "文字だけでは伝えにくい気持ちも、スタンプやアンケートでひと言。" },
  { title: "ミニゲーム", body: "グループでクイズなどのミニゲームを楽しめます。" },
  { title: "ノート", body: "24時間で消える、ひと言のノートを友だちに届けられます。いいねやコメントもできます。" },
  { title: "既読と通知", body: "既読の表示や、新着メッセージの通知を受け取れます。通知に本文を含めるかも選べます。" }
];

const STEPS = [
  { title: "アカウントを作る", body: "ユーザー名とパスワードで登録するか、仙人アカウントで続けられます。" },
  { title: "友だちを追加", body: "ユーザー名で検索するか、QRコードを読み取って友だちになります。" },
  { title: "トークを始める", body: "友だちを選んで、そのまま話しはじめられます。" }
];

const SAFETY = [
  { title: "暗号化して保存", body: "メッセージの本文は、サーバーで暗号化してから保存します。" },
  { title: "画像・ファイルは送らない", body: "写真やファイルは送れません。やり取りは文字とスタンプで行います。アイコン画像は、プロフィールとグループだけに使います。" },
  { title: "ブロックと削除", body: "ブロックすると友だちから外れて、トークできなくなります。トークの削除は、自分の画面からだけ消えます。" }
];

const FAQ = [
  { q: "通知に本文を含めるには？", a: "設定の「通知に本文を含める」をオンにします。初めはオフで、「新しいメッセージがあります」と表示されます。本文は通知サービス（Apple・Google）を経由して届きます。" },
  { q: "友だちの追加方法は？", a: "ユーザー名で検索するか、相手のQRコードを読み取ります。相手が許可すると友だちになります。" },
  { q: "ノートはどのくらい表示されますか？", a: "投稿してから24時間で消えます。" },
  { q: "トークを削除すると相手の画面は？", a: "自分の画面からだけ消えます。相手も削除すると、メッセージは完全に消えます。" }
];

export function DemoSite({ onAdminLogin }: { onAdminLogin: () => void }) {
  const [madeBy, setMadeBy] = useState(false);
  // 「© SoraChat」を2回押すと「made by sennin」を出す
  const creditTap = useMultiTap(2, () => setMadeBy(true));
  // 「made by sennin」を3回押すと管理者ログインへ
  const senninTap = useMultiTap(3, onAdminLogin);

  return (
    <div className="demo-site">
      <header className="demo-site-head">
        <a className="demo-site-brand" href="/">
          <span className="demo-site-mark">S</span>
          SoraChat
        </a>
        <nav className="demo-site-nav" aria-label="ページ内の案内">
          <a href="#features">特長</a>
          <a href="#start">はじめ方</a>
          <a href="#safety">安全性</a>
          <a href="#faq">よくある質問</a>
        </nav>
        <a className="demo-site-cta small" href="/">
          はじめる
        </a>
      </header>

      <main className="demo-site-main">
        <section className="demo-site-hero">
          <h1>ひとりひとりの、ちょうどいい会話を。</h1>
          <p>1対1もグループも、文字とスタンプで気軽に。通話・投票・ミニゲームも楽しめる、軽くて速いチャットです。</p>
          <div className="demo-site-actions">
            <a className="demo-site-cta" href="/">
              はじめる
            </a>
            <a className="demo-site-sub" href="/status">
              稼働状況を見る
            </a>
          </div>
        </section>

        <section id="features" className="demo-site-section">
          <h2>特長</h2>
          <div className="demo-site-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="demo-site-card">
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="start" className="demo-site-section">
          <h2>はじめ方</h2>
          <ol className="demo-site-steps">
            {STEPS.map((s) => (
              <li key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="safety" className="demo-site-section">
          <h2>安全性</h2>
          <div className="demo-site-grid">
            {SAFETY.map((s) => (
              <article key={s.title} className="demo-site-card">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="faq" className="demo-site-section">
          <h2>よくある質問</h2>
          <div className="demo-site-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="demo-site-foot">
        <span className="demo-site-credit" onClick={(e) => creditTap(e)}>
          © SoraChat
        </span>
        {madeBy && (
          <span className="demo-site-made" onClick={(e) => senninTap(e)}>
            made by sennin
          </span>
        )}
        <a href="/status">稼働状況</a>
      </footer>
    </div>
  );
}
