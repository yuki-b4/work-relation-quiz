/**
 * Admin の認証とセッション。
 *
 * 要件：アプリ化要件定義.md F2-1（メール＋パスワード・試行5回でロック・無操作30分・監査ログ）。
 *
 * 結果閲覧セッション（result-session.ts）とは別物なので、Cookie名もテーブルも分ける。
 * 判定の中身は純関数（evaluateAdminSession）に出して、DB無しで試験できるようにしてある。
 *
 * 1名運用ゆえの単一障害点（確認事項8）への手当ては3つ。どれも省略しない。
 *   1. 長いパスワードを使う（運用。README に書く）
 *   2. ログイン成功をメール等で通知する（notify.ts。未設定なら画面で警告を出す）
 *   3. 復旧手段（tools/admin-password.mjs でハッシュを作って直接DBを更新。README に手順）
 */
import { sha256Hex } from './hash.ts';
import { hashPassword, needsRehash, parseStoredHash, verifyPassword, PBKDF2_ITERATIONS } from './password.ts';

/** Admin セッションCookie。結果セッションの 'rs' とは別名にする。 */
export const ADMIN_COOKIE = 'as';

/** 無操作でセッションが切れるまで（分）。F2-1。 */
export const ADMIN_IDLE_MINUTES = 30;

/** 連続失敗でロックするまでの回数と、ロックの長さ（分）。F2-1。 */
export const MAX_FAILED = 5;
export const LOCK_MINUTES = 15;

export type AdminUserRow = {
  id: string;
  email: string;
  password_hash: string;
  failed_count: number;
  locked_until: string | null;
  disabled_at: string | null;
};

export type AdminSessionRow = {
  id: string;
  user_id: string;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  csrf_token: string | null;
  email: string;
  disabled_at: string | null;
};

export type AdminVerdict =
  | { ok: true; userId: string; email: string; csrf: string }
  | { ok: false; reason: 'not_found' | 'revoked' | 'idle_timeout' | 'disabled' };

export function isoNow(at: Date = new Date()): string {
  return at.toISOString();
}

export function randomToken(bytes = 32): string {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * ログインセッションを表示してよいかの判定（純関数）。
 * 無操作30分で切れる。切れた理由は分けて返すが、画面はどれもログイン画面へ送る。
 */
export function evaluateAdminSession(
  row: AdminSessionRow | null | undefined,
  now: string,
  idleMinutes = ADMIN_IDLE_MINUTES
): AdminVerdict {
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.revoked_at) return { ok: false, reason: 'revoked' };
  if (row.disabled_at) return { ok: false, reason: 'disabled' };
  if (Date.parse(now) >= Date.parse(row.last_seen_at) + idleMinutes * 60_000) {
    return { ok: false, reason: 'idle_timeout' };
  }
  return { ok: true, userId: row.user_id, email: row.email, csrf: row.csrf_token ?? '' };
}

/** いまロック中か（純関数）。 */
export function isLocked(user: Pick<AdminUserRow, 'locked_until'>, now: string): boolean {
  return !!user.locked_until && Date.parse(now) < Date.parse(user.locked_until);
}

/**
 * 失敗回数を1つ進めたときの次の状態（純関数）。
 * MAX_FAILED に達したらロックし、カウンタは戻さない（ロック明けの1回目でまた止まる）。
 */
export function nextFailureState(
  failedCount: number,
  now: string,
  maxFailed = MAX_FAILED,
  lockMinutes = LOCK_MINUTES
): { failedCount: number; lockedUntil: string | null } {
  const next = failedCount + 1;
  if (next < maxFailed) return { failedCount: next, lockedUntil: null };
  return {
    failedCount: next,
    lockedUntil: new Date(Date.parse(now) + lockMinutes * 60_000).toISOString(),
  };
}

// ───────── Cookie ─────────

/**
 * Set-Cookie。**SameSite=Strict** にする（6.1）。
 * Admin は外部リンクから直接入る画面ではないので、Strict でも運用に困らない。
 * Lax だと他サイトからのGET遷移でCookieが付き、CSRFの面が広がる。
 */
export function buildAdminCookie(id: string): string {
  return `${ADMIN_COOKIE}=${id}; Path=/admin; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminCookie(): string {
  return `${ADMIN_COOKIE}=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function readAdminCookie(header: string | null | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === ADMIN_COOKIE) return part.slice(i + 1).trim() || null;
  }
  return null;
}

// ───────── D1 ─────────

export async function findAdminByEmail(db: D1Database, email: string): Promise<AdminUserRow | null> {
  return await db
    .prepare(
      `select id, email, password_hash, failed_count, locked_until, disabled_at
         from admin_users where lower(email) = lower(?)`
    )
    .bind(email)
    .first<AdminUserRow>();
}

export async function countAdmins(db: D1Database): Promise<number> {
  const r = await db.prepare(`select count(*) as n from admin_users`).first<{ n: number }>();
  return r?.n ?? 0;
}

/** 初期アカウント。すでに1人でもいれば作らない（F2-1：1名運用の bootstrap）。 */
export async function createAdmin(db: D1Database, email: string, password: string): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(`insert into admin_users (id, email, password_hash, created_at) values (?,?,?,?)`)
    .bind(id, email, await hashPassword(password), isoNow())
    .run();
  return id;
}

export type LoginResult =
  | { ok: true; sessionId: string; csrf: string; userId: string }
  | {
      ok: false;
      reason: 'invalid' | 'locked' | 'disabled';
      retryAt?: string;
      /**
       * 保存されているハッシュ自体が壊れていた場合の理由（監査ログ用）。
       * 利用者への表示は変えない（「パスワードが違います」のまま）。
       */
      storedHash?: string;
    };

/**
 * ログイン。
 *
 * 見つからない場合も**同じだけ待つ**（ダミーのハッシュを1回照合する）。
 * 早く返すと、応答時間でメールアドレスの存在が分かってしまう。
 */
export async function login(
  db: D1Database,
  email: string,
  password: string,
  meta: { ipHash?: string | null; uaHash?: string | null; now?: string } = {}
): Promise<LoginResult> {
  const now = meta.now ?? isoNow();
  let storedHashProblem: string | undefined;
  const user = await findAdminByEmail(db, email);

  if (!user) {
    // 存在しないアドレスでも同じ計算量を使う。返り値は捨てる。
    await verifyPassword(password, DUMMY_HASH);
    return { ok: false, reason: 'invalid' };
  }
  if (user.disabled_at) return { ok: false, reason: 'disabled' };
  if (isLocked(user, now)) return { ok: false, reason: 'locked', retryAt: user.locked_until! };

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    // **保存値そのものが壊れていないかを見る。** 壊れていても照合は不一致にしかならず、
    // 画面には「パスワードが違います」としか出ないので、ここで残さないと原因に辿りつけない。
    // 監査ログに `stored: 'format'` などが並んでいたら、パスワードではなくDBの値が壊れている。
    const parsed = parseStoredHash(user.password_hash);
    if (!parsed.ok) storedHashProblem = parsed.reason;
    const next = nextFailureState(user.failed_count, now);
    await db
      .prepare(`update admin_users set failed_count = ?, locked_until = ? where id = ?`)
      .bind(next.failedCount, next.lockedUntil, user.id)
      .run();
    return next.lockedUntil
      ? { ok: false, reason: 'locked', retryAt: next.lockedUntil, storedHash: storedHashProblem }
      : { ok: false, reason: 'invalid', storedHash: storedHashProblem };
  }

  // 成功したらカウンタとロックを落とす。
  await db
    .prepare(
      `update admin_users set failed_count = 0, locked_until = null, last_login_at = ?,
              password_hash = ? where id = ?`
    )
    .bind(now, needsRehash(user.password_hash) ? await hashPassword(password) : user.password_hash, user.id)
    .run();

  const sessionId = randomToken();
  const csrf = randomToken(24);
  await db
    .prepare(
      `insert into admin_sessions (id, user_id, created_at, last_seen_at, csrf_token, ip_hash, ua_hash)
       values (?,?,?,?,?,?,?)`
    )
    .bind(sessionId, user.id, now, now, csrf, meta.ipHash ?? null, meta.uaHash ?? null)
    .run();

  return { ok: true, sessionId, csrf, userId: user.id };
}

/** 存在しないアドレスのときに時間を合わせるためのハッシュ。実在のパスワードではない。 */
const DUMMY_HASH =
  `pbkdf2-sha256$${PBKDF2_ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`;

export async function loadAdminSession(db: D1Database, id: string): Promise<AdminSessionRow | null> {
  return await db
    .prepare(
      `select s.id, s.user_id, s.created_at, s.last_seen_at, s.revoked_at, s.csrf_token,
              u.email, u.disabled_at
         from admin_sessions s join admin_users u on u.id = s.user_id
        where s.id = ?`
    )
    .bind(id)
    .first<AdminSessionRow>();
}

export async function touchAdminSession(db: D1Database, id: string, now = isoNow()): Promise<void> {
  await db.prepare(`update admin_sessions set last_seen_at = ? where id = ?`).bind(now, id).run();
}

export async function revokeAdminSession(db: D1Database, id: string, now = isoNow()): Promise<void> {
  await db
    .prepare(`update admin_sessions set revoked_at = ? where id = ? and revoked_at is null`)
    .bind(now, id)
    .run();
}

// ───────── 監査ログ ─────────

export type AuditAction =
  | 'login' | 'login_failed' | 'logout' | 'bootstrap'
  | 'view_pii' | 'export' | 'update' | 'delete' | 'purge' | 'create';

/**
 * 監査ログ（F2-1）。1名運用でも、個人情報の閲覧・エクスポート・削除は必ず残す。
 * 記録に失敗しても本処理は止めない（ログのためにAdminが使えなくなるほうが困る）。
 */
export async function audit(
  db: D1Database,
  entry: {
    actorId: string | null;
    action: AuditAction;
    targetType?: string | null;
    targetId?: string | null;
    ipHash?: string | null;
    detail?: unknown;
  }
): Promise<void> {
  try {
    await db
      .prepare(
        `insert into admin_audit_logs (id, actor_id, at, action, target_type, target_id, ip_hash, detail)
         values (?,?,?,?,?,?,?,?)`
      )
      .bind(
        crypto.randomUUID(), entry.actorId, isoNow(), entry.action,
        entry.targetType ?? null, entry.targetId ?? null, entry.ipHash ?? null,
        entry.detail === undefined ? null : JSON.stringify(entry.detail)
      )
      .run();
  } catch {
    // 握りつぶす。監査ログの失敗で操作そのものを落とさない。
  }
}

/** UA のハッシュ。ログイン通知に「見覚えのない端末か」を添えるために持つ。 */
export async function uaHashOf(ua: string | null, salt: string | undefined): Promise<string | null> {
  if (!ua || !salt) return null;
  return sha256Hex(`${salt}:ua:${ua}`);
}
