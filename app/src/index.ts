/**
 * ナチュール診断 アプリ本体（Cloudflare Workers + Hono）
 *
 * Phase 0 時点の骨組み。ルートの受け口と、全レスポンス共通のヘッダーだけを置く。
 * 中身の実装は Phase 1（アプリ化要件定義.md 第9章）。
 */
import { Hono } from 'hono';
import { declarationText, parseDeclaration } from './lib/declaration.ts';
import { submitResponse } from './lib/responses.ts';
import { buildResultCookie, type Limits } from './lib/result-session.ts';
import { sha256Hex } from './lib/hash.ts';
import {
  closeResultSession, closeSessionsForResponse, evaluate, isoNow,
  loadResultSession, readResultCookie, touchResultSession, clearResultCookie,
} from './lib/result-session.ts';
import { renderResultCard } from './views/result.ts';
import { randomToken } from './lib/result-session.ts';
import { resultShell } from './views/result-page.ts';
import { closedPage, errorPage, notFoundPage } from './views/layout.ts';
import { topPage } from './views/quiz-page.ts';
import { guideShell } from './views/guide-page.ts';
import { applyPage, SLOTS } from './views/apply-page.ts';
import { typesIndexPage, typeDetailPage } from './views/types-page.ts';
import { INFO_PATHS, infoPage } from './views/info-page.ts';
import { GUIDE_CHAPTERS } from './content/guide-chapters.ts';
import { TYPES, TYPE_CODES } from './content/types.ts';
import { RADAR_AXES } from './content/quiz.ts';
import { admin } from './routes/admin.ts';
import { adminPage } from './views/admin/layout.ts';
import { apexUrl } from './lib/canonical-host.ts';
import { errorSignature, notifyApplication, notifyError, shouldNotifyError } from './lib/notify.ts';
import ogpImage from '../assets/ogp.png';
import faviconIco from '../assets/favicon.ico';
import faviconSvg from '../assets/favicon.svg';
import appleTouchIcon from '../assets/apple-touch-icon.png';
import type { TypeCode } from './content/types.ts';

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
  /** Admin（F2）。初期アカウントの作成とログイン通知に使う。無くても動く。 */
  ADMIN_BOOTSTRAP_EMAIL?: string;
  ADMIN_BOOTSTRAP_PASSWORD?: string;
  /** 通知先（申込とログイン）。NOTIFY_* が新しい名前で、LOGIN_NOTIFY_* は旧名。 */
  NOTIFY_WEBHOOK?: string;
  RESEND_API_KEY?: string;
  NOTIFY_EMAIL_TO?: string;
  NOTIFY_EMAIL_FROM?: string;
  LOGIN_NOTIFY_WEBHOOK?: string;
  LOGIN_NOTIFY_TO?: string;
  LOGIN_NOTIFY_FROM?: string;
  LOGIN_LIMIT?: RateLimiter;
  /**
   * 本番かどうか（D-3）。ステージングでは "preview" が入る。
   * 入っていると全ページを noindex にする。**本番と同じ中身が2箇所で配信されるので、
   * 寄せないと検索エンジンから見て複製サイトになる**（www を apex へ寄せたのと同じ理由）。
   */
  ENVIRONMENT?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * インデックスさせない経路には X-Robots-Tag と no-store を必ず付ける（F6-3）。
 * Admin は robots.txt に頼らず、認証とこのヘッダーで守る。
 */
const NOINDEX_PREFIXES = ['/result', '/guide', '/apply', '/admin', '/api'];

/**
 * www は apex へ 301（F6-4）。**ほかのどの処理よりも先に置く。**
 * 両方をカスタムドメインにしているので、寄せないと同じ内容が2つのホストで配信され、
 * canonical もそれぞれ自分を指して、検索エンジンからは別サイトが2つあるように見える。
 */
app.use('*', async (c, next) => {
  const to = apexUrl(c.req.url);
  if (to) return c.redirect(to, 301);
  return next();
});

/** 本番以外（ステージング）か。ENVIRONMENT が入っているのは本番以外だけ（D-3）。 */
const isStaging = (env: { ENVIRONMENT?: string }) => !!env.ENVIRONMENT && env.ENVIRONMENT !== 'production';

app.use('*', async (c, next) => {
  await next();
  // ステージングは中身が本番と同じなので、**1ページ残らず** noindex にする（D-3）。
  // robots.txt でも Disallow: / を返すが、robots.txt は「読まないで」であって
  // 「載せないで」ではない。載せない指示はこのヘッダーで出す。
  if (isStaging(c.env)) c.header('X-Robots-Tag', 'noindex, nofollow');
  if (NOINDEX_PREFIXES.some((p) => c.req.path === p || c.req.path.startsWith(p + '/'))) {
    c.header('X-Robots-Tag', 'noindex, nofollow');
    c.header('Cache-Control', 'no-store, private');
  }
  // Admin は他サイトの iframe に入れさせない。Cookie が SameSite=Strict でも、
  // 埋め込まれた画面を透明にして押させる手口（クリックジャッキング）は防げない（6.1）。
  if (c.req.path === '/admin' || c.req.path.startsWith('/admin/')) {
    c.header('X-Frame-Options', 'DENY');
    c.header('Content-Security-Policy', "frame-ancestors 'none'");
    c.header('Referrer-Policy', 'same-origin');
  }
});

// ───────── 公開ページ（SSR・index対象。F6-2） ─────────

/**
 * そのリクエストのオリジン。canonical・OGP・sitemap・共有URLに使う。
 *
 * scheme は自分で決める。前段のCloudflareやローカル開発の都合で http のまま
 * 渡ってくることがあり、そのまま canonical に載せると誤ったURLを正規化してしまう。
 * ローカル以外は必ず https にする。
 */
function originOf(c: { req: { url: string } }): string {
  const u = new URL(c.req.url);
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname.endsWith('.local');
  return `${local ? u.protocol.replace(':', '') : 'https'}://${u.host}`;
}

/**
 * トップ。イントロ・フレーム・設問24問を1枚に入れて、表示を切り替える（F3-1）。
 * 診断中もURLは / のままなので、canonical の重複が起きない。
 */
app.get('/', (c) => c.html(topPage(originOf(c))));

/** 設問は / の中で進むので、/quiz は入口へ寄せる（F6-4：重複インデックスを作らない）。 */
app.get('/quiz', (c) => c.redirect('/', 301));

/**
 * GitHub Pages 時代のURLからの引き継ぎ（F6-4）。
 * 拡散済みのリンクを切らさず、評価も新URLへ渡す。
 */
app.get('/prototype.html', (c) => c.redirect('/', 301));
app.get('/index.html', (c) => c.redirect('/', 301));
app.get('/all-types.html', (c) => c.redirect('/types', 301));
app.get('/types', (c) => c.html(typesIndexPage(originOf(c))));

app.get('/types/:code', (c) => {
  const code = c.req.param('code');
  if (!(code in TYPES)) return c.notFound();
  return c.html(typeDetailPage(code as keyof typeof TYPES, originOf(c)));
});
/**
 * 情報ページ（F6-2）。中身は文面の正から機械的に写したもので、この経路は器を返すだけ。
 * `/privacy` は申込フォームの同意リンク先でもあるので、欠かすと同意が成立しない。
 */
for (const [path, key] of Object.entries(INFO_PATHS)) {
  app.get(path, (c) => c.html(infoPage(key, originOf(c))));
}

// ───────── ワンタイム（結果セッションで認可。F4） ─────────
/**
 * 結果画面。Cookie だけを先に見て、駄目ならその場で 410（F4-4）。
 * 通ればシェルを返し、タブ照合値の突き合わせは /api/result/view で行う。
 */
app.get('/result', async (c) => {
  const id = readResultCookie(c.req.header('Cookie'));
  if (!id) return c.html(closedPage(), 410);
  const row = await loadResultSession(c.env.DB, id);
  // ここではタブ照合値を見ない（サーバに届かないため）。閉じた・失効だけを弾く。
  const v = evaluate(row, row?.tab_token ?? null, isoNow(), limitsOf(c));
  if (!v.ok) return c.html(closedPage(), 410);
  return c.html(resultShell());
});

/** 失効後の案内画面。シェルからここへ飛ばす。 */
app.get('/result/closed', (c) => c.html(closedPage(), 410));
/** 読み解きガイド。結果画面と同じくCookieを先に見て、タブ照合値は /api/guide/view で見る。 */
app.get('/guide', async (c) => {
  const id = readResultCookie(c.req.header('Cookie'));
  if (!id) return c.html(closedPage(), 410);
  const row = await loadResultSession(c.env.DB, id);
  const v = evaluate(row, row?.tab_token ?? null, isoNow(), limitsOf(c));
  if (!v.ok) return c.html(closedPage(), 410);
  return c.html(guideShell());
});

// ───────── 申込（タイプ別の共通ページ。認可なし。F4-5） ─────────
/**
 * 申込フォーム。タイプ別の共通ページで、認可は無い（F4-5）。
 * ?v= は到達IDで、これ自体は何の権限も与えない（付いていても結果は見えない）。
 */
app.get('/apply/:typeCode', (c) => {
  const code = c.req.param('typeCode');
  if (!(code in TYPES)) return c.notFound();
  const v = c.req.query('v');
  return c.html(applyPage(code as keyof typeof TYPES, /^[0-9a-f]{64}$/.test(v ?? '') ? v! : null));
});

// ───────── Admin（認証必須。F2） ─────────
// 経路の中身は routes/admin.ts。全レスポンスの noindex と no-store は上の共通処理が付ける。
app.route('/admin', admin);

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

type AuthOk = { ok: true; sessionId: string; responseId: string; body: Record<string, unknown> };
type AuthNg = { ok: false; status: 400 | 410; reason: string };

/**
 * 3点一致の共通処理。Cookie とタブ照合値を突き合わせ、通れば responseId を返す。
 * /result・/guide・ヒアリング・到達記録が、すべてこれを通る（F4-2）。
 *
 * リクエスト本文は**ここで一度だけ読み**、呼び出し側へ渡す。
 * 本文は一度しか読めないので、呼び出し側で読み直すと必ず失敗する。
 */
async function authorize(
  c: { env: Bindings; req: { header(name: string): string | undefined; json(): Promise<unknown> } }
): Promise<AuthOk | AuthNg> {
  const sessionId = readResultCookie(c.req.header('Cookie'));
  if (!sessionId) return { ok: false, status: 410, reason: 'not_found' };
  let body: Record<string, unknown> = {};
  try {
    body = ((await c.req.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return { ok: false, status: 400, reason: 'invalid_json' };
  }
  const tabToken = typeof body.tabToken === 'string' ? body.tabToken : null;
  const now = isoNow();
  const row = await loadResultSession(c.env.DB, sessionId);
  const v = evaluate(row, tabToken, now, limitsOf(c));
  if (!v.ok) return { ok: false, status: 410, reason: v.reason };
  await touchResultSession(c.env.DB, sessionId, now);
  return { ok: true, sessionId, responseId: v.responseId, body };
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
/**
 * 商談前ヒアリング（すべて任意）。回答IDはクライアントに渡していないので、
 * 要件の /api/responses/:id/hearing ではなく、結果セッションで本人を特定する。
 */
app.post('/api/hearing', async (c) => {
  const a = await authorize(c);
  if (!a.ok) return c.json({ ok: false, reason: a.reason }, a.status);
  const nowText = typeof a.body.now === 'string' ? a.body.now.slice(0, 4000) : '';
  const futureText = typeof a.body.future === 'string' ? a.body.future.slice(0, 4000) : '';
  const at = isoNow();
  await c.env.DB.prepare(
    `insert into hearings (response_id, now_text, future_text, created_at, updated_at)
     values (?,?,?,?,?)
     on conflict(response_id) do update set now_text=excluded.now_text,
       future_text=excluded.future_text, updated_at=excluded.updated_at`
  ).bind(a.responseId, nowText, futureText, at, at).run();
  return c.json({ ok: true });
});

/** ガイド本文。その人のタイプの4章だけを返す。 */
app.post('/api/guide/view', async (c) => {
  const a = await authorize(c);
  if (!a.ok) return c.json({ ok: false, reason: a.reason }, a.status);
  const r = await c.env.DB.prepare(
    `select type_code from responses where id = ? and deleted_at is null`
  ).bind(a.responseId).first<{ type_code: string }>();
  if (!r) return c.json({ ok: false, reason: 'not_found' }, 410);
  const chapters = GUIDE_CHAPTERS[r.type_code];
  if (!chapters) return c.json({ ok: false, reason: 'not_found' }, 410);
  const t = TYPES[r.type_code as keyof typeof TYPES];
  await c.env.DB.prepare(
    `update responses set guide_opened_at = coalesce(guide_opened_at, ?) where id = ?`
  ).bind(isoNow(), a.responseId).run();
  return c.json({ ok: true, typeCode: r.type_code, guard: t.pole === 'guard', chapters });
});
/**
 * 3つの鍵を突き合わせ、通れば結果カードのHTMLを返す（F4-2）。
 * 返すのはその人の結果だけ。他タイプの文面はブラウザへ配らない。
 */
app.post('/api/result/view', async (c) => {
  const a = await authorize(c);
  if (!a.ok) return c.json({ ok: false, reason: a.reason }, a.status);

  const r = await c.env.DB.prepare(
    `select type_code, axis_counts, declared_at,
            radar_safety, radar_trust, radar_bound, radar_conflict, radar_connect
       from responses where id = ? and deleted_at is null`
  )
    .bind(a.responseId)
    .first<Record<string, string | number | null>>();
  if (!r) return c.json({ ok: false, reason: 'not_found' }, 410);

  const radar = Object.fromEntries(
    RADAR_AXES.map((a) => [a, Number(r[`radar_${a}`] ?? 0)])
  ) as Record<(typeof RADAR_AXES)[number], number>;

  const html = renderResultCard({
    code: r.type_code as TypeCode,
    counts: JSON.parse(String(r.axis_counts ?? '{}')),
    radar,
    origin: originOf(c),
  });
  // declared は宣言のフォーク（施策a 段1・A-1）を出すかどうかの判断だけに使う。
  // 一度宣言した人に、戻ってくるたび同じ設問を出さない。
  // guard はフォークの色。結果カードの外にある画面なので、渡さないと既定色のままになる。
  return c.json({
    ok: true, html, declared: !!r.declared_at,
    guard: TYPES[r.type_code as keyof typeof TYPES]?.pole === 'guard',
  });
});

/**
 * 宣言（施策a 段1・A-1）。結果画面の直後のフォークから届く。
 *
 * 正：集客戦略マップ.md §3.6・§3.8
 * 回答IDはクライアントに渡していないので、ヒアリングと同じく結果セッションで本人を特定する。
 *
 * `declared_at` は**最初の宣言の時刻を残す**（宣言率の分母・分子はこの時刻で数える）。
 * 選び直された場合は、中身だけを新しいほうへ更新する。
 */
app.post('/api/declaration', async (c) => {
  const a = await authorize(c);
  if (!a.ok) return c.json({ ok: false, reason: a.reason }, a.status);
  const parsed = parseDeclaration({
    domain: a.body.domain, target: a.body.target, deadline: a.body.deadline,
  });
  if (!parsed.ok) return c.json({ ok: false, message: parsed.message }, 400);
  const d = parsed.value;
  await c.env.DB.prepare(
    `update responses
        set concern_domain = ?, concern_target = ?, concern_deadline = ?,
            declared_at = coalesce(declared_at, ?)
      where id = ? and deleted_at is null`
  ).bind(d.domain, d.target, d.deadline, isoNow(), a.responseId).run();
  return c.json({ ok: true });
});

/**
 * フォークを**出した**ことの記録（施策a 段1・A-1）。
 *
 * 宣言そのもの（`/api/declaration`）とは別に取る。
 * **宣言率だけでは、フォークを出していないのか、出して無視されたのかが分からない。**
 * 直す先が「出し方」なのか「中身」なのかを分けるために、出した時刻と出し方を残す。
 *
 * 最初の1回だけを残す（coalesce）。閉じてから押し直しても、出し方は最初のものを正とする。
 */
app.post('/api/declaration/prompt', async (c) => {
  const a = await authorize(c);
  if (!a.ok) return c.json({ ok: false, reason: a.reason }, a.status);
  const via = a.body.via === 'auto' ? 'auto' : 'cta';
  await c.env.DB.prepare(
    `update responses
        set declare_prompted_at = coalesce(declare_prompted_at, ?),
            declare_prompt_via  = coalesce(declare_prompt_via, ?)
      where id = ? and deleted_at is null`
  ).bind(isoNow(), via, a.responseId).run();
  return c.json({ ok: true });
});

/** 「結果を閉じる」「もう一度診断する」。以後この結果は開けなくなる（F4-1）。 */
app.post('/api/result/close', async (c) => {
  const id = readResultCookie(c.req.header('Cookie'));
  if (!id) return c.json({ ok: true });

  let reason: 'user_close' | 'retake' = 'user_close';
  try {
    const body = (await c.req.json()) as { reason?: unknown };
    if (body.reason === 'retake') reason = 'retake';
  } catch {
    // 本文が無くても閉じる
  }

  const row = await loadResultSession(c.env.DB, id);
  if (row) {
    // 同じ回答に紐づくセッションはまとめて閉じる（別タブで開いていた分も残さない）
    await closeSessionsForResponse(c.env.DB, row.response_id, reason);
  } else {
    await closeResultSession(c.env.DB, id, reason);
  }
  c.header('Set-Cookie', clearResultCookie());
  return c.json({ ok: true });
});
/** どの章まで進んだか。終章（3）に着いた時刻も残す。 */
app.post('/api/guide/progress', async (c) => {
  const a = await authorize(c);
  if (!a.ok) return c.json({ ok: false, reason: a.reason }, a.status);
  const chapter = Number(a.body.chapter);
  if (!Number.isInteger(chapter) || chapter < 0 || chapter > 3) {
    return c.json({ ok: false, reason: 'invalid_chapter' }, 400);
  }
  await c.env.DB.prepare(
    `update responses
        set guide_max_chapter = max(coalesce(guide_max_chapter, -1), ?),
            guide_completed_at = case when ? = 3 then coalesce(guide_completed_at, ?) else guide_completed_at end
      where id = ?`
  ).bind(chapter, chapter, isoNow(), a.responseId).run();
  return c.json({ ok: true });
});
/**
 * 申込フォームへの到達を記録し、開くURLを返す（F4-5）。
 * 到達IDは推測不能なランダム値。連番だと他人の回答に自分の申込を紐づけられる。
 */
app.post('/api/apply-visits', async (c) => {
  const a = await authorize(c);
  if (!a.ok) return c.json({ ok: false, reason: a.reason }, a.status);
  const cta = a.body.cta === 'epilogue-2' ? 'epilogue-2' : 'epilogue-1';
  const r = await c.env.DB.prepare(
    `select type_code from responses where id = ? and deleted_at is null`
  ).bind(a.responseId).first<{ type_code: string }>();
  if (!r) return c.json({ ok: false, reason: 'not_found' }, 410);

  const visitId = randomToken();
  await c.env.DB.prepare(
    `insert into apply_visits (id, response_id, visited_at, cta) values (?,?,?,?)`
  ).bind(visitId, a.responseId, isoNow(), cta).run();

  // フォームはタイプ別の共通ページ。?v= は紐づけのためだけの印で、権限は何も与えない。
  return c.json({ ok: true, url: `/apply/${r.type_code}?v=${visitId}` });
});
/**
 * 体験セッションの申込。
 * response_id はクライアントから受け取らず、**到達ID からサーバ側で解決する**（F4-5）。
 */
app.post('/api/session-applications', async (c) => {
  const ip = clientIp(c.req.raw);
  if (c.env.APPLY_LIMIT && ip) {
    const { success } = await c.env.APPLY_LIMIT.limit({ key: await sha256Hex(ip) });
    if (!success) return c.json({ ok: false, error: 'rate_limited' }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = ((await c.req.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return c.json({ ok: false, message: '送信内容を読み取れませんでした。' }, 400);
  }

  // honeypot。人には見えない欄が埋まっていたらボット。成功したように見せて捨てる。
  if (typeof body.website === 'string' && body.website.trim()) return c.json({ ok: true });

  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const name = str(body.name, 100);
  const email = str(body.email, 200);
  if (!name) return c.json({ ok: false, message: 'お名前を入力してください。' }, 400);
  // 厳密な検証はしない。届かないアドレスは弾けないので、明らかな形だけ見る。
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ ok: false, message: 'メールアドレスの形式をご確認ください。' }, 400);
  }

  const typeCode = str(body.typeCode, 8);
  if (!(typeCode in TYPES)) return c.json({ ok: false, message: 'タイプが不正です。' }, 400);

  // **申込フォームでは宣言を聞かない**（2026-09-12）。宣言はフォーク（A-1）で取る1か所だけ。
  // フォークで宣言していればその値を当日に使い、していなければ体験セッションの場で聞く
  // （§4.2 の1段目）。同じことを2回聞かないぶん、フォームの摩擦も増やさない。

  const slots = Array.isArray(body.slots)
    ? body.slots.filter((x): x is string => typeof x === 'string' && (SLOTS as readonly string[]).includes(x))
    : [];

  // 到達IDから回答を引く。無ければ未紐づけで登録し、Adminで手動紐づけする（F2-4）。
  const visitId = /^[0-9a-f]{64}$/.test(str(body.v, 64)) ? str(body.v, 64) : null;
  let responseId: string | null = null;
  if (visitId) {
    const hit = await c.env.DB.prepare(`select response_id from apply_visits where id = ?`)
      .bind(visitId)
      .first<{ response_id: string }>();
    responseId = hit?.response_id ?? null;
  }

  // 紐づいた回答の宣言を1回だけ引く。**申込フォームでは聞かない**ので、
  // 当日の材料になるのはフォークで宣言した値だけ（無ければセッションで聞く）。
  const declaration = responseId
    ? await c.env.DB.prepare(
        `select concern_domain, concern_target, concern_deadline
           from responses where id = ? and deleted_at is null`
      ).bind(responseId).first<Record<string, string | null>>()
    : null;

  const applicationId = crypto.randomUUID();
  const concern = str(body.concern, 4000) || null;
  await c.env.DB.prepare(
    `insert into session_applications
       (id, created_at, apply_visit_id, response_id, type_code, name, email,
        concern, preferred_slots, question, source, status)
     values (?,?,?,?,?,?,?,?,?,?, 'in-app', '未対応')`
  )
    .bind(
      applicationId, isoNow(), visitId, responseId, typeCode, name, email,
      concern, JSON.stringify(slots), str(body.question, 4000) || null
    )
    .run();

  // 申込が来たことを知らせる（D-1）。**待たせない**ので waitUntil に投げる。
  // 通知が失敗しても申込は成立させる（通知のために申込を落とすほうが困る）。
  c.executionCtx.waitUntil(
    notifyApplication(c.env, {
      id: applicationId,
      name,
      email,
      typeCode,
      typeName: TYPES[typeCode as keyof typeof TYPES]?.name ?? null,
      slots,
      concern,
      // フォークでの宣言（A-1）。**当日はここの読み上げから始める**（§4.2 の1）。
      // 無ければセッションの場で聞くので、通知では「未宣言」と分かればよい。
      declaration: declarationText(declaration ?? {}),
      linked: !!responseId,
      origin: originOf(c),
    })
  );

  return c.json({ ok: true });
});

/** X共有ボタンのクリック（F5-5）。回数と初回時刻だけ残す。 */
app.post('/api/share', async (c) => {
  const a = await authorize(c);
  if (!a.ok) return c.json({ ok: false, reason: a.reason }, a.status);
  await c.env.DB.prepare(
    `update responses set shared_at = coalesce(shared_at, ?), share_count = share_count + 1 where id = ?`
  ).bind(isoNow(), a.responseId).run();
  return c.json({ ok: true });
});
app.post('/api/corp-leads', (c) => c.json({ todo: 'corp lead' }, 501));

/**
 * robots.txt（F6-4）。
 * Adminは Disallow に書かない。書くとパスを晒すうえ、クロールを止めると noindex を
 * 読ませることすらできない。認証と X-Robots-Tag で守る（F6-3）。
 */
app.get('/robots.txt', (c) => {
  const origin = originOf(c);
  // ステージングは丸ごと拒否する（D-3）。sitemap も出さない。
  if (isStaging(c.env)) {
    return c.text('User-agent: *\nDisallow: /\n', 200, { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  return c.text(
    [
      'User-agent: *',
      'Disallow: /api/',
      'Disallow: /result',
      'Disallow: /guide',
      'Disallow: /apply/',
      '',
      // AI学習クローラは弾く。AI検索・エージェントは通す（確認事項11＝a・F8-1）。
      // 実際の遮断はエッジ側で行う。ここは宣言（F8-2）。
      ...['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended', 'Bytespider',
          'Meta-ExternalAgent', 'Amazonbot', 'Applebot-Extended', 'cohere-ai',
          'Diffbot', 'Omgilibot', 'PanguBot', 'Timpibot'].flatMap((ua) => [`User-agent: ${ua}`, 'Disallow: /', '']),
      `Sitemap: ${origin}/sitemap.xml`,
      '',
    ].join('\n'),
    200,
    { 'Content-Type': 'text/plain; charset=utf-8' }
  );
});

/**
 * OGP画像（F7-3）。1200×630。`npm run ogp` で作り直せる（tools/make-ogp.mjs）。
 *
 * Worker に同梱しているので、外部のストレージも追加の設定も要らない。
 * 中身が変わるのは画像を作り直したときだけなので、長めにキャッシュさせる。
 * 差し替えたら、SNS側のキャッシュを切るために `?v=` を付けて参照する手もある。
 */
app.get('/ogp.png', (c) =>
  c.body(ogpImage, 200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=86400, s-maxage=604800',
  })
);

/**
 * favicon 一式（D-4）。`npm run favicon` で作り直せる（tools/make-favicon.mjs）。
 *
 * 3つ置くのは、見に来る相手が違うから。
 *   ・`/favicon.svg`          対応ブラウザ。どの大きさでも滲まない
 *   ・`/favicon.ico`          <link> を読まずに直接取りに来る相手（RSSリーダー、古いブラウザ）
 *   ・`/apple-touch-icon.png` iOS のホーム画面。**透過にしない**（黒地に合成される）
 *
 * OGP画像と同じく Worker に同梱している。差し替えの頻度が低いので長めにキャッシュさせる。
 */
const ICON_CACHE = 'public, max-age=86400, s-maxage=604800';

app.get('/favicon.ico', (c) =>
  c.body(faviconIco, 200, { 'Content-Type': 'image/x-icon', 'Cache-Control': ICON_CACHE })
);
app.get('/favicon.svg', (c) =>
  c.body(faviconSvg, 200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': ICON_CACHE })
);
app.get('/apple-touch-icon.png', (c) =>
  c.body(appleTouchIcon, 200, { 'Content-Type': 'image/png', 'Cache-Control': ICON_CACHE })
);

/** sitemap.xml（F6-4）。index対象だけを載せる。 */
app.get('/sitemap.xml', (c) => {
  const origin = originOf(c);
  const urls = [
    '/', '/types', ...TYPE_CODES.map((code) => `/types/${code}`),
    ...Object.keys(INFO_PATHS),
  ];
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls.map((u) => `<url><loc>${origin}${u}</loc></url>`).join('') +
    '</urlset>';
  return c.body(body, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
});

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

/**
 * どのルートにも当たらなかったとき（D-4）。
 *
 * Hono の既定は素のテキストなので、打ち間違えた人がそこで行き止まりになる。
 * API は JSON を返す（404のHTMLを fetch 側に渡しても読めない）。
 */
app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ ok: false, message: 'そのURLはありません。' }, 404);
  }
  // Admin から来た 404（IDの打ち間違い、`/admin/bootstrap` の封鎖）に、
  // 「診断を受ける」ボタンの付いた公開ページを返しても行き先にならない。
  // ログイン前でも見えるので、ここには一覧へのリンク以外を置かない。
  if (c.req.path === '/admin' || c.req.path.startsWith('/admin/')) {
    return c.html(
      adminPage(
        { title: '見つかりません', nav: 'none' },
        '<h1>見つかりません</h1>' +
        '<p>そのURLはありません。アドレスを確かめてください。</p>' +
        '<p><a href="/admin/responses">回答一覧へ</a></p>'
      ),
      404
    );
  }
  return c.html(notFoundPage(), 404);
});

/**
 * 落ちたときの受け口（アプリ化要件定義.md 6.3・D-3）。
 *
 * これが無いと、500が出続けても誰も気づかないまま日が過ぎる。ログはダッシュボードに
 * 出ているが、**見に行かないと分からないものは監視ではない**。
 *
 * 通知は `waitUntil` に投げる。エラー画面を通知の完了まで待たせない（届かない先を
 * 設定していると、そのぶん利用者が待たされる）。間引きは shouldNotifyError が持つ。
 *
 * API は JSON を返す。エラー画面のHTMLを fetch 側に渡しても読めない。
 */
app.onError((err, c) => {
  // 通知が未設定でも、ログには必ず残す。observability が拾う。
  console.error('unhandled error', c.req.method, c.req.path, err);

  try {
    if (shouldNotifyError(errorSignature(c.req.method, c.req.path, err))) {
      c.executionCtx.waitUntil(
        notifyError(c.env, {
          method: c.req.method, path: c.req.path, error: err,
          origin: originOf(c), at: isoNow(),
        })
      );
    }
  } catch {
    // 通知の失敗でエラー画面まで壊さない。ここで投げ直すと 500 すら返せなくなる。
  }

  if (c.req.path.startsWith('/api/')) {
    return c.json({ ok: false, message: '一時的な不具合が起きています。時間をおいてお試しください。' }, 500);
  }
  return c.html(errorPage(), 500);
});

export default app;
