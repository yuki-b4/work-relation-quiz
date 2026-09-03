/**
 * prototype.html から診断の文面データを機械的に抜き出し、app/src/content/*.ts を生成する。
 *
 *   node tools/extract-content.mjs
 *
 * 手で書き写すと F3-1（現行踏襲）が静かに崩れるので、必ずこのスクリプトで再生成する。
 * 文面の正は prototype.html と ガイド文面24本.md のまま。ここはその写しを作るだけ。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../prototype.html');
const OUT = resolve(here, '../src/content');

const html = readFileSync(SRC, 'utf8');

/** `const NAME = <literal>;` の literal 部分を、括弧の対応を数えて切り出す。 */
function literalOf(name) {
  const m = new RegExp(`^const\\s+${name}\\s*=\\s*`, 'm').exec(html);
  if (!m) throw new Error(`宣言が見つかりません: ${name}`);
  let i = m.index + m[0].length;
  const open = html[i];
  if (open !== '{' && open !== '[') {
    // 文字列リテラル（HONSHITSU_LOOP）
    const end = html.indexOf(';', i);
    return html.slice(i, end);
  }
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = null, esc = false;
  for (let j = i; j < html.length; j++) {
    const ch = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return html.slice(i, j + 1);
    }
  }
  throw new Error(`括弧が閉じていません: ${name}`);
}

/** literal を実際に評価して値にする（JSON化するため）。 */
async function valueOf(name) {
  const src = literalOf(name);
  const mod = `data:text/javascript,export default (${encodeURIComponent(src).replace(/'/g, '%27')})`;
  return (await import(mod)).default;
}

const NAMES = [
  'QUESTIONS', 'RADAR_Q', 'RADAR_AXES', 'RADAR_META', 'AX', 'LIKERT',
  'TYPES', 'TORISET', 'TORI_LABEL', 'HONSHITSU', 'HONSHITSU_LOOP', 'TYPE_ICON',
  'GUIDE_BODY',
];

const v = {};
for (const n of NAMES) v[n] = await valueOf(n);

const banner = (file) => `// 自動生成。直接編集しない。
// 生成元：prototype.html（文面の正）
// 再生成：cd app && node tools/extract-content.mjs
// ${file}
`;

const j = (x) => JSON.stringify(x, null, 2);

writeFileSync(
  resolve(OUT, 'quiz.ts'),
  banner('設問と軸の定義') +
`
/** タイプ判定の3軸。左の極が L、右の極が R。 */
export const AX = ${j(v.AX)} as const;

/** タイプ判定の9問（二択）。answers には選んだ側の極（O/G/B/K/L/S）が入る。 */
export const QUESTIONS = ${j(v.QUESTIONS)} as const;

/** 5つの関わり方傾向の軸。 */
export const RADAR_AXES = ${j(v.RADAR_AXES)} as const;

/** 5軸それぞれの名前と、両極の意味。 */
export const RADAR_META = ${j(v.RADAR_META)} as const;

/** 5軸の15問（4件法リッカート）。answers には 1〜4 が入る。 */
export const RADAR_Q = ${j(v.RADAR_Q)} as const;

/** 4件法の選択肢。表示は右（そう思う）から左（思わない）の順に並べる。 */
export const LIKERT = ${j(v.LIKERT)} as const;

/** 出題順：9問（二択）→ 15問（リッカート）。全24問。 */
export const ITEMS = [
  ...QUESTIONS.map((q) => ({ kind: 'bin' as const, axis: q.axis, text: q.text, a: q.a, b: q.b })),
  ...RADAR_Q.map((q) => ({ kind: 'lik' as const, axis: q.axis, text: q.text })),
];
`);

writeFileSync(
  resolve(OUT, 'types.ts'),
  banner('8タイプの文面') +
`
/** 8タイプ。pole は open / guard で、結果画面のアクセント色を決める。 */
export const TYPES = ${j(v.TYPES)} as const;

/** わたしのトリセツ（4項目）。並びは TORI_LABEL と対応する。 */
export const TORISET = ${j(v.TORISET)} as const;
export const TORI_LABEL = ${j(v.TORI_LABEL)} as const;

/** あなたの深層。core（ほんとうの理由）と cost（その代償）。 */
export const HONSHITSU = ${j(v.HONSHITSU)} as const;

/** 深層の締め。ガイドCTAへの問いかけなので、CTAを出さない時は一緒に畳む。 */
export const HONSHITSU_LOOP = ${j(v.HONSHITSU_LOOP)};

/** エンブレムのSVGパス（自作インライン。外部素材は使わない）。 */
export const TYPE_ICON = ${j(v.TYPE_ICON)} as const;

export type TypeCode = keyof typeof TYPES;
export const TYPE_CODES = Object.keys(TYPES) as TypeCode[];
`);

writeFileSync(
  resolve(OUT, 'guide.ts'),
  banner('読み解きガイドのタイプ別本文') +
`
/**
 * 読み解きガイド（全4章）のタイプ別本文。
 * 文面の正は ガイド文面24本.md。第一章・第二章で使う。
 */
export const GUIDE_BODY = ${j(v.GUIDE_BODY)} as const;
`);

console.log('生成しました:');
for (const [k, val] of Object.entries(v)) {
  const n = Array.isArray(val) ? val.length : (typeof val === 'object' ? Object.keys(val).length : 1);
  console.log(`  ${k.padEnd(16)} ${n}`);
}
