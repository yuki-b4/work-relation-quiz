/**
 * Admin の経路（アプリ化要件定義.md F2）。
 *
 * 画面はサーバ側で描いて、更新は素のフォームPOST（＋PRG）で受ける。
 * 1名運用の管理画面に、状態を持つクライアントを載せる理由がない。
 *
 * 守っていること：
 *   ・/admin/login と /admin/bootstrap 以外は、すべて認証を通す
 *   ・状態を変えるPOSTは **Originチェック ＋ CSRFトークン**（6.1）。Cookie は SameSite=Strict
 *   ・個人情報の閲覧・エクスポート・削除は監査ログに残す（F2-1）
 *   ・全レスポンスの noindex と no-store は index.ts 側で付けている（F6-3）
 */
import { Hono } from 'hono';
import {
  ADMIN_IDLE_MINUTES, audit, buildAdminCookie, clearAdminCookie, countAdmins, createAdmin,
  evaluateAdminSession, isoNow, loadAdminSession, login, readAdminCookie, revokeAdminSession,
  touchAdminSession, uaHashOf,
} from '../lib/admin-auth.ts';
import { notifyConfigured, notifyLogin } from '../lib/notify.ts';
import { saltedHash } from '../lib/hash.ts';
import { timingSafeEqualStr } from '../lib/password.ts';
import {
  APPLICATION_STATUSES, CORP_STATUSES, RESPONSE_STATUSES, filterOptions, issueReferrerCode,
  linkCandidates, listApplications, listCorpLeads, listReferrers, listResponses,
  listResponsesForCsv, loadAnswers, loadApplication, loadRelated, loadResponse, normalizeFilters,
} from '../lib/admin-queries.ts';
import { csvHeaders, toCsv } from '../lib/csv.ts';
import { jsonArray, jstDayEnd, jstDayStart, jstFull } from '../lib/admin-format.ts';
import { questionSetOf, viewAnswers } from '../lib/question-archive.ts';
import { loginPage, bootstrapPage, lockedMessage } from '../views/admin/login.ts';
import { responseDetailPage, responsesListPage } from '../views/admin/responses.ts';
import { sessionDetailPage, sessionsListPage } from '../views/admin/sessions.ts';
import { corpLeadsPage, exportPage, referrersPage } from '../views/admin/misc.ts';
import type { ShellOptions } from '../views/admin/layout.ts';

export type AdminBindings = {
  DB: D1Database;
  IP_HASH_SALT: string;
  QUESTION_SET_VERSION: string;
  ADMIN_BOOTSTRAP_EMAIL?: string;
  ADMIN_BOOTSTRAP_PASSWORD?: string;
  LOGIN_NOTIFY_WEBHOOK?: string;
  RESEND_API_KEY?: string;
  LOGIN_NOTIFY_TO?: string;
  LOGIN_NOTIFY_FROM?: string;
  LOGIN_LIMIT?: { limit(options: { key: string }): Promise<{ success: boolean }> };
};

type Vars = { userId: string; email: string; csrf: string };

export const admin = new Hono<{ Bindings: AdminBindings; Variables: Vars }>();

function clientIp(req: Request): string | null {
  return req.headers.get('CF-Connecting-IP') ?? null;
}

/** そのリクエストのオリジン。紹介リンクの組み立てと、CSRFのOriginチェックに使う。 */
function originOf(url: string): string {
  const u = new URL(url);
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname.endsWith('.local');
  return `${local ? u.protocol.replace(':', '') : 'https'}://${u.host}`;
}

/**
 * 認証。Cookie → セッション行 → 無操作30分の判定（F2-1）。
 * 通ったら last_seen_at を進める。切れていたらログイン画面へ送る（Cookieも落とす）。
 */
admin.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (path === '/admin/login' || path === '/admin/bootstrap') return next();

  const id = readAdminCookie(c.req.header('Cookie'));
  const row = id ? await loadAdminSession(c.env.DB, id) : null;
  const v = evaluateAdminSession(row, isoNow(), ADMIN_IDLE_MINUTES);
  if (!v.ok) {
    if (id) c.header('Set-Cookie', clearAdminCookie());
    const notice = v.reason === 'idle_timeout' ? '30分操作がなかったため、いったんログアウトしました。' : undefined;
    // ページ遷移はログイン画面を出す。CSV等の直リンクも同じ扱いでよい。
    return c.html(loginPage({ notice }), 401);
  }
  await touchAdminSession(c.env.DB, row!.id, isoNow());
  c.set('userId', v.userId);
  c.set('email', v.email);
  c.set('csrf', v.csrf);
  return next();
});

/**
 * Origin が自分自身かどうか（6.1）。
 *
 * **比べるのはホストだけにする。** scheme まで含めて比べると、前段やローカル開発の都合で
 * http のまま渡ってきたときに落ちる（`originOf` は canonical 用に https を強制するため、
 * そこと突き合わせると必ずずれる）。CSRF で効くのは「別のサイトから送られていないか」なので、
 * ホストの一致で足りる。通信そのものは HSTS と Secure Cookie が守る。
 *
 * Origin ヘッダを送ってこないクライアントは、ここでは通してCSRFトークンで見る。
 */
export function sameOrigin(originHeader: string | undefined, host: string | undefined): boolean {
  if (!originHeader) return true;
  try {
    return !!host && new URL(originHeader).host === host;
  } catch {
    return false;
  }
}

/**
 * 状態を変えるPOSTの検証（6.1）。
 * Origin が自分と一致すること、CSRFトークンがセッションのものと一致することの両方を見る。
 * どちらか片方だと、Originを送らない古いクライアントや、トークンの漏れで抜けられる。
 */
async function readForm(c: {
  req: { raw: Request; header(name: string): string | undefined; url: string; formData(): Promise<FormData> };
  var: Vars;
}): Promise<{ ok: true; form: FormData } | { ok: false; message: string }> {
  const host = c.req.header('Host') ?? new URL(c.req.url).host;
  if (!sameOrigin(c.req.header('Origin'), host)) return { ok: false, message: 'Origin が一致しません。' };
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return { ok: false, message: 'フォームを読み取れませんでした。' };
  }
  const token = String(form.get('csrf') ?? '');
  if (!token || !timingSafeEqualStr(token, c.var.csrf)) {
    return { ok: false, message: '画面が古くなっています。開き直してからもう一度お試しください。' };
  }
  return { ok: true, form };
}

/** 画面の器に渡す共通の値。ログイン通知が未設定なら、毎ページで警告する（F2-1）。 */
function shellOf(c: { env: AdminBindings; var: Vars; req: { query(k: string): string | undefined } }, title: string): ShellOptions {
  const warnings: string[] = [];
  if (!notifyConfigured(c.env)) {
    warnings.push(
      'ログイン通知が未設定です。<code>LOGIN_NOTIFY_WEBHOOK</code>（または Resend の3点）を設定すると、' +
      '身に覚えのないログインに気づけます。1アカウント運用なので、ここは省略しないでください。'
    );
  }
  return { title, email: c.var.email, csrf: c.var.csrf, warnings, flash: c.req.query('done') ? flashOf(c.req.query('done')!) : undefined };
}

const FLASH: Record<string, string> = {
  saved: '保存しました。',
  linked: '申込を回答に紐づけました。',
  unlinked: '紐づけを外しました。',
  issued: '紹介者コードを発行しました。',
  deleted: '削除しました（伏せました）。',
  restored: '伏せるのを解除しました。',
  purged: '完全に削除しました。',
};

function flashOf(key: string): string | undefined {
  return FLASH[key];
}

// ───────── 初期アカウント（1回だけ） ─────────

/**
 * `admin_users` が空で、かつ ADMIN_BOOTSTRAP_* が設定されているときだけ開く。
 * 1人でも作られたら 404 になる。
 */
admin.get('/bootstrap', async (c) => {
  const email = c.env.ADMIN_BOOTSTRAP_EMAIL;
  if (!email || !c.env.ADMIN_BOOTSTRAP_PASSWORD) return c.notFound();
  if ((await countAdmins(c.env.DB)) > 0) return c.notFound();
  return c.html(bootstrapPage(email));
});

admin.post('/bootstrap', async (c) => {
  const email = c.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = c.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) return c.notFound();
  if ((await countAdmins(c.env.DB)) > 0) return c.notFound();
  if (password.length < 12) {
    return c.html(loginPage({ error: 'ADMIN_BOOTSTRAP_PASSWORD は12文字以上にしてください。' }), 400);
  }
  const id = await createAdmin(c.env.DB, email, password);
  await audit(c.env.DB, {
    actorId: id, action: 'bootstrap', targetType: 'admin_user', targetId: id,
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT),
  });
  return c.redirect('/admin/login?created=1', 303);
});

// ───────── ログイン・ログアウト ─────────

admin.get('/login', async (c) => {
  const id = readAdminCookie(c.req.header('Cookie'));
  if (id) {
    const v = evaluateAdminSession(await loadAdminSession(c.env.DB, id), isoNow(), ADMIN_IDLE_MINUTES);
    if (v.ok) return c.redirect('/admin/responses', 303);
  }
  // アカウントが1つも無ければ、作る導線へ送る（初回セットアップ）。
  if (c.env.ADMIN_BOOTSTRAP_EMAIL && c.env.ADMIN_BOOTSTRAP_PASSWORD && (await countAdmins(c.env.DB)) === 0) {
    return c.redirect('/admin/bootstrap', 303);
  }
  return c.html(loginPage({ notice: c.req.query('created') ? '管理アカウントを作成しました。ログインしてください。' : undefined }));
});

admin.post('/login', async (c) => {
  const ip = clientIp(c.req.raw);
  const ipHash = await saltedHash(ip, c.env.IP_HASH_SALT);
  if (c.env.LOGIN_LIMIT && ipHash) {
    const { success } = await c.env.LOGIN_LIMIT.limit({ key: ipHash });
    if (!success) return c.html(loginPage({ error: '試行が続いています。しばらく待ってからお試しください。' }), 429);
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.html(loginPage({ error: '入力を読み取れませんでした。' }), 400);
  }
  const email = String(form.get('email') ?? '').trim().slice(0, 200);
  const password = String(form.get('password') ?? '').slice(0, 400);

  const ua = c.req.header('User-Agent') ?? null;
  const result = await login(c.env.DB, email, password, {
    ipHash,
    uaHash: await uaHashOf(ua, c.env.IP_HASH_SALT),
  });

  if (!result.ok) {
    await audit(c.env.DB, {
      actorId: null, action: 'login_failed', targetType: 'admin_user', targetId: email,
      ipHash, detail: { reason: result.reason, storedHash: result.storedHash ?? 'ok' },
    });
    if (result.reason === 'locked') {
      // ロックにかかった時点で通知する。総当たりを受けているかもしれない。
      c.executionCtx.waitUntil(
        notifyLogin(c.env, { email, at: isoNow(), ok: false, ipHash, userAgent: ua, origin: originOf(c.req.url) })
      );
      return c.html(loginPage({ error: lockedMessage(result.retryAt!), email }), 429);
    }
    return c.html(loginPage({ error: 'メールアドレスまたはパスワードが違います。', email }), 401);
  }

  await audit(c.env.DB, {
    actorId: result.userId, action: 'login', targetType: 'admin_user', targetId: result.userId, ipHash,
  });
  c.executionCtx.waitUntil(
    notifyLogin(c.env, { email, at: isoNow(), ok: true, ipHash, userAgent: ua, origin: originOf(c.req.url) })
  );
  c.header('Set-Cookie', buildAdminCookie(result.sessionId));
  return c.redirect('/admin/responses', 303);
});

admin.post('/logout', async (c) => {
  const check = await readForm(c);
  if (!check.ok) return c.text(check.message, 400);
  const id = readAdminCookie(c.req.header('Cookie'));
  if (id) await revokeAdminSession(c.env.DB, id);
  await audit(c.env.DB, {
    actorId: c.var.userId, action: 'logout',
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT),
  });
  c.header('Set-Cookie', clearAdminCookie());
  return c.redirect('/admin/login', 303);
});

admin.get('/', (c) => c.redirect('/admin/responses', 303));

// ───────── 回答一覧（F2-2） ─────────

admin.get('/responses', async (c) => {
  const f = normalizeFilters({
    from: c.req.query('from'), to: c.req.query('to'), type: c.req.query('type'),
    ref: c.req.query('ref'), src: c.req.query('src'), visit: c.req.query('visit'),
    status: c.req.query('status'), q: c.req.query('q'),
    sort: c.req.query('sort'), dir: c.req.query('dir'), page: c.req.query('page'),
  });
  const [data, opts] = await Promise.all([listResponses(c.env.DB, f), filterOptions(c.env.DB)]);
  return c.html(responsesListPage(shellOf(c, '回答'), data, f, opts));
});

// ───────── 回答詳細（F2-3） ─────────

admin.get('/responses/:id', async (c) => {
  const id = c.req.param('id');
  const r = await loadResponse(c.env.DB, id);
  if (!r) return c.notFound();

  const [answers, related] = await Promise.all([loadAnswers(c.env.DB, id), loadRelated(c.env.DB, id)]);
  const version = String(r.question_set_version ?? '');
  const set = questionSetOf(version, c.env.QUESTION_SET_VERSION);

  // 個人情報（ヒアリング本文・申込者の氏名とメール）が出る画面なので、閲覧を残す（6.2）。
  await audit(c.env.DB, {
    actorId: c.var.userId, action: 'view_pii', targetType: 'response', targetId: id,
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT),
  });

  return c.html(
    responseDetailPage(
      shellOf(c, '回答の詳細'),
      r,
      {
        questions: viewAnswers(answers, set),
        versionKnown: !!set,
        survey: related.survey,
        hearing: related.hearing,
        visits: related.visits,
        applications: related.applications,
      },
      c.var.csrf
    )
  );
});

/** 運用欄の保存（F2-3 ブロック8）。 */
admin.post('/responses/:id', async (c) => {
  const check = await readForm(c);
  if (!check.ok) return c.text(check.message, 400);
  const id = c.req.param('id');
  const status = String(check.form.get('admin_status') ?? '');
  const note = String(check.form.get('admin_note') ?? '').slice(0, 8000);
  const value = (RESPONSE_STATUSES as readonly string[]).includes(status) ? status : null;

  await c.env.DB.prepare(`update responses set admin_status = ?, admin_note = ? where id = ?`)
    .bind(value, note || null, id).run();
  await audit(c.env.DB, {
    actorId: c.var.userId, action: 'update', targetType: 'response', targetId: id,
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT),
    detail: { admin_status: value, note_len: note.length },
  });
  return c.redirect(`/admin/responses/${id}?done=saved`, 303);
});

/** 削除依頼への対応（6.2）。まずは論理削除。一覧とCSVから外れる。 */
admin.post('/responses/:id/delete', async (c) => {
  const check = await readForm(c);
  if (!check.ok) return c.text(check.message, 400);
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`select deleted_at from responses where id = ?`).bind(id)
    .first<{ deleted_at: string | null }>();
  if (!row) return c.notFound();
  const restoring = !!row.deleted_at;
  await c.env.DB.prepare(`update responses set deleted_at = ? where id = ?`)
    .bind(restoring ? null : isoNow(), id).run();
  await audit(c.env.DB, {
    actorId: c.var.userId, action: 'delete', targetType: 'response', targetId: id,
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT),
    detail: { restored: restoring },
  });
  return c.redirect(`/admin/responses/${id}?done=${restoring ? 'restored' : 'deleted'}`, 303);
});

/** 物理削除（6.2）。設問別回答・ヒアリング・到達記録も落とす。取り消せない。 */
admin.post('/responses/:id/purge', async (c) => {
  const check = await readForm(c);
  if (!check.ok) return c.text(check.message, 400);
  const id = c.req.param('id');
  // 申込は残す（取引の記録なので、回答が消えても本人へ連絡する必要がある）。
  // 紐づけだけ外す。外部キーは ON DELETE SET NULL だが、明示しておく。
  await c.env.DB.batch([
    c.env.DB.prepare(`update session_applications set response_id = null, apply_visit_id = null where response_id = ?`).bind(id),
    c.env.DB.prepare(`delete from responses where id = ?`).bind(id),
  ]);
  await audit(c.env.DB, {
    actorId: c.var.userId, action: 'purge', targetType: 'response', targetId: id,
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT),
  });
  return c.redirect('/admin/responses?done=purged', 303);
});

// ───────── 体験セッション申込（F2-4） ─────────

admin.get('/sessions', async (c) => {
  const f = {
    status: c.req.query('status') || undefined,
    linked: c.req.query('linked') || undefined,
    q: c.req.query('q') || undefined,
    page: Math.max(1, Number(c.req.query('page')) || 1),
  };
  const data = await listApplications(c.env.DB, f);
  return c.html(sessionsListPage(shellOf(c, '体験セッション申込'), data, f, c.var.csrf));
});

admin.get('/sessions/:id', async (c) => {
  const a = await loadApplication(c.env.DB, c.req.param('id'));
  if (!a) return c.notFound();
  const candidates = a.response_id ? [] : await linkCandidates(c.env.DB, a);
  await audit(c.env.DB, {
    actorId: c.var.userId, action: 'view_pii', targetType: 'session_application', targetId: a.id,
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT),
  });
  return c.html(sessionDetailPage(shellOf(c, '申込の詳細'), a, candidates, c.var.csrf));
});

admin.post('/sessions/:id', async (c) => {
  const check = await readForm(c);
  if (!check.ok) return c.text(check.message, 400);
  const id = c.req.param('id');
  const status = String(check.form.get('status') ?? '');
  const heldOn = String(check.form.get('held_on') ?? '');
  const note = check.form.has('admin_note') ? String(check.form.get('admin_note')).slice(0, 8000) : null;
  const value = (APPLICATION_STATUSES as readonly string[]).includes(status) ? status : '未対応';
  const heldAt = heldOn ? jstDayStart(heldOn) : null;

  // メモ欄が無いフォーム（一覧のステータス変更）からは、メモを消さない。
  await c.env.DB.prepare(
    note === null
      ? `update session_applications set status = ?, held_at = ? where id = ?`
      : `update session_applications set status = ?, held_at = ?, admin_note = ? where id = ?`
  )
    .bind(...(note === null ? [value, heldAt, id] : [value, heldAt, note || null, id]))
    .run();

  await audit(c.env.DB, {
    actorId: c.var.userId, action: 'update', targetType: 'session_application', targetId: id,
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT), detail: { status: value },
  });
  return c.redirect(withFlash(safeBack(String(check.form.get('back') ?? '')), 'saved'), 303);
});

/** 手動での紐づけ（F2-4）。response_id を空で送ると外す。 */
admin.post('/sessions/:id/link', async (c) => {
  const check = await readForm(c);
  if (!check.ok) return c.text(check.message, 400);
  const id = c.req.param('id');
  const responseId = String(check.form.get('response_id') ?? '').trim();

  if (responseId) {
    const exists = await c.env.DB.prepare(`select id from responses where id = ?`).bind(responseId).first();
    if (!exists) return c.text('その回答が見つかりません。', 400);
  }
  await c.env.DB.prepare(`update session_applications set response_id = ? where id = ?`)
    .bind(responseId || null, id).run();
  await audit(c.env.DB, {
    actorId: c.var.userId, action: 'update', targetType: 'session_application', targetId: id,
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT),
    detail: { linked_response_id: responseId || null },
  });
  return c.redirect(`/admin/sessions/${id}?done=${responseId ? 'linked' : 'unlinked'}`, 303);
});

/**
 * 戻り先は自分のサイトの中だけ許す（オープンリダイレクトを作らない）。
 * `//evil.example` は「スキーム相対URL」として外へ出るので、必ず弾く。
 * 末尾が `/` で終わる（＝IDが空の）パスも、行き先が無いので既定へ寄せる。
 */
function safeBack(path: string): string {
  const ok = path.startsWith('/admin/') && !path.startsWith('//') && !path.endsWith('/');
  return ok ? path : '/admin/sessions';
}

/** 保存できたことを次の画面へ渡す。**sanitize 済みのパス**にだけ付ける。 */
function withFlash(path: string, key: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}done=${key}`;
}

// ───────── 法人リード（F2-5） ─────────

admin.get('/corp-leads', async (c) => {
  const f = {
    status: c.req.query('status') || undefined,
    page: Math.max(1, Number(c.req.query('page')) || 1),
    // 既定は伏せる。全表示は明示的に押したときだけ（6.2）。
    reveal: c.req.query('reveal') === '1',
  };
  const data = await listCorpLeads(c.env.DB, f);
  await audit(c.env.DB, {
    actorId: c.var.userId, action: 'view_pii', targetType: 'corp_leads', targetId: null,
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT),
    detail: { reveal: f.reveal },
  });
  return c.html(corpLeadsPage(shellOf(c, '法人リード'), data, f, c.var.csrf));
});

admin.post('/corp-leads/:id', async (c) => {
  const check = await readForm(c);
  if (!check.ok) return c.text(check.message, 400);
  const id = c.req.param('id');
  const status = String(check.form.get('status') ?? '');
  const note = String(check.form.get('admin_note') ?? '').slice(0, 8000);
  const value = (CORP_STATUSES as readonly string[]).includes(status) ? status : '未対応';
  await c.env.DB.prepare(`update corp_leads set status = ?, admin_note = ? where id = ?`)
    .bind(value, note || null, id).run();
  await audit(c.env.DB, {
    actorId: c.var.userId, action: 'update', targetType: 'corp_lead', targetId: id,
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT), detail: { status: value },
  });
  return c.redirect('/admin/corp-leads?done=saved', 303);
});

// ───────── 紹介者マスタ（F2-6） ─────────

admin.get('/referrers', async (c) => {
  const rows = await listReferrers(c.env.DB);
  return c.html(referrersPage(shellOf(c, '紹介者'), rows, originOf(c.req.url), c.var.csrf));
});

admin.post('/referrers', async (c) => {
  const check = await readForm(c);
  if (!check.ok) return c.text(check.message, 400);
  const name = String(check.form.get('name') ?? '').trim().slice(0, 60);
  if (!name) return c.text('紹介者名を入力してください。', 400);
  const initials = String(check.form.get('initials') ?? '').trim();
  const note = String(check.form.get('note') ?? '').trim().slice(0, 200);

  const code = await issueReferrerCode(c.env.DB, initials);
  await c.env.DB.prepare(`insert into referrers (code, name, note, active, created_at) values (?,?,?,1,?)`)
    .bind(code, name, note || null, isoNow()).run();
  await audit(c.env.DB, {
    actorId: c.var.userId, action: 'create', targetType: 'referrer', targetId: code,
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT),
  });
  return c.redirect('/admin/referrers?done=issued', 303);
});

admin.post('/referrers/:code', async (c) => {
  const check = await readForm(c);
  if (!check.ok) return c.text(check.message, 400);
  const code = c.req.param('code');
  const name = String(check.form.get('name') ?? '').trim().slice(0, 60);
  const note = String(check.form.get('note') ?? '').trim().slice(0, 200);
  const active = String(check.form.get('active') ?? '1') === '1' ? 1 : 0;
  if (!name) return c.text('紹介者名を空にはできません。', 400);
  await c.env.DB.prepare(`update referrers set name = ?, note = ?, active = ? where code = ?`)
    .bind(name, note || null, active, code).run();
  await audit(c.env.DB, {
    actorId: c.var.userId, action: 'update', targetType: 'referrer', targetId: code,
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT), detail: { active },
  });
  return c.redirect('/admin/referrers?done=saved', 303);
});

// ───────── CSV出力（F2-7） ─────────

admin.get('/export', async (c) => {
  const q = async (sql: string) => (await c.env.DB.prepare(sql).first<{ n: number }>())?.n ?? 0;
  const counts = {
    responses: await q(`select count(*) as n from responses where deleted_at is null`),
    answers: await q(`select count(*) as n from response_answers a
                       join responses r on r.id = a.response_id where r.deleted_at is null`),
    applications: await q(`select count(*) as n from session_applications where deleted_at is null`),
    corpLeads: await q(`select count(*) as n from corp_leads where deleted_at is null`),
  };
  return c.html(exportPage(shellOf(c, 'CSV出力'), counts));
});

function stamp(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10).replace(/-/g, '');
}

/** 期間（JSTの日付）→ UTCの範囲。CSVの4種で共通に使う。 */
function period(c: { req: { query(k: string): string | undefined } }): { from: string | null; to: string | null } {
  const from = c.req.query('from') ? jstDayStart(c.req.query('from')!) : null;
  const to = c.req.query('to') ? jstDayEnd(c.req.query('to')!) : null;
  return { from, to };
}

admin.get('/export/responses.csv', async (c) => {
  const f = normalizeFilters({
    from: c.req.query('from'), to: c.req.query('to'), type: c.req.query('type'),
    ref: c.req.query('ref'), src: c.req.query('src'), visit: c.req.query('visit'),
    status: c.req.query('status'), q: c.req.query('q'),
  });
  const rows = await listResponsesForCsv(c.env.DB, f);
  // 一覧の列だけでは足りないので、5軸や端末も付けて引き直す。
  const detail = await c.env.DB.prepare(
    `select id, radar_safety, radar_trust, radar_bound, radar_conflict, radar_connect,
            axis_h, axis_c, axis_w, entry_url, utm_source, utm_medium, utm_campaign,
            device_type, os, browser, mode, segment, frame, admin_note, completed_at
       from responses where deleted_at is null`
  ).all<Record<string, string | number | null>>();
  const byId = new Map((detail.results ?? []).map((r) => [String(r.id), r]));

  const csv = toCsv(
    ['回答ID', '回答日時(JST)', '完了日時(JST)', '設問セット', 'タイプコード', 'タイプ名',
     '判定_本音', '判定_衝突', '判定_重心',
     '5軸_本音', '5軸_任せ方', '5軸_境界', '5軸_摩擦', '5軸_間合い',
     '紹介元コード', '紹介者名', '流入元', 'UTMソース', 'UTMメディア', 'UTMキャンペーン', '流入URL',
     '端末', 'OS', 'ブラウザ', 'モード', 'セグメント', '回答アンカー',
     'X共有日時(JST)', 'ガイド開封(JST)', 'ガイド最終章', 'ガイド終章到達(JST)',
     '申込フォーム到達数', '初回到達(JST)', '申込数', '最終申込(JST)', '対応状況', 'メモ'],
    rows.map((r) => {
      const d = byId.get(r.id) ?? {};
      return [
        r.id, jstFull(r.created_at), jstFull(d.completed_at as string | null), r.question_set_version,
        r.type_code, r.type_name, d.axis_h, d.axis_c, d.axis_w,
        d.radar_safety, d.radar_trust, d.radar_bound, d.radar_conflict, d.radar_connect,
        r.ref_code, r.referrer_name, r.src, d.utm_source, d.utm_medium, d.utm_campaign, d.entry_url,
        d.device_type, d.os, d.browser, d.mode, d.segment, d.frame,
        jstFull(r.shared_at), jstFull(r.guide_opened_at), r.guide_max_chapter, jstFull(r.guide_completed_at),
        r.visit_count, jstFull(r.first_visit_at), r.application_count, jstFull(r.applied_at),
        r.admin_status ?? '未対応', d.admin_note,
      ];
    })
  );
  await audit(c.env.DB, {
    actorId: c.var.userId, action: 'export', targetType: 'responses', targetId: null,
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT),
    detail: { rows: rows.length, filters: f },
  });
  return c.body(csv, 200, csvHeaders(`responses-${stamp()}.csv`));
});

admin.get('/export/answers.csv', async (c) => {
  const p = period(c);
  const { results } = await c.env.DB.prepare(
    `select a.response_id, r.created_at, r.type_code, r.question_set_version,
            a.order_no, a.question_key, a.kind, a.axis, a.value
       from response_answers a join responses r on r.id = a.response_id
      where r.deleted_at is null
        and (? is null or r.created_at >= ?) and (? is null or r.created_at < ?)
      order by r.created_at desc, a.order_no`
  ).bind(p.from, p.from, p.to, p.to).all<Record<string, string | number | null>>();

  const set = questionSetOf(c.env.QUESTION_SET_VERSION, c.env.QUESTION_SET_VERSION);
  const csv = toCsv(
    ['回答ID', '回答日時(JST)', 'タイプコード', '設問セット', '出題順', '設問キー', '種別', '軸', '値', '設問文', '選んだ選択肢'],
    (results ?? []).map((row) => {
      const view = viewAnswers(
        [{ order_no: Number(row.order_no), question_key: String(row.question_key), kind: String(row.kind), axis: String(row.axis), value: String(row.value) }],
        String(row.question_set_version) === c.env.QUESTION_SET_VERSION ? set : null
      )[0]!;
      return [
        row.response_id, jstFull(String(row.created_at)), row.type_code, row.question_set_version,
        row.order_no, row.question_key, row.kind, row.axis, row.value, view.text ?? '', view.answerText ?? '',
      ];
    })
  );
  await audit(c.env.DB, {
    actorId: c.var.userId, action: 'export', targetType: 'response_answers', targetId: null,
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT), detail: { rows: results?.length ?? 0 },
  });
  return c.body(csv, 200, csvHeaders(`answers-${stamp()}.csv`));
});

admin.get('/export/applications.csv', async (c) => {
  const p = period(c);
  const { results } = await c.env.DB.prepare(
    `select sa.*, r.type_code as response_type_code, r.created_at as response_created_at
       from session_applications sa left join responses r on r.id = sa.response_id
      where sa.deleted_at is null
        and (? is null or sa.created_at >= ?) and (? is null or sa.created_at < ?)
      order by sa.created_at desc`
  ).bind(p.from, p.from, p.to, p.to).all<Record<string, string | null>>();

  const csv = toCsv(
    ['申込ID', '申込日時(JST)', '氏名', 'メール', 'タイプ', '気になっていること', '希望の時間帯', '質問',
     '取り込み元', 'ステータス', '実施日(JST)', 'メモ', '紐づく回答ID', '回答日時(JST)', '到達ID'],
    (results ?? []).map((a) => [
      a.id, jstFull(a.created_at), a.name, a.email, a.type_code, a.concern,
      jsonArray(a.preferred_slots).join('／'), a.question, a.source, a.status,
      jstFull(a.held_at), a.admin_note, a.response_id, jstFull(a.response_created_at), a.apply_visit_id,
    ])
  );
  await audit(c.env.DB, {
    actorId: c.var.userId, action: 'export', targetType: 'session_applications', targetId: null,
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT), detail: { rows: results?.length ?? 0 },
  });
  return c.body(csv, 200, csvHeaders(`applications-${stamp()}.csv`));
});

admin.get('/export/corp-leads.csv', async (c) => {
  const p = period(c);
  const { results } = await c.env.DB.prepare(
    `select * from corp_leads where deleted_at is null
        and (? is null or created_at >= ?) and (? is null or created_at < ?)
      order by created_at desc`
  ).bind(p.from, p.from, p.to, p.to).all<Record<string, string | null>>();

  const csv = toCsv(
    ['リードID', '日時(JST)', 'メール', '課題', '自由記述', '紹介元', '流入ページ', 'ステータス', 'メモ'],
    (results ?? []).map((l) => [
      l.id, jstFull(l.created_at), l.email, jsonArray(l.issues).join('／'), l.detail,
      l.ref_code, l.page, l.status, l.admin_note,
    ])
  );
  await audit(c.env.DB, {
    actorId: c.var.userId, action: 'export', targetType: 'corp_leads', targetId: null,
    ipHash: await saltedHash(clientIp(c.req.raw), c.env.IP_HASH_SALT), detail: { rows: results?.length ?? 0 },
  });
  return c.body(csv, 200, csvHeaders(`corp-leads-${stamp()}.csv`));
});
