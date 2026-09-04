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

// ── CSS と、結果画面の素のHTML ──
// 見た目は prototype.html の <style> をそのまま使う。書き写すと F3-1 が崩れるため。
function between(startRe, endRe) {
  const a = startRe.exec(html);
  if (!a) throw new Error(`開始が見つかりません: ${startRe}`);
  const from = a.index + a[0].length;
  const b = endRe.exec(html.slice(from));
  if (!b) throw new Error(`終了が見つかりません: ${endRe}`);
  return html.slice(from, from + b.index);
}

const css = between(/<style>\n/, /<\/style>/);

// 結果画面の素のHTML。サーバ側の描画が、同じクラス名・同じ入れ子で組めているかを
// tools/markup-check.mjs が突き合わせるための参照。
const resultSection = between(/<!-- RESULT -->\n/, /\n  <!-- GUIDE/);

writeFileSync(
  resolve(OUT, 'styles.ts'),
  banner('prototype.html の <style> をそのまま写したもの') +
`
/** prototype.html の <style> の中身。1文字も変えない。 */
export const APP_CSS = ${JSON.stringify(css)};
`);

writeFileSync(
  resolve(OUT, 'result-markup.ts'),
  banner('結果画面の素のHTML（照合用）') +
`
/**
 * prototype.html の <!-- RESULT --> 節の素のHTML。
 * アプリはこれを直接使わず、サーバ側で同じ構造を組み立てる。
 * tools/markup-check.mjs が、組み立てた結果とこれのクラス名・id を突き合わせる。
 */
export const RESULT_MARKUP = ${JSON.stringify(resultSection)};
`);

// prototype.html が使っているクラス名の全集合。静的な markup と、JSが組み立てる文字列の両方から集める。
// サーバ側の描画に、ここに無いクラスが出てきたら打ち間違い（tools/markup-check.mjs が見る）。
const protoClasses = new Set();
for (const m of html.matchAll(/class="([^"]*)"/g)) {
  for (const c of m[1].split(/\s+/)) if (c) protoClasses.add(c);
}
for (const m of html.matchAll(/className\s*=\s*['"]([^'"]*)['"]/g)) {
  for (const c of m[1].split(/\s+/)) if (c) protoClasses.add(c);
}
// `'axis-row'+(cond?' is-on':'')` のような組み立ても拾う
for (const m of html.matchAll(/className\s*=\s*'([^']*)'\s*\+/g)) {
  for (const c of m[1].split(/\s+/)) if (c) protoClasses.add(c);
}
// JSの文字列結合で作られるクラス（'<span class="ray '+rayPos[i]+'">' や (leftOn?'on':'')）は
// 上のどのパターンにも現れない。CSSのセレクタ側から拾って補う。
// CSSに定義があるということは、prototype.html が使う正当なクラス名である。
for (const m of css.matchAll(/\.([a-zA-Z][\w-]*)/g)) protoClasses.add(m[1]);

writeFileSync(
  resolve(OUT, 'proto-classes.ts'),
  banner('prototype.html が使っているクラス名の全集合（照合用）') +
`
/** サーバ側の描画がこの集合の外のクラスを使っていたら、打ち間違いを疑う。 */
export const PROTO_CLASSES: readonly string[] = ${j([...protoClasses].sort())};
`);

console.log('生成しました:');
console.log(`  APP_CSS          ${css.length} 文字`);
console.log(`  PROTO_CLASSES    ${protoClasses.size} 種`);
console.log(`  RESULT_MARKUP    ${resultSection.length} 文字`);
for (const [k, val] of Object.entries(v)) {
  const n = Array.isArray(val) ? val.length : (typeof val === 'object' ? Object.keys(val).length : 1);
  console.log(`  ${k.padEnd(16)} ${n}`);
}
