/**
 * 通知（アプリ化要件定義.md F2-1・D-1）。
 *
 * 送るのは2種類。
 *   ・**体験セッションの申込**（いちばん大事）。申込画面で「2営業日以内にご連絡します」と
 *     約束しているのに、Admin を開くまで気づけない状態だった。ファネルの終端なので、
 *     取りこぼしがそのまま機会の損失になる
 *   ・**Admin のログイン**。1名運用ゆえの単一障害点への手当て。身に覚えのないログインに気づく
 *
 * Workers から直接SMTPは話せないので、外部のHTTP APIへ投げる。設定は環境変数だけで切り替わる。
 *   ・NOTIFY_WEBHOOK … 任意のURLへ JSON を POST。Slack と Google Chat の Incoming Webhook は
 *     どちらも `text` を読むので、そのまま届く
 *   ・RESEND_API_KEY ＋ NOTIFY_EMAIL_TO ＋ NOTIFY_EMAIL_FROM … Resend でメールを送る
 *
 * **どちらも未設定なら送らない。** その場合は Admin の画面に警告を出して、
 * 「設定し忘れたまま運用している」状態が静かに続かないようにする（notifyConfigured）。
 *
 * 呼び出し側は `ctx.waitUntil()` に渡すこと。**利用者の応答を通知の完了まで待たせない。**
 */
import { maskEmail, maskName } from './admin-format.ts';

export type NotifyEnv = {
  /** 通知先のWebhook。Slack / Google Chat の Incoming Webhook をそのまま入れられる。 */
  NOTIFY_WEBHOOK?: string;
  RESEND_API_KEY?: string;
  NOTIFY_EMAIL_TO?: string;
  NOTIFY_EMAIL_FROM?: string;
  /**
   * 旧名。ログイン通知だけだった頃の名前で、いまも読む（設定済みの環境を壊さないため）。
   * 新しく設定するなら上の名前を使う。
   */
  LOGIN_NOTIFY_WEBHOOK?: string;
  LOGIN_NOTIFY_TO?: string;
  LOGIN_NOTIFY_FROM?: string;
};

/** 新しい名前を優先し、無ければ旧名を読む。 */
function conf(env: NotifyEnv) {
  return {
    webhook: env.NOTIFY_WEBHOOK || env.LOGIN_NOTIFY_WEBHOOK,
    apiKey: env.RESEND_API_KEY,
    to: env.NOTIFY_EMAIL_TO || env.LOGIN_NOTIFY_TO,
    from: env.NOTIFY_EMAIL_FROM || env.LOGIN_NOTIFY_FROM,
  };
}

/** 通知先が設定されているか。未設定なら Admin の画面に警告を出す。 */
export function notifyConfigured(env: NotifyEnv): boolean {
  const c = conf(env);
  return !!(c.webhook || (c.apiKey && c.to && c.from));
}

export type NotifyResult = { sent: boolean; via?: string; error?: string };

/**
 * 実際に送る。件名と本文だけを受け取り、送り先の違いはここで吸収する。
 * 失敗しても呼び出し側の処理は止めない（通知のために申込を落とすほうが困る）。
 */
async function send(env: NotifyEnv, subject: string, body: string): Promise<NotifyResult> {
  const c = conf(env);
  try {
    if (c.webhook) {
      const res = await fetch(c.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Slack も Google Chat も `text` を読む。件名を先頭行にして1つの本文にまとめる。
        body: JSON.stringify({ text: `${subject}\n\n${body}` }),
      });
      if (!res.ok) return { sent: false, via: 'webhook', error: `HTTP ${res.status}` };
      return { sent: true, via: 'webhook' };
    }
    if (c.apiKey && c.to && c.from) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${c.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: c.from, to: [c.to], subject, text: body }),
      });
      if (!res.ok) return { sent: false, via: 'resend', error: `HTTP ${res.status}` };
      return { sent: true, via: 'resend' };
    }
    return { sent: false, error: 'not_configured' };
  } catch (err) {
    return { sent: false, error: String(err) };
  }
}

// ───────── 体験セッションの申込（D-1） ─────────

export type ApplicationEvent = {
  id: string;
  name: string;
  email: string;
  typeCode: string | null;
  typeName: string | null;
  slots: string[];
  concern: string | null;
  /** 到達IDから回答に紐づいたか。付いていないと Admin で手当てが要る（F2-4）。 */
  linked: boolean;
  origin: string;
};

/**
 * 申込が来たことを知らせる。
 *
 * **氏名とメールは伏せる。** 通知の役目は「気づいてAdminを開く」ことで、対応は Admin でする。
 * Slack は検索できて残るので、そこへ個人情報を撒かない（6.2 の「一覧では伏せ、詳細で全表示」と
 * 同じ考え方）。判断に要る情報（タイプ・希望時間帯・紐づいたか）は伏せずに出す。
 */
export async function notifyApplication(env: NotifyEnv, a: ApplicationEvent): Promise<NotifyResult> {
  const body = [
    `お名前：${maskName(a.name)}`,
    `メール：${maskEmail(a.email)}`,
    `タイプ：${a.typeName ? `${a.typeName}（${a.typeCode}）` : (a.typeCode ?? '不明')}`,
    `希望の時間帯：${a.slots.length ? a.slots.join('／') : '指定なし'}`,
    ...(a.concern ? [`気になっていること：${a.concern.slice(0, 120)}${a.concern.length > 120 ? '…' : ''}`] : []),
    a.linked ? '' : '⚠ 回答に紐づいていません。Admin で手当てしてください。',
    '',
    `詳細：${a.origin}/admin/sessions/${a.id}`,
    '',
    '2営業日以内にご連絡すると画面でお約束しています。',
  ].filter((l) => l !== '').join('\n');
  return send(env, '[ナチュール診断] 体験セッションの申込がありました', body);
}

// ───────── Admin のログイン（F2-1） ─────────

export type LoginEvent = {
  email: string;
  at: string;
  ok: boolean;
  /** 生IPは渡さない。ハッシュの先頭だけを識別子として使う（6.2）。 */
  ipHash: string | null;
  userAgent: string | null;
  origin: string;
};

export async function notifyLogin(env: NotifyEnv, e: LoginEvent): Promise<NotifyResult> {
  const subject = e.ok
    ? '[ナチュール診断] Admin にログインがありました'
    : '[ナチュール診断] Admin のログインが連続で失敗しました';
  const body = [
    `日時：${e.at}`,
    `アカウント：${e.email}`,
    `接続元（ハッシュの先頭8文字）：${e.ipHash ? e.ipHash.slice(0, 8) : '不明'}`,
    `ブラウザ：${e.userAgent ?? '不明'}`,
    `サイト：${e.origin}`,
    '',
    '心当たりが無い場合は、すぐにパスワードを変えてください。',
    '手順は app/README.md の「パスワードを忘れた・変えたいとき」にあります。',
  ].join('\n');
  return send(env, subject, body);
}

// ───────── サーバエラー（D-3） ─────────

/**
 * エラー通知の間引き。
 *
 * **壊れたときは同じ壊れ方が連続で起きる。** 素直に毎回送ると、通知先が同じ文面で埋まって
 * かえって気づけなくなる（そして直すあいだじゅう鳴り続ける）。
 * 「同じ壊れ方は窓の中で1回」「別の壊れ方でも窓あたり上限まで」の2段で抑える。
 *
 * 状態は isolate のメモリに置く。**Workers の isolate は入れ替わるので、これは厳密な保証では
 * ない**（入れ替わった直後に同じエラーがもう1通来ることがある）。D1 に持たせる手もあるが、
 * D1 が落ちているときこそエラーが出るので、その経路に依存させたくない。
 * 「鳴り続けないこと」が目的で、重複を完全に消すことではない。
 */
const ERROR_WINDOW_MS = 15 * 60 * 1000;
const ERROR_MAX_PER_WINDOW = 5;

export type ErrorThrottle = { windowStart: number; sent: number; seen: Set<string> };

export function newErrorThrottle(): ErrorThrottle {
  return { windowStart: 0, sent: 0, seen: new Set() };
}

const errorThrottle = newErrorThrottle();

/** 送ってよいか。送ると決めたら、その場で数えて次を抑える。 */
export function shouldNotifyError(
  signature: string,
  now: number = Date.now(),
  state: ErrorThrottle = errorThrottle
): boolean {
  if (now - state.windowStart >= ERROR_WINDOW_MS) {
    state.windowStart = now;
    state.sent = 0;
    state.seen.clear();
  }
  if (state.seen.has(signature)) return false;
  if (state.sent >= ERROR_MAX_PER_WINDOW) return false;
  state.seen.add(signature);
  state.sent += 1;
  return true;
}

/**
 * パスから可変部分を落とす。
 *
 * `/admin/sessions/<uuid>` をそのまま署名に使うと、**同じ壊れ方が件数分だけ別物に見えて**
 * 間引きが効かない。IDらしい部分は種類だけ残す。
 */
export function normalizePath(path: string): string {
  return path
    .split('/')
    .map((seg) => {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return ':id';
      if (/^[0-9a-f]{32,}$/i.test(seg)) return ':id';
      if (/^\d+$/.test(seg)) return ':n';
      return seg;
    })
    .join('/');
}

/** エラーの見出し。これが同じものを「同じ壊れ方」とみなす。 */
export function errorSignature(method: string, path: string, error: unknown): string {
  const e = error as { name?: string; message?: string };
  const name = e?.name ?? typeof error;
  const message = ((e?.message ?? String(error)).split('\n')[0] ?? '').slice(0, 120);
  return `${method} ${normalizePath(path)} ${name}: ${message}`;
}

export type ErrorEvent = {
  method: string;
  path: string;
  error: unknown;
  origin: string;
  at: string;
};

/**
 * 落ちたことを知らせる（アプリ化要件定義.md 6.3）。
 *
 * **クエリ文字列と本文は載せない。** 到達IDやメールが混ざりうるので、経路はパスだけにする。
 * 詳しく見るのはダッシュボードのログ（`[observability] enabled = true`）か `wrangler tail`。
 */
export async function notifyError(env: NotifyEnv, e: ErrorEvent): Promise<NotifyResult> {
  const err = e.error as { name?: string; message?: string; stack?: string };
  const stack = typeof err?.stack === 'string' ? err.stack.split('\n').slice(0, 4).join('\n') : null;
  const body = [
    `日時：${e.at}`,
    `経路：${e.method} ${normalizePath(e.path)}`,
    `エラー：${err?.name ?? typeof e.error}: ${(err?.message ?? String(e.error)).slice(0, 300)}`,
    ...(stack ? ['', stack] : []),
    '',
    `サイト：${e.origin}`,
    '',
    `同じ壊れ方は${ERROR_WINDOW_MS / 60000}分に1回だけ通知します。`,
    '全部を見るには `npx wrangler tail`、または Cloudflare のダッシュボードの Logs を開いてください。',
  ].join('\n');
  return send(env, '[ナチュール診断] サーバエラーが出ました', body);
}
