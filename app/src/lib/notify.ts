/**
 * ログイン通知（アプリ化要件定義.md F2-1）。
 *
 * 「1名運用ゆえの単一障害点」への手当ての2つめ。**身に覚えのないログインに気づける**ことが
 * 目的なので、届け先はどこでもよい（メール・Slack・自分だけのWebhook）。
 *
 * Workers から直接SMTPは話せないので、外部のHTTP APIへ投げる。設定は環境変数だけで切り替わる。
 *   ・LOGIN_NOTIFY_WEBHOOK … 任意のURLへ JSON を POST（Slack の Incoming Webhook もこれで届く）
 *   ・RESEND_API_KEY ＋ LOGIN_NOTIFY_TO ＋ LOGIN_NOTIFY_FROM … Resend でメールを送る
 *
 * **どちらも未設定なら送らない。** その場合は Admin の画面に警告を出して、
 * 「設定し忘れたまま運用している」状態が静かに続かないようにする（adminNotifyConfigured）。
 */

export type NotifyEnv = {
  LOGIN_NOTIFY_WEBHOOK?: string;
  RESEND_API_KEY?: string;
  LOGIN_NOTIFY_TO?: string;
  LOGIN_NOTIFY_FROM?: string;
};

export type LoginEvent = {
  email: string;
  at: string;
  ok: boolean;
  /** 生IPは渡さない。ハッシュの先頭だけを識別子として使う（6.2）。 */
  ipHash: string | null;
  userAgent: string | null;
  origin: string;
};

/** 通知先が設定されているか。未設定なら画面に警告を出す。 */
export function notifyConfigured(env: NotifyEnv): boolean {
  return !!(env.LOGIN_NOTIFY_WEBHOOK || (env.RESEND_API_KEY && env.LOGIN_NOTIFY_TO && env.LOGIN_NOTIFY_FROM));
}

function subjectOf(e: LoginEvent): string {
  return e.ok ? '[ナチュール診断] Admin にログインがありました' : '[ナチュール診断] Admin のログインが連続で失敗しました';
}

function bodyOf(e: LoginEvent): string {
  return [
    subjectOf(e),
    '',
    `日時：${e.at}`,
    `アカウント：${e.email}`,
    `接続元（ハッシュの先頭8文字）：${e.ipHash ? e.ipHash.slice(0, 8) : '不明'}`,
    `ブラウザ：${e.userAgent ?? '不明'}`,
    `サイト：${e.origin}`,
    '',
    '心当たりが無い場合は、すぐにパスワードを変えてください。',
    '手順は app/README.md の「パスワードを忘れた・変えたいとき」にあります。',
  ].join('\n');
}

/**
 * 送る。呼び出し側は `ctx.waitUntil()` に渡してよい（ログインの応答を待たせない）。
 * 送信の成否は返すが、失敗してもログインは通す。
 */
export async function notifyLogin(env: NotifyEnv, e: LoginEvent): Promise<{ sent: boolean; via?: string; error?: string }> {
  try {
    if (env.LOGIN_NOTIFY_WEBHOOK) {
      const res = await fetch(env.LOGIN_NOTIFY_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Slack の Incoming Webhook は text を見る。ほかの受け口のために構造化した値も入れる。
        body: JSON.stringify({ text: bodyOf(e), event: 'admin_login', ...e }),
      });
      if (!res.ok) return { sent: false, via: 'webhook', error: `HTTP ${res.status}` };
      return { sent: true, via: 'webhook' };
    }
    if (env.RESEND_API_KEY && env.LOGIN_NOTIFY_TO && env.LOGIN_NOTIFY_FROM) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.LOGIN_NOTIFY_FROM,
          to: [env.LOGIN_NOTIFY_TO],
          subject: subjectOf(e),
          text: bodyOf(e),
        }),
      });
      if (!res.ok) return { sent: false, via: 'resend', error: `HTTP ${res.status}` };
      return { sent: true, via: 'resend' };
    }
    return { sent: false, error: 'not_configured' };
  } catch (err) {
    return { sent: false, error: String(err) };
  }
}
