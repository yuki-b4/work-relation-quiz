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
  domain: 'あなたが悩んでいる人間関係は？',
  target: '誰との関係ですか',
  deadline: 'いつまでの話ですか',
} as const;

/** ①②③ の並びは §3.8 の A-1 のまま。③は現行の読み解きガイドへ送る（A-3）。 */
export const DOMAINS: readonly Option[] = [
  { value: 'work', label: '職場の特定の人との関係' },
  { value: 'love', label: '恋愛・結婚の関係' },
  { value: 'unknown', label: '特に決まってない' },
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
 * ブリッジ（宣言 → 読み解きガイド）で出す3本の文（2026-09-12にユーザー指摘で改稿）。
 *
 * 並びは「回答のお礼 → **悩みの理由の名指し** → あなたのトリセツ1枚 → 強みと落とし穴 →
 * ガイドの意味 → CTA」。宣言で受け取った場面と相手をそのまま文に入れるので、
 * 自分ごと化はコピーの上手さでなく**相手の固有情報**で起こる
 * （`0to1マーケティング戦略.md` §3.6）。
 *
 * 言ってよいことの範囲は `個人商品定義.md` §1.2 と §2.3。
 *   ・**原因を内面（価値観・マインド）に置かない。** 置くのは「持っているものを活かせていない」
 *     という**伸び代**の言い方で、ガイドの「裏モードは欠陥ではない」と同じ向きにする
 *   ・**相手が変わる・悩みが解決するとは書かない**
 */

/** お礼。宣言の直後に置いて、聞きっぱなしにしない。 */
export const BRIDGE_EYEBROW = '回答ありがとうございました。';

/**
 * 悩みの理由の名指し。**宣言した場面と相手を差し込む。**
 *
 * 「うまくいくパターン」は結果カードのトリセツ1枚目「こう接すると、うまくいく」を指す
 * （全8タイプで同じ見出しなので、どのタイプでも指すものがずれない）。
 */
const CAUSE_TEMPLATES: Record<DomainCode, (subject: string) => string> = {
  work: (s) => `職場において${s}との関係で悩む理由の一つが、あなたのうまくいくパターンを活かせていないことです。`,
  love: (s) => `恋愛・結婚において${s}との関係で悩む理由の一つが、あなたのうまくいくパターンを活かせていないことです。`,
  // 特に決まってない：相手も場面も無いので、関係を限定しない言い方にする
  unknown: () => '人間関係で悩む理由の一つが、あなたのうまくいくパターンを活かせていないことです。',
};

/** 宣言の組み合わせを表す鍵。ブリッジはこの鍵で文を出し分ける。 */
export const slotKey = (domain: string, target: string | null): string =>
  domain === 'unknown' || !target ? 'unknown' : `${domain}:${target}`;

/**
 * 出しうる「悩みの理由」の全パターン。
 * **その場で文字列を組み立てさせない**で、全部描いておき選ばれた1本だけを見せる。
 */
export function allCauses(): { key: string; text: string }[] {
  const out = [{ key: 'unknown', text: CAUSE_TEMPLATES.unknown('') }];
  for (const d of ['work', 'love'] as const) {
    for (const t of TARGETS[d]) out.push({ key: slotKey(d, t.value), text: CAUSE_TEMPLATES[d](t.subject) });
  }
  return out;
}

/**
 * トリセツ1枚を見せたあとの一般化。`{type}` にその人のタイプ名が入る
 * （結果カードから借りるので、ここにタイプ別の文面は持たない）。
 * 「このような」は**すぐ上のトリセツ1枚**を指すので、カードとこの文は必ず一緒に出す。
 *
 * **強みと落とし穴を同時に置く。** 落とし穴だけを言うと欠陥の指摘になり、
 * 「裏モードは欠陥でなく伸び代」という診断とガイドの教育と反転する。
 */
export const TYPE_NOTE =
  '{type}のあなたは、このような人間関係の中で生かせる強みがあります。' +
  '一方で、悩みの原因となりやすい落とし穴もあるのです。';

/**
 * ガイドの意味づけ（CTAの直前）。
 *
 * **ここでガイドの中身を約束しすぎない。** 現行ガイドは自然体（関係に依存しない自分側）を
 * 扱うもので、「あなたとあの人の力学を読み解く」のは段3の見立て。
 *
 * **ここだけ素のHTMLを含む**（改行と強調）。描くときにエスケープしないので、
 * 書き換えるときはタグの対応を崩さないこと。
 */
export const BRIDGE_NOTE =
  'あなたが陥りやすい罠を、読み解きガイドとしてまとめました。<br>' +
  'あなたの中の<b>もう一人の自分</b>を知れば、' +
  'どうして人間関係に悩むのかヒントが見つかるはずです。';

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
