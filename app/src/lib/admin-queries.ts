/**
 * Admin が使う問い合わせ。
 *
 * 要件：アプリ化要件定義.md F2-2〜F2-7。
 * 画面（views/admin/*）と CSV（F2-7）が**同じ絞り込みを共有する**ように、
 * 条件の組み立てはここに1本化する。CSVだけ条件が違う、が起きないようにするため。
 *
 * SQLは必ずプレースホルダで組む。並べ替えの列名だけは値で渡せないので、
 * 許可リストに載っているものしか通さない。
 */
import { jstDayEnd, jstDayStart } from './admin-format.ts';

/** 回答の対応状況（旧スプレッドシートの手入力列の置き換え。F1-1）。 */
export const RESPONSE_STATUSES = ['未対応', '対応中', '対応済', '見送り'] as const;
/** 体験セッション申込のステータス（F1-2）。 */
export const APPLICATION_STATUSES = ['未対応', '日程調整中', '実施済', '成約', '辞退'] as const;
/** 法人リードのステータス。 */
export const CORP_STATUSES = ['未対応', '連絡済', '商談化', '見送り'] as const;

export const PER_PAGE = 50;

export type ResponseFilters = {
  from?: string;
  to?: string;
  type?: string;
  ref?: string;
  src?: string;
  /** 申込フォームへの到達の有無。'yes' | 'no' */
  visit?: string;
  status?: string;
  /** フリーワード（ヒアリング本文）。F2-2 */
  q?: string;
  sort?: string;
  dir?: string;
  page?: number;
};

const SORT_COLUMNS: Record<string, string> = {
  created_at: 'r.created_at',
  type_code: 'r.type_code',
  applied_at: 'applied_at',
};

export function normalizeFilters(raw: Record<string, string | undefined>): ResponseFilters {
  const pick = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);
  return {
    from: pick(raw.from),
    to: pick(raw.to),
    type: pick(raw.type),
    ref: pick(raw.ref),
    src: pick(raw.src),
    visit: raw.visit === 'yes' || raw.visit === 'no' ? raw.visit : undefined,
    status: pick(raw.status),
    q: pick(raw.q),
    sort: raw.sort && raw.sort in SORT_COLUMNS ? raw.sort : 'created_at',
    dir: raw.dir === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Number(raw.page) || 1),
  };
}

/** LIKE のワイルドカードを打ち消す。バックスラッシュを escape 句と組にして使う。 */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => '\\' + m);
}

/** 絞り込み条件を where 句とバインド値に落とす。 */
function whereOf(f: ResponseFilters): { sql: string; binds: unknown[] } {
  const parts = ['r.deleted_at is null'];
  const binds: unknown[] = [];

  const from = f.from ? jstDayStart(f.from) : null;
  if (from) { parts.push('r.created_at >= ?'); binds.push(from); }
  const to = f.to ? jstDayEnd(f.to) : null;
  if (to) { parts.push('r.created_at < ?'); binds.push(to); }

  if (f.type) { parts.push('r.type_code = ?'); binds.push(f.type); }
  if (f.ref) { parts.push('r.ref_code = ?'); binds.push(f.ref); }
  if (f.src) { parts.push('r.src = ?'); binds.push(f.src); }
  if (f.status) {
    // NULL は「未対応」として扱う。旧シートでは空欄＝未対応だったため。
    if (f.status === '未対応') parts.push("(r.admin_status is null or r.admin_status = '' or r.admin_status = '未対応')");
    else { parts.push('r.admin_status = ?'); binds.push(f.status); }
  }
  if (f.visit === 'yes') parts.push('exists (select 1 from apply_visits av where av.response_id = r.id)');
  if (f.visit === 'no') parts.push('not exists (select 1 from apply_visits av where av.response_id = r.id)');
  if (f.q) {
    // ?1 のような番号付きプレースホルダは使わない。D1 の bind() は 1 から順に割り当てるので、
    // 番号付きと ? を混ぜると、前の条件のバインド値をこちらが拾ってしまう。
    // 同じ値を必要な数だけ push する。
    const like = `%${escapeLike(f.q)}%`;
    parts.push(`(h.now_text like ? escape '\\' or h.future_text like ? escape '\\' or r.admin_note like ? escape '\\')`);
    binds.push(like, like, like);
  }
  return { sql: parts.join(' and '), binds };
}

/**
 * 一覧の1行（F2-2）と、CSVの1行（F2-7）。
 *
 * 取る列だけが違って、**結合と集計と絞り込みは同じ**にする。別々に書くと、片方だけ条件が
 * ずれていても気づけない。バインドの順番は「where のバインド → limit/offset」で固定する。
 */
const LIST_AGGREGATES = `
         ref.name as referrer_name,
         (select count(*) from apply_visits av where av.response_id = r.id) as visit_count,
         (select min(av.visited_at) from apply_visits av where av.response_id = r.id) as first_visit_at,
         (select count(*) from session_applications sa
           where sa.response_id = r.id and sa.deleted_at is null) as application_count,
         (select max(sa.created_at) from session_applications sa
           where sa.response_id = r.id and sa.deleted_at is null) as applied_at
    from responses r
    left join referrers ref on ref.code = r.referrer_code
    left join hearings h on h.response_id = r.id`;

const selectWith = (columns: string) => `select ${columns},${LIST_AGGREGATES}`;

/** 画面の一覧。出す列だけを取る。 */
const LIST_SELECT = selectWith(`r.id, r.created_at, r.type_code, r.type_name, r.ref_code, r.src,
         r.guide_opened_at, r.guide_max_chapter, r.guide_completed_at,
         r.admin_status, r.question_set_version, r.shared_at`);

/** CSV。5軸や端末まで要るので、回答の全列を取る。 */
const CSV_SELECT = selectWith('r.*');

export type ResponseListRow = {
  id: string;
  created_at: string;
  type_code: string;
  type_name: string;
  ref_code: string | null;
  src: string | null;
  guide_opened_at: string | null;
  guide_max_chapter: number | null;
  guide_completed_at: string | null;
  admin_status: string | null;
  question_set_version: string;
  shared_at: string | null;
  referrer_name: string | null;
  visit_count: number;
  first_visit_at: string | null;
  application_count: number;
  applied_at: string | null;
};

export async function listResponses(
  db: D1Database,
  f: ResponseFilters,
  perPage = PER_PAGE
): Promise<{ rows: ResponseListRow[]; total: number; page: number; pages: number }> {
  const w = whereOf(f);
  const page = Math.max(1, f.page ?? 1);
  const order = `${SORT_COLUMNS[f.sort ?? 'created_at']} ${f.dir === 'asc' ? 'asc' : 'desc'}`;

  const totalRow = await db
    .prepare(`select count(*) as n from (${LIST_SELECT} where ${w.sql})`)
    .bind(...w.binds)
    .first<{ n: number }>();
  const total = totalRow?.n ?? 0;

  const { results } = await db
    .prepare(`${LIST_SELECT} where ${w.sql} order by ${order}, r.created_at desc limit ? offset ?`)
    .bind(...w.binds, perPage, (page - 1) * perPage)
    .all<ResponseListRow>();

  return { rows: results ?? [], total, page, pages: Math.max(1, Math.ceil(total / perPage)) };
}

/**
 * CSV用（F2-7）。ページングなしで、**回答の全列**と集計を返す。
 * 一覧用の列だけ引いて足りないぶんを別に引くと、絞り込みの外まで読むことになる。
 */
export async function listResponsesForCsv(
  db: D1Database,
  f: ResponseFilters,
  limit = 50_000
): Promise<(ResponseListRow & Record<string, string | number | null>)[]> {
  const w = whereOf(f);
  const { results } = await db
    .prepare(`${CSV_SELECT} where ${w.sql} order by r.created_at desc limit ?`)
    .bind(...w.binds, limit)
    .all<ResponseListRow & Record<string, string | number | null>>();
  return results ?? [];
}

/** 絞り込みのプルダウンに出す候補。実データにある値だけを出す。 */
export async function filterOptions(db: D1Database): Promise<{ refs: string[]; srcs: string[] }> {
  const refs = await db
    .prepare(`select distinct ref_code as v from responses where ref_code is not null and ref_code <> '' order by v`)
    .all<{ v: string }>();
  const srcs = await db
    .prepare(`select distinct src as v from responses where src is not null and src <> '' order by v`)
    .all<{ v: string }>();
  return { refs: (refs.results ?? []).map((r) => r.v), srcs: (srcs.results ?? []).map((r) => r.v) };
}

// ───────── 回答詳細（F2-3） ─────────

export type ResponseDetail = Record<string, string | number | null>;

export async function loadResponse(db: D1Database, id: string): Promise<ResponseDetail | null> {
  return await db
    .prepare(
      `select r.*, ref.name as referrer_name, ref.active as referrer_active
         from responses r left join referrers ref on ref.code = r.referrer_code
        where r.id = ?`
    )
    .bind(id)
    .first<ResponseDetail>();
}

export type AnswerRow = { order_no: number; question_key: string; kind: string; axis: string; value: string };

export async function loadAnswers(db: D1Database, responseId: string): Promise<AnswerRow[]> {
  const { results } = await db
    .prepare(`select order_no, question_key, kind, axis, value from response_answers
               where response_id = ? order by order_no`)
    .bind(responseId)
    .all<AnswerRow>();
  return results ?? [];
}

export type ApplicationRow = {
  id: string;
  created_at: string;
  apply_visit_id: string | null;
  response_id: string | null;
  type_code: string | null;
  name: string;
  email: string;
  concern: string | null;
  preferred_slots: string | null;
  question: string | null;
  source: string;
  status: string;
  held_at: string | null;
  admin_note: string | null;
};

export async function loadRelated(db: D1Database, responseId: string) {
  const [survey, hearing, visits, applications] = await Promise.all([
    db.prepare(`select * from feedback_surveys where response_id = ?`).bind(responseId).first<Record<string, string | null>>(),
    db.prepare(`select * from hearings where response_id = ?`).bind(responseId).first<Record<string, string | null>>(),
    db.prepare(`select id, visited_at, cta,
                       (select count(*) from session_applications sa
                         where sa.apply_visit_id = apply_visits.id and sa.deleted_at is null) as application_count
                  from apply_visits where response_id = ? order by visited_at desc`)
      .bind(responseId).all<{ id: string; visited_at: string; cta: string; application_count: number }>(),
    db.prepare(`select * from session_applications where response_id = ? and deleted_at is null
                 order by created_at desc`).bind(responseId).all<ApplicationRow>(),
  ]);
  return {
    survey: survey ?? null,
    hearing: hearing ?? null,
    visits: visits.results ?? [],
    applications: applications.results ?? [],
  };
}

// ───────── 体験セッション申込（F2-4） ─────────

export type SessionListRow = ApplicationRow & {
  response_created_at: string | null;
  response_type_code: string | null;
  response_type_name: string | null;
  /** 同じ到達IDに2件以上の申込があるか（F4-5・F2-4の警告）。 */
  visit_application_count: number | null;
};

export async function listApplications(
  db: D1Database,
  opts: { status?: string; linked?: string; q?: string; page?: number } = {},
  perPage = PER_PAGE
): Promise<{ rows: SessionListRow[]; total: number; page: number; pages: number }> {
  const parts = ['sa.deleted_at is null'];
  const binds: unknown[] = [];
  if (opts.status) { parts.push('sa.status = ?'); binds.push(opts.status); }
  if (opts.linked === 'no') parts.push('sa.response_id is null');
  if (opts.linked === 'yes') parts.push('sa.response_id is not null');
  if (opts.q) {
    const like = `%${escapeLike(opts.q)}%`;
    parts.push(`(sa.name like ? escape '\\' or sa.email like ? escape '\\')`);
    binds.push(like, like);
  }
  const where = parts.join(' and ');
  const page = Math.max(1, opts.page ?? 1);

  const base = `
    from session_applications sa
    left join responses r on r.id = sa.response_id
   where ${where}`;

  const totalRow = await db.prepare(`select count(*) as n ${base}`).bind(...binds).first<{ n: number }>();
  const { results } = await db
    .prepare(
      `select sa.*, r.created_at as response_created_at, r.type_code as response_type_code,
              r.type_name as response_type_name,
              (select count(*) from session_applications x
                where x.apply_visit_id = sa.apply_visit_id and x.deleted_at is null
                  and sa.apply_visit_id is not null) as visit_application_count
       ${base} order by sa.created_at desc limit ? offset ?`
    )
    .bind(...binds, perPage, (page - 1) * perPage)
    .all<SessionListRow>();

  const total = totalRow?.n ?? 0;
  return { rows: results ?? [], total, page, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function loadApplication(db: D1Database, id: string): Promise<SessionListRow | null> {
  return await db
    .prepare(
      `select sa.*, r.created_at as response_created_at, r.type_code as response_type_code,
              r.type_name as response_type_name,
              (select count(*) from session_applications x
                where x.apply_visit_id = sa.apply_visit_id and x.deleted_at is null
                  and sa.apply_visit_id is not null) as visit_application_count
         from session_applications sa
         left join responses r on r.id = sa.response_id
        where sa.id = ?`
    )
    .bind(id)
    .first<SessionListRow>();
}

/**
 * 手動で紐づけるときの候補（F2-4）。
 * **同じタイプで、申込時刻の直前に申込フォームへ到達した回答**を新しい順に出す。
 * 到達が無い回答も、同じタイプ・近い時刻なら候補に混ぜる（?v= が落ちた場合に到達も残らないため）。
 */
export async function linkCandidates(
  db: D1Database,
  app: { created_at: string; type_code: string | null },
  limit = 10
): Promise<{ id: string; created_at: string; type_code: string; type_name: string; visited_at: string | null; email_hint: string | null }[]> {
  const { results } = await db
    .prepare(
      `select r.id, r.created_at, r.type_code, r.type_name,
              (select max(av.visited_at) from apply_visits av where av.response_id = r.id) as visited_at,
              null as email_hint
         from responses r
        where r.deleted_at is null
          and (? is null or r.type_code = ?)
          and r.created_at <= ?
          and not exists (select 1 from session_applications sa
                           where sa.response_id = r.id and sa.deleted_at is null)
        order by coalesce((select max(av.visited_at) from apply_visits av where av.response_id = r.id),
                          r.created_at) desc
        limit ?`
    )
    .bind(app.type_code, app.type_code, app.created_at, limit)
    .all<{ id: string; created_at: string; type_code: string; type_name: string; visited_at: string | null; email_hint: string | null }>();
  return results ?? [];
}

// ───────── 法人リード（F2-5） ─────────

export type CorpLeadRow = {
  id: string; created_at: string; email: string; issues: string | null; detail: string | null;
  ref_code: string | null; page: string | null; status: string; admin_note: string | null;
};

export async function listCorpLeads(
  db: D1Database,
  opts: { status?: string; page?: number } = {},
  perPage = PER_PAGE
): Promise<{ rows: CorpLeadRow[]; total: number; page: number; pages: number }> {
  const parts = ['deleted_at is null'];
  const binds: unknown[] = [];
  if (opts.status) { parts.push('status = ?'); binds.push(opts.status); }
  const where = parts.join(' and ');
  const page = Math.max(1, opts.page ?? 1);
  const totalRow = await db.prepare(`select count(*) as n from corp_leads where ${where}`).bind(...binds).first<{ n: number }>();
  const { results } = await db
    .prepare(`select * from corp_leads where ${where} order by created_at desc limit ? offset ?`)
    .bind(...binds, perPage, (page - 1) * perPage)
    .all<CorpLeadRow>();
  const total = totalRow?.n ?? 0;
  return { rows: results ?? [], total, page, pages: Math.max(1, Math.ceil(total / perPage)) };
}

// ───────── 紹介者マスタ（F2-6） ─────────

export type ReferrerRow = {
  code: string; name: string; note: string | null; active: number; created_at: string;
  response_count: number; guide_count: number; application_count: number;
};

/** 紹介者ごとの実績（回答数・ガイド到達数・申込数）を付けて返す（F2-6）。 */
export async function listReferrers(db: D1Database): Promise<ReferrerRow[]> {
  const { results } = await db
    .prepare(
      `select f.code, f.name, f.note, f.active, f.created_at,
              (select count(*) from responses r
                where r.referrer_code = f.code and r.deleted_at is null) as response_count,
              (select count(*) from responses r
                where r.referrer_code = f.code and r.deleted_at is null
                  and r.guide_opened_at is not null) as guide_count,
              (select count(*) from session_applications sa
                 join responses r2 on r2.id = sa.response_id
                where r2.referrer_code = f.code and sa.deleted_at is null) as application_count
         from referrers f order by f.active desc, f.created_at desc`
    )
    .all<ReferrerRow>();
  return results ?? [];
}

/**
 * 紹介者コードを作る（F2-6）。イニシャル（英大文字）＋ランダム英数字5文字。
 * 紛らわしい字（0/O・1/l/I）は使わない。大小だけ違うコードは作らない
 * （旧運用の VLOOKUP が大文字小文字を区別しなかったため、取り違えの事故が起きる）。
 */
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function makeReferrerCode(initials: string): string {
  const head = (initials.replace(/[^A-Za-z]/g, '').slice(0, 2) || 'XX').toUpperCase();
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return head + rand;
}

/** 既存コードと大小無視で衝突しないコードを作る。 */
export async function issueReferrerCode(db: D1Database, initials: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = makeReferrerCode(initials);
    const hit = await db.prepare(`select code from referrers where lower(code) = lower(?)`).bind(code).first();
    if (!hit) return code;
  }
  throw new Error('紹介者コードを発行できませんでした');
}
