// /admin を開いたときに出す、ダミーのデモサイト。
// 中身は見せるためだけの内容で、どこにも遷移しない。下の「管理者ログイン」から本物のログイン画面へ進む。
export function DemoSite({ onAdminLogin }: { onAdminLogin: () => void }) {
  return (
    <div className="demo-site">
      <header className="demo-site-head">
        <span className="demo-site-brand">
          <span className="demo-site-mark">S</span>
          SoraChat デモ
        </span>
        <span className="demo-site-tag">サンプル表示</span>
      </header>

      <main className="demo-site-main">
        <section className="demo-site-hero">
          <h1>ひとりひとりの、ちょうどいい会話を。</h1>
          <p>DMもグループも、写真やスタンプと一緒に気軽に楽しめるチャットです。</p>
          <button type="button" className="demo-site-cta" disabled>
            はじめる
          </button>
        </section>

        <section className="demo-site-cards" aria-label="特長">
          <article>
            <h2>1対1のDM</h2>
            <p>友だちとゆっくり話せる、静かなトーク画面です。</p>
          </article>
          <article>
            <h2>グループ</h2>
            <p>みんなで集まって、予定や話題を共有できます。</p>
          </article>
          <article>
            <h2>スタンプ</h2>
            <p>言葉にしにくい気持ちも、スタンプでひと言。</p>
          </article>
        </section>
      </main>

      <footer className="demo-site-foot">
        <span>© SoraChat</span>
        <button type="button" className="demo-site-admin" onClick={onAdminLogin}>
          管理者ログイン
        </button>
      </footer>
    </div>
  );
}
