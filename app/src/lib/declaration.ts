/**
 * 宣言（施策a 段1）の選択肢と検証。
 *
 * 正：集客戦略マップ.md §3.3（宣言＝「どの場面の、誰との、いつまでの話か」）／
 *     §3.6（結果画面の直後にフォークを置く）／§3.8（A-1〜A-4・列の意味）
 *
 * **宣言を取る場所はフォーク1か所だけ**（2026-09-12に確定）。申込フォームでは聞かない。
 * 宣言がある人はその値を体験セッションで使い、無い人はセッションの場で聞く
 * （§4.2 の1段目）。同じことを2回聞かない。
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

/**
 * ①②③ の並びは §3.8 の A-1 のまま。③は現行の読み解きガイドへ送る（A-3）。
 * `short` はブリッジの副題に出す短い呼び方（選択肢の文をそのまま二度出すと読みにくい）。
 */
export const DOMAINS: readonly (Option & { short: string })[] = [
  { value: 'work', label: '職場の、あの人との関係', short: '職場' },
  { value: 'love', label: '恋愛・結婚の関係', short: '恋愛・結婚' },
  { value: 'unknown', label: 'まだ分からない', short: 'まだ分からない' },
];

/**
 * 相手の立場（§3.8：上司・同僚・部下・パートナー・家族 など）。
 * 場面ごとに出し分ける。段2で相手のタイプを推定するときも、ここは聞き直さない。
 */
export const TARGETS: Record<'work' | 'love', readonly (Option & { subject: string })[]> = {
  work: [
    { value: 'boss', label: '上司', subject: '上司' },
    { value: 'peer', label: '同僚', subject: '同僚' },
    { value: 'report', label: '部下', subject: '部下' },
    // 「その他と話した日に」は日本語として壊れるので、約束の中では総称に戻す
    { value: 'other', label: 'その他', subject: 'あの人' },
  ],
  love: [
    { value: 'partner', label: 'パートナー', subject: 'パートナー' },
    { value: 'family', label: '家族', subject: '家族' },
    { value: 'other', label: 'その他', subject: '大切な人' },
  ],
};

export const DEADLINES: readonly Option[] = [
  { value: 'now', label: '今すぐ' },
  { value: 'months', label: '数ヶ月のうち' },
  { value: 'none', label: '期限はない' },
];

/**
 * 宣言の直後に返す約束（A-1のブリッジ画面）。
 *
 * **正は `集客戦略マップ.md` §3.5 の確定文言**（2026-09-10確定）。ここは写しなので、
 * 変えるときは §3.5 を先に直す。言ってよいことの範囲は `個人商品定義.md` §1.2 の
 * 「言うこと／言わないこと」。**相手が変わる・悩みが解決するとは書かない。**
 *
 * ドメインを選んだ人には場面別の言い換えを、③まだ分からないの人には主約束を返す。
 *
 * **宣言した相手の名前を入れる**のが肝で、§3.5 の「場面別ページでは『あの人』を補って
 * 具体に落とす（核は変えず、相手と場面だけ差し替える）」をそのまま実装している。
 * 自分ごと化はコピーの上手さでなく相手の固有情報で起こる（`0to1マーケティング戦略.md` §3.6）。
 */
const PROMISE_TEMPLATES: Record<DomainCode, (subject: string) => string> = {
  work: (s) => `${s}と話した日に、どっと疲れて帰るのをやめる。`,
  love: (s) => `${s}といるときほど、なぜか自分だけがすり減る。それをやめる。`,
  // ③まだ分からない：相手がいないので主約束をそのまま返す
  unknown: () => '自分だけがすり減る関係性を終わりにして、自然体でいられる関係性を始める。',
};

/** 宣言の組み合わせを表す鍵。ブリッジはこの鍵で約束を出し分ける。 */
export const promiseKey = (domain: string, target: string | null): string =>
  domain === 'unknown' || !target ? 'unknown' : `${domain}:${target}`;

/** 出しうる約束の全パターン（ブリッジがまとめて描いて、選ばれた1本だけ見せる）。 */
export function allPromises(): { key: string; text: string }[] {
  const out = [{ key: 'unknown', text: PROMISE_TEMPLATES.unknown('') }];
  for (const d of ['work', 'love'] as const) {
    for (const t of TARGETS[d]) out.push({ key: promiseKey(d, t.value), text: PROMISE_TEMPLATES[d](t.subject) });
  }
  return out;
}

/**
 * ブリッジ画面で、約束のあとに置く一文。
 *
 * **ここでガイドの中身を約束しすぎない。** 現行ガイドは自然体（関係に依存しない自分側）を
 * 扱うもので、「あなたとあの人の力学を読み解く」のは段3の見立て。だから書くのは
 * 「ガイドが何から始まり、何を読み解くか」までにとどめる。章の名前は結果カードと同じ
 * （`prototype.html` の day-list）。
 *
 * **ここだけ素のHTMLを含む**（改行と強調）。描くときにエスケープしないので、
 * 書き換えるときはタグの対応を崩さないこと。
 */
export const BRIDGE_NOTE =
  // 「その関係で」と書かないのは、③まだ分からないの人には名指しした関係がまだ無いため
  'いま何が起きているかは、まず自分の側から見えてきます。<br>' +
  '読み解きガイドは序章「なぜ、相手ではなく自分から始めるのか」から始まり、' +
  '第一章で<b>あなたが自然体でいられる環境</b>を、' +
  '第二章で<b>あなたの中の「もう一人のあなた」</b>を読み解きます。';

/** ③まだ分からないを選んだ人の見出し（相手がいないので、読み上げる相手が無い）。 */
export const BRIDGE_HEADLINE_UNKNOWN = 'どこで使うかは、これから決める';

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
 * 入力を宣言に直す。使うのは `POST /api/declaration`（フォーク）だけ。
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
