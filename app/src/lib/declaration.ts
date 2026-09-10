/**
 * 宣言（施策a 段1）の選択肢と検証。
 *
 * 正：集客戦略マップ.md §3.3（宣言＝「どの場面の、誰との、いつまでの話か」）／
 *     §3.6（結果画面の直後にフォークを置く）／§3.8（A-1〜A-4・列の意味）
 *
 * 宣言を取る場所は2つある。
 *   ・結果画面の直後のフォーク（A-1）……3クリック以内。views/result-page.ts
 *   ・申込フォームの構造化宣言（A-4）……必須。views/apply-page.ts
 * 片方だけ選択肢を増やすと集計が割れるので、**選択肢はこのファイルにだけ置く**。
 *
 * DBへはコード（'work' など）で入れる。画面の言葉を変えても記録が割れないため。
 * 画面に出す言葉はここの label で引く（段2以降で見立ての文面を作るときも、
 * 入口はこの3つの値だけになる）。
 */

export type DomainCode = 'work' | 'love' | 'unknown';
export type Option = { value: string; label: string };

/** 設問文。フォークと申込フォームで同じ言葉を使う（違うと同じ列に別の意味が入る）。 */
export const DECLARE_QUESTIONS = {
  domain: 'この結果を、どこで使いますか',
  target: '誰との関係ですか',
  deadline: 'いつまでの話ですか',
} as const;

/** ①②③ の並びは §3.8 の A-1 のまま。③は現行の読み解きガイドへ送る（A-3）。 */
export const DOMAINS: readonly Option[] = [
  { value: 'work', label: '職場の、あの人との関係' },
  { value: 'love', label: '恋愛・結婚の関係' },
  { value: 'unknown', label: 'まだ分からない' },
];

/**
 * 相手の立場（§3.8：上司・同僚・部下・パートナー・家族 など）。
 * 場面ごとに出し分ける。段2で相手のタイプを推定するときも、ここは聞き直さない。
 */
export const TARGETS: Record<'work' | 'love', readonly Option[]> = {
  work: [
    { value: 'boss', label: '上司' },
    { value: 'peer', label: '同僚' },
    { value: 'report', label: '部下' },
    { value: 'other', label: 'その他' },
  ],
  love: [
    { value: 'partner', label: 'パートナー' },
    { value: 'family', label: '家族' },
    { value: 'other', label: 'その他' },
  ],
};

export const DEADLINES: readonly Option[] = [
  { value: 'now', label: '今すぐ' },
  { value: 'months', label: '数ヶ月のうち' },
  { value: 'none', label: '期限はない' },
];

export type Declaration = {
  domain: DomainCode;
  /** 場面が 'unknown' のときは null（相手を特定できないため聞かない）。 */
  target: string | null;
  deadline: string | null;
};

/** 保存値（コード）→ 画面に出す言葉。Admin・CSV・通知が使う。知らない値は null。 */
type Stored = string | null | undefined;

const labelOf = (list: readonly Option[], value: Stored): string | null =>
  list.find((o) => o.value === value)?.label ?? null;

export const domainLabel = (v: Stored): string | null => labelOf(DOMAINS, v);
export const deadlineLabel = (v: Stored): string | null => labelOf(DEADLINES, v);

export function targetLabel(domain: Stored, v: Stored): string | null {
  if (domain !== 'work' && domain !== 'love') return null;
  return labelOf(TARGETS[domain], v);
}

/** Admin と通知に出す1行。宣言が無ければ null。 */
export function declarationText(d: {
  concern_domain?: string | null;
  concern_target?: string | null;
  concern_deadline?: string | null;
}): string | null {
  const domain = domainLabel(d.concern_domain ?? null);
  if (!domain) return null;
  const parts = [
    domain,
    targetLabel(d.concern_domain ?? null, d.concern_target ?? null),
    deadlineLabel(d.concern_deadline ?? null),
  ].filter((x): x is string => !!x);
  return parts.join('／');
}

export type ParseResult =
  | { ok: true; value: Declaration }
  | { ok: false; message: string };

/**
 * 入力を宣言に直す。フォーク（A-1）と申込フォーム（A-4）が同じ規則で通る。
 *
 * ・場面は必ず要る
 * ・場面が 'unknown' のときだけ、相手と期限が空でよい（③は相手を特定しない）
 * ・相手のコードは**場面と組で**照合する。場面が恋愛なのに相手が「上司」は通さない
 */
export function parseDeclaration(input: {
  domain?: unknown;
  target?: unknown;
  deadline?: unknown;
}): ParseResult {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const domain = str(input.domain);
  if (!DOMAINS.some((o) => o.value === domain)) {
    return { ok: false, message: `${DECLARE_QUESTIONS.domain}。ひとつ選んでください。` };
  }
  if (domain === 'unknown') {
    return { ok: true, value: { domain: 'unknown', target: null, deadline: null } };
  }
  const d = domain as 'work' | 'love';
  const target = str(input.target);
  if (!TARGETS[d].some((o) => o.value === target)) {
    return { ok: false, message: `${DECLARE_QUESTIONS.target}。ひとつ選んでください。` };
  }
  const deadline = str(input.deadline);
  if (!DEADLINES.some((o) => o.value === deadline)) {
    return { ok: false, message: `${DECLARE_QUESTIONS.deadline}。ひとつ選んでください。` };
  }
  return { ok: true, value: { domain: d, target, deadline } };
}
