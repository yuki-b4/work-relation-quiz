/**
 * ナチュール診断 アプリ本体（Cloudflare Workers + Hono）
 *
 * Phase 0 時点の骨組み。ルートの受け口と、全レスポンス共通のヘッダーだけを置く。
 * 中身の実装は Phase 1（アプリ化要件定義.md 第9章）。
 */
import { Hono } from 'hono';
import { submitResponse } from './lib/responses.ts';
import { buildResultCookie, type Limits } from './lib/result-session.ts';
import { sha256Hex } from './lib/hash.ts';

/** Cloudflare のレート制限バインディング（wrangler.toml の [[ratelimits]]）。 */
type RateLimiter = { limit(options: { key: string }): Promise<{ success: boolean }> };

type Bindings = {
  DB: D1Database;
  SUBMIT_LIMIT: RateLimiter;
  APPLY_LIMIT: RateLimiter;
  QUESTION_SET_VERSION: string;
  SITE_NAME: string;
  RESULT_IDLE_MINUTES: string;
  RESULT_MAX_HOURS: string;
  IP_HASH_SALT: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * インデックスさせない経路には X-Robots-Tag と no-store を必ず付ける（F6-3）。
 * Admin は robots.txt に頼らず、認証とこのヘッダーで守る。
 */
const NOINDEX_PREFIXES = ['/result', '/guide', '/apply', '/admin', '/api'];

app.use('*', async (c, next) => {
  await next();
  if (NOINDEX_PREFIXES.some((p) => c.req.path === p || c.req.path.startsWith(p + '/'))) {
    c.header('X-Robots-Tag', 'noindex, nofollow');
    c.header('Cache-Control', 'no-store, private');
  }
});

// ───────── 公開ページ（SSR・index対象。F6-2） ─────────
app.get('/', (c) => c.text('TODO: トップ（診断の説明・開始）'));
app.get('/quiz', (c) => c.text('TODO: 設問24問'));
app.get('/types', (c) => c.text('TODO: 全8タイプ一覧'));
app.get('/types/:code', (c) => c.text(`TODO: タイプ個別 ${c.req.param('code')}`));
app.get('/about', (c) => c.text('TODO: 診断について'));
app.get('/faq', (c) => c.text('TODO: よくある質問'));
app.get('/privacy', (c) => c.text('TODO: プライバシーポリシー'));
app.get('/terms', (c) => c.text('TODO: 利用規約'));
app.get('/contact', (c) => c.text('TODO: お問い合わせ'));

// ───────── ワンタイム（結果セッションで認可。F4） ─────────
app.get('/result', (c) => c.text('TODO: 結果（Cookie＋sessionStorageの3点一致で認可）'));
app.get('/guide', (c) => c.text('TODO: 読み解きガイド全4章'));

// ───────── 申込（タイプ別の共通ページ。認可なし。F4-5） ─────────
app.get('/apply/:typeCode', (c) => c.text(`TODO: 申込フォーム ${c.req.param('typeCode')}`));

// ───────── Admin（認証必須。F2） ─────────
app.all('/admin/*', (c) => c.text('TODO: Admin（認証必須）', 501));

// ───────── API（F1-3） ─────────

/** 結果セッションの有効期限。環境変数で変えられるようにしておく（F4-1）。 */
function limitsOf(c: { env: Bindings }): Limits {
  return {
    idleMinutes: Number(c.env.RESULT_IDLE_MINUTES ?? 30) || 30,
    maxHours: Number(c.env.RESULT_MAX_HOURS ?? 2) || 2,
  };
}

function clientIp(req: Request): string | null {
  return req.headers.get('CF-Connecting-IP') ?? null;
}

/**
 * 診断の回答を受け取り、保存して結果セッションを発行する。
 *
 * 返すのは tabToken だけ。呼び出し側はこれを sessionStorage に入れてから /result へ進む。
 * 結果セッションのCookieは Set-Cookie で返る（HttpOnly なのでJSからは読めない。F4-2）。
 * responseId は返さない。クライアントが持つ必要がなく、持たせると漏れる面が増えるため。
 */
app.post('/api/responses', async (c) => {
  const ip = clientIp(c.req.raw);
  if (c.env.SUBMIT_LIMIT && ip) {
    // レート制限のキーにも生IPを渡さない。ハッシュでも同一IPは同じ値になるので機能は変わらず、
    // 「生IPはリクエストの処理から外へ出さない」を保てる（アプリ化要件定義.md 6.2）。
    const { success } = await c.env.SUBMIT_LIMIT.limit({ key: await sha256Hex(ip) });
    if (!success) return c.json({ ok: false, error: 'rate_limited' }, 429);
  }

  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'invalid_json' }, 400);
  }

  const result = await submitResponse(c.env.DB, payload as Record<string, unknown>, {
    ip,
    userAgent: c.req.header('User-Agent') ?? null,
    ipHashSalt: c.env.IP_HASH_SALT,
    questionSetVersion: c.env.QUESTION_SET_VERSION,
    limits: limitsOf(c),
  });

  if (!result.ok) {
    return c.json({ ok: false, error: 'invalid_answers', details: result.errors }, 400);
  }

  c.header('Set-Cookie', buildResultCookie(result.sessionId));
  return c.json({ ok: true, tabToken: result.tabToken, duplicate: result.duplicate });
});
app.post('/api/responses/:id/hearing', (c) => c.json({ todo: 'hearing' }, 501));
app.post('/api/result/close', (c) => c.json({ todo: 'close result session' }, 501));
app.post('/api/guide/progress', (c) => c.json({ todo: 'guide progress' }, 501));
app.post('/api/apply-visits', (c) => c.json({ todo: 'record apply visit' }, 501));
app.post('/api/session-applications', (c) => c.json({ todo: 'session application' }, 501));
app.post('/api/corp-leads', (c) => c.json({ todo: 'corp lead' }, 501));

/** DBに繋がっているかの確認用。Phase 0 のセットアップ確認に使う。 */
app.get('/api/health', async (c) => {
  const row = await c.env.DB.prepare(
    "select count(*) as n from sqlite_master where type='table'"
  ).first<{ n: number }>();
  return c.json({
    ok: true,
    tables: row?.n ?? 0,
    questionSetVersion: c.env.QUESTION_SET_VERSION,
  });
});

export default app;
