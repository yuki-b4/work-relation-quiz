/**
 * 結果閲覧セッション。
 *
 * 要件：アプリ化要件定義.md F4（結果のワンタイム表示とデバイス束縛）。
 *
 * 3つの鍵が揃ったときだけ結果を出す。
 *   1. サーバの result_sessions 行（有効期限内・未クローズ）
 *   2. HttpOnly セッションCookie ＝ ブラウザ束縛。**Max-Age と Expires を付けない**ので、
 *      ブラウザを閉じると消える。JSから読めないので他デバイスへコピーできない
 *   3. sessionStorage の照合値（tab_token）＝ タブ束縛。タブを閉じると確実に消えるので、
 *      同じブラウザの別タブも弾ける
 *
 * `pagehide` / `visibilitychange` で「閉じた」をサーバへ通知する方式は採らない（F4-2）。
 * モバイルではアプリ切り替えやスクロールでも発火し、閉じていないのに結果が消える誤爆が起きる。
 * sessionStorage が消えていることを「タブが閉じられた」の正とする。
 */

/** Cookie 名。値は result_sessions.id。 */
export const RESULT_COOKIE = 'rs';

/** 結果セッションの行（result_sessions）。 */
export type ResultSessionRow = {
  id: string;
  tab_token: string;
  response_id: string;
  issued_at: string;
  expires_at: string;
  last_seen_at: string;
  closed_at: string | null;
  closed_reason: string | null;
};

export type CloseReason = 'user_close' | 'retake' | 'expired';

export type Verdict =
  | { ok: true; responseId: string }
  | { ok: false; reason: 'not_found' | 'closed' | 'expired' | 'tab_mismatch' };

export type Limits = {
  /** 最終操作からこの分数で失効（既定30分）。 */
  idleMinutes: number;
  /** 発行からこの時間数で失効（既定2時間）。 */
  maxHours: number;
};

export const DEFAULT_LIMITS: Limits = { idleMinutes: 30, maxHours: 2 };

/** 推測不能なトークンを作る。Cookie と tab_token は別の値にする。 */
export function randomToken(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function isoNow(at: Date = new Date()): string {
  return at.toISOString();
}

export function isoPlus(base: string, ms: number): string {
  return new Date(Date.parse(base) + ms).toISOString();
}

/**
 * 表示してよいかを判定する純関数。DBに触らないので、そのまま試験できる。
 *
 * 失敗の理由は分けて返すが、**利用者に見せる画面はどれも同じ**（F4-4 の「すでに閉じられています」）。
 * 区別はログとAdmin用。
 */
export function evaluate(
  row: ResultSessionRow | null | undefined,
  tabToken: string | null | undefined,
  now: string,
  limits: Limits = DEFAULT_LIMITS
): Verdict {
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.closed_at) return { ok: false, reason: 'closed' };

  const t = Date.parse(now);
  if (t >= Date.parse(row.expires_at)) return { ok: false, reason: 'expired' };
  if (t >= Date.parse(row.last_seen_at) + limits.idleMinutes * 60_000) {
    return { ok: false, reason: 'expired' };
  }

  // タブ束縛。sessionStorage が消えている（＝タブを閉じた）と、ここで落ちる。
  if (!tabToken || tabToken !== row.tab_token) return { ok: false, reason: 'tab_mismatch' };

  return { ok: true, responseId: row.response_id };
}

/**
 * Set-Cookie の値。
 * **Max-Age と Expires を付けない**こと。付けるとブラウザを閉じても残り、要求4が壊れる。
 */
export function buildResultCookie(id: string): string {
  return `${RESULT_COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

/** 明示的に閉じたときに、Cookie も落とす。 */
export function clearResultCookie(): string {
  return `${RESULT_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** Cookie ヘッダから結果セッションIDを取り出す。 */
export function readResultCookie(header: string | null | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === RESULT_COOKIE) return part.slice(i + 1).trim() || null;
  }
  return null;
}

// ───────── D1 アクセス ─────────

export async function createResultSession(
  db: D1Database,
  args: { responseId: string; uaHash?: string | null; ipHash?: string | null; now?: string; limits?: Limits }
): Promise<{ id: string; tabToken: string; expiresAt: string }> {
  const now = args.now ?? isoNow();
  const limits = args.limits ?? DEFAULT_LIMITS;
  const id = randomToken();
  const tabToken = randomToken();
  const expiresAt = isoPlus(now, limits.maxHours * 3_600_000);
  await db
    .prepare(
      `insert into result_sessions
         (id, tab_token, response_id, issued_at, expires_at, last_seen_at, ua_hash, ip_hash)
       values (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, tabToken, args.responseId, now, expiresAt, now, args.uaHash ?? null, args.ipHash ?? null)
    .run();
  return { id, tabToken, expiresAt };
}

export async function loadResultSession(db: D1Database, id: string): Promise<ResultSessionRow | null> {
  return await db
    .prepare(
      `select id, tab_token, response_id, issued_at, expires_at, last_seen_at, closed_at, closed_reason
         from result_sessions where id = ?`
    )
    .bind(id)
    .first<ResultSessionRow>();
}

/** 表示のたびに last_seen_at を進める（無操作30分の起点）。 */
export async function touchResultSession(db: D1Database, id: string, now = isoNow()): Promise<void> {
  await db.prepare(`update result_sessions set last_seen_at = ? where id = ?`).bind(now, id).run();
}

/** 明示的に閉じる。「結果を閉じる」ボタンと「もう一度診断する」から呼ぶ。 */
export async function closeResultSession(
  db: D1Database,
  id: string,
  reason: CloseReason,
  now = isoNow()
): Promise<void> {
  await db
    .prepare(`update result_sessions set closed_at = ?, closed_reason = ? where id = ? and closed_at is null`)
    .bind(now, reason, id)
    .run();
}

/** その回答に紐づくセッションをまとめて閉じる（もう一度診断するとき）。 */
export async function closeSessionsForResponse(
  db: D1Database,
  responseId: string,
  reason: CloseReason,
  now = isoNow()
): Promise<void> {
  await db
    .prepare(
      `update result_sessions set closed_at = ?, closed_reason = ?
         where response_id = ? and closed_at is null`
    )
    .bind(now, reason, responseId)
    .run();
}

/**
 * 1回の閲覧要求をさばく。判定に通れば last_seen_at を進めて responseId を返す。
 * 通らなければ理由を返す（呼び出し側は 410 と案内画面を出す。F4-4）。
 */
export async function verifyAndTouch(
  db: D1Database,
  cookieHeader: string | null,
  tabToken: string | null,
  now = isoNow(),
  limits: Limits = DEFAULT_LIMITS
): Promise<Verdict> {
  const id = readResultCookie(cookieHeader);
  if (!id) return { ok: false, reason: 'not_found' };
  const row = await loadResultSession(db, id);
  const verdict = evaluate(row, tabToken, now, limits);
  if (verdict.ok) await touchResultSession(db, id, now);
  return verdict;
}
