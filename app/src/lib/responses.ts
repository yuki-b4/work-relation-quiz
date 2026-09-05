/**
 * 回答の保存。
 *
 * 要件：アプリ化要件定義.md F1-2（エンティティ）／F1-3（API）／F3-2（サーバ採番・再計算）。
 *
 * ここでの原則：
 *   ・回答IDはサーバで採番する（クライアント生成の値は受け取らない）
 *   ・タイプ判定と5軸スコアはサーバで計算する。クライアントの申告値は使わない
 *   ・15問のリッカート生値も含めて、24問すべてを response_answers に残す
 *   ・IPは生値を保存せず、ソルト付きハッシュだけを持つ
 */
import { QUESTIONS, RADAR_Q } from '../content/quiz.ts';
import { saltedHash } from './hash.ts';
import { parseUa } from './ua.ts';
import { createResultSession, isoNow, type Limits } from './result-session.ts';
import { roundRadar, score, validateAnswers, type Answer } from './scoring.ts';

/** 文字列項目の上限。長すぎる値をそのまま入れない。 */
const MAX_SHORT = 200;
const MAX_URL = 2000;
const MAX_UA = 512;

function trim(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

export type SubmitPayload = {
  /** 二重送信の防止に使う冪等キー。クライアントが作る（F1-3）。 */
  requestId?: unknown;
  /** 24問の回答。前9問は極、後15問は 1〜4。 */
  answers?: unknown;
  /** 回答アンカー。現行は「自然体」固定（F3-2）。 */
  frame?: unknown;
  /** ?ref= の生値。画面の分岐には使わず記録だけ（F3-3）。 */
  ref?: unknown;
  /** ?src= 。X共有からの流入は 'x'（F5-3）。 */
  src?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  entryUrl?: unknown;
  referrerUrl?: unknown;
};

export type RequestMeta = {
  ip: string | null;
  userAgent: string | null;
  ipHashSalt: string | undefined;
  questionSetVersion: string;
  limits?: Limits;
};

export type SubmitResult =
  | { ok: true; responseId: string; typeCode: string; sessionId: string; tabToken: string; duplicate: boolean }
  | { ok: false; status: number; errors: string[] };

/**
 * 回答を1件保存し、結果セッションを発行する。
 * 同じ requestId が既にあれば新しい行を作らず、その回答の結果セッションを返す。
 */
export async function submitResponse(
  db: D1Database,
  payload: SubmitPayload,
  meta: RequestMeta
): Promise<SubmitResult> {
  const check = validateAnswers(payload.answers);
  if (!check.ok) return { ok: false, status: 400, errors: check.errors };
  const answers = payload.answers as Answer[];

  const requestId = trim(payload.requestId, 100);

  // ── 二重送信：同じ requestId が既にあれば、その回答の結果セッションを返す ──
  if (requestId) {
    const dup = await db
      .prepare(`select id, type_code from responses where client_request_id = ?`)
      .bind(requestId)
      .first<{ id: string; type_code: string }>();
    if (dup) {
      const session = await reuseOrCreateSession(db, dup.id, meta);
      return {
        ok: true,
        responseId: dup.id,
        typeCode: dup.type_code,
        sessionId: session.id,
        tabToken: session.tabToken,
        duplicate: true,
      };
    }
  }

  const s = score(answers);
  const radar = roundRadar(s.radar);
  const now = isoNow();
  const responseId = crypto.randomUUID();
  const ua = trim(meta.userAgent, MAX_UA);
  const { deviceType, os, browser } = parseUa(ua);
  const ipHash = await saltedHash(meta.ip, meta.ipHashSalt);

  // ?ref= は生値をそのまま残し、紹介者マスタに登録があるものだけ referrer_code に解決する。
  const refCode = trim(payload.ref, MAX_SHORT);
  let referrerCode: string | null = null;
  if (refCode) {
    const hit = await db
      .prepare(`select code from referrers where code = ? and active = 1`)
      .bind(refCode)
      .first<{ code: string }>();
    referrerCode = hit?.code ?? null;
  }

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `insert into responses (
           id, created_at, completed_at, question_set_version, client_request_id,
           mode, segment, ref_code, referrer_code, frame,
           type_code, type_name, axis_h, axis_c, axis_w, axis_counts,
           radar_safety, radar_trust, radar_bound, radar_conflict, radar_connect,
           entry_url, referrer_url, src, utm_source, utm_medium, utm_campaign,
           device_type, os, browser, user_agent, ip_hash
         ) values (?,?,?,?,?, 'general','general',?,?,?, ?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?,?)`
      )
      .bind(
        responseId, now, now, meta.questionSetVersion, requestId,
        refCode, referrerCode, trim(payload.frame, MAX_SHORT),
        s.typeCode, s.typeName, s.axisH, s.axisC, s.axisW, JSON.stringify(s.axisCounts),
        radar.safety, radar.trust, radar.bound, radar.conflict, radar.connect,
        trim(payload.entryUrl, MAX_URL), trim(payload.referrerUrl, MAX_URL),
        trim(payload.src, MAX_SHORT), trim(payload.utmSource, MAX_SHORT),
        trim(payload.utmMedium, MAX_SHORT), trim(payload.utmCampaign, MAX_SHORT),
        deviceType, os, browser, ua, ipHash
      ),
  ];

  // 24問すべて。前9問は二択、後15問はリッカート。
  const insertAnswer = db.prepare(
    `insert into response_answers (response_id, order_no, question_key, kind, axis, value)
     values (?,?,?,?,?,?)`
  );
  QUESTIONS.forEach((q, i) => {
    statements.push(insertAnswer.bind(responseId, i + 1, `bin-${i + 1}`, 'bin', q.axis, String(answers[i])));
  });
  RADAR_Q.forEach((q, i) => {
    const n = QUESTIONS.length + i;
    statements.push(insertAnswer.bind(responseId, n + 1, `lik-${i + 1}`, 'lik', q.axis, String(answers[n])));
  });

  await db.batch(statements);

  const session = await createResultSession(db, {
    responseId,
    ipHash,
    uaHash: await saltedHash(ua, meta.ipHashSalt),
    now,
    limits: meta.limits,
  });

  return {
    ok: true,
    responseId,
    typeCode: s.typeCode,
    sessionId: session.id,
    tabToken: session.tabToken,
    duplicate: false,
  };
}

/**
 * 二重送信のとき用。生きている結果セッションがあればそれを返し、無ければ作り直す。
 * 要件 F1-3 の「重複は同じ結果セッションを返す」。
 */
async function reuseOrCreateSession(
  db: D1Database,
  responseId: string,
  meta: RequestMeta
): Promise<{ id: string; tabToken: string }> {
  const now = isoNow();
  const alive = await db
    .prepare(
      `select id, tab_token from result_sessions
        where response_id = ? and closed_at is null and expires_at > ?
        order by issued_at desc limit 1`
    )
    .bind(responseId, now)
    .first<{ id: string; tab_token: string }>();
  if (alive) return { id: alive.id, tabToken: alive.tab_token };

  const created = await createResultSession(db, {
    responseId,
    ipHash: await saltedHash(meta.ip, meta.ipHashSalt),
    now,
    limits: meta.limits,
  });
  return { id: created.id, tabToken: created.tabToken };
}
