/**
 * 移植した採点ロジック（src/lib/scoring.ts）が、prototype.html の元の実装と
 * 完全に同じ結果を出すかを検証する。
 *
 *   node --experimental-strip-types tools/parity-check.mjs
 *
 * 元の実装は、prototype.html から関数のソースをそのまま抜き出して評価する。
 * 書き写しではないので、F3-1（現行踏襲）を実際に担保できる。
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { score, validateAnswers, ANSWER_COUNT } from '../src/lib/scoring.ts';
import { AX, QUESTIONS, RADAR_AXES, RADAR_Q } from '../src/content/quiz.ts';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(here, '../../prototype.html'), 'utf8');

/** prototype.html から `function NAME(...){...}` を丸ごと切り出す。 */
function fnSource(name) {
  const m = new RegExp(`^function\\s+${name}\\s*\\(`, 'm').exec(html);
  if (!m) throw new Error(`関数が見つかりません: ${name}`);
  const start = m.index;
  let i = html.indexOf('{', start);
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
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return html.slice(start, j + 1); }
  }
  throw new Error(`括弧が閉じていません: ${name}`);
}

// 元の tally / radarScores を、元のソースのまま動かす。
// どちらもモジュールスコープの answers / AX / QUESTIONS / RADAR_* を読むので、同じ形で渡す。
const originalFactory = new Function(
  'AX', 'QUESTIONS', 'RADAR_AXES', 'RADAR_Q',
  `return function (answers) {
     ${fnSource('tally')}
     ${fnSource('radarScores')}
     const h = tally('h'), c = tally('c'), w = tally('w');
     const code = (h.L>=2?'O':'G') + (c.L>=2?'B':'K') + (w.L>=2?'L':'S');
     return { code, counts: { h, c, w }, radar: radarScores() };
   };`
);
const original = originalFactory(AX, QUESTIONS, RADAR_AXES, RADAR_Q);

let checked = 0;
const fails = [];

function compare(answers, label) {
  const a = original(answers);
  const b = score(answers);
  checked++;
  if (a.code !== b.typeCode) {
    fails.push(`${label}: タイプコード ${a.code} != ${b.typeCode}`);
    return;
  }
  for (const k of ['h', 'c', 'w']) {
    const x = a.counts[k], y = b.axisCounts[k];
    if (x.L !== y.L || x.R !== y.R || x.total !== y.total) {
      fails.push(`${label}: ${k}軸のカウント不一致 ${JSON.stringify(x)} != ${JSON.stringify(y)}`);
      return;
    }
  }
  for (const k of RADAR_AXES) {
    if (Math.abs(a.radar[k] - b.radar[k]) > 1e-12) {
      fails.push(`${label}: 5軸 ${k} 不一致 ${a.radar[k]} != ${b.radar[k]}`);
      return;
    }
  }
}

// ── 1. タイプ判定：9問の二択を512通り総当たり（リッカートは全て3で固定） ──
const likFixed = RADAR_Q.map(() => 3);
for (let mask = 0; mask < (1 << QUESTIONS.length); mask++) {
  const bin = QUESTIONS.map((q, i) => {
    const [L, R] = AX[q.axis].poles;
    return (mask >> i) & 1 ? R : L;
  });
  compare([...bin, ...likFixed], `bin mask=${mask}`);
}

// ── 2. 5軸：端と代表値 ──
for (const v of [1, 2, 3, 4]) {
  const bin = QUESTIONS.map((q) => AX[q.axis].poles[0]);
  compare([...bin, ...RADAR_Q.map(() => v)], `lik all=${v}`);
}

// ── 3. 5軸：ランダム 5000 通り ──
let seed = 20260903;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (let n = 0; n < 5000; n++) {
  const bin = QUESTIONS.map((q) => AX[q.axis].poles[rnd() < 0.5 ? 0 : 1]);
  const lik = RADAR_Q.map(() => 1 + Math.floor(rnd() * 4));
  compare([...bin, ...lik], `random#${n}`);
}

// ── 4. 検証（validateAnswers）が不正入力を弾くか ──
const goodBin = QUESTIONS.map((q) => AX[q.axis].poles[0]);
const good = [...goodBin, ...RADAR_Q.map(() => 3)];
const badCases = [
  [good.slice(0, 23), '設問数が足りない'],
  [[...good, 3], '設問数が多い'],
  [[...goodBin.slice(0, 8), 'X', ...RADAR_Q.map(() => 3)], '極が不正'],
  [[...goodBin, ...RADAR_Q.map(() => 5)], 'リッカートが範囲外'],
  [[...goodBin, ...RADAR_Q.map(() => 3.5)], 'リッカートが整数でない'],
  [[...goodBin, ...RADAR_Q.map(() => '3')], 'リッカートが文字列'],
];
const validationFails = [];
if (!validateAnswers(good).ok) validationFails.push('正しい回答が弾かれた');
for (const [bad, label] of badCases) {
  if (validateAnswers(bad).ok) validationFails.push(`不正入力が通った: ${label}`);
}

// ── 結果 ──
console.log(`回答数の定義: ${ANSWER_COUNT} 問`);
console.log(`採点の照合: ${checked} 通り`);
if (fails.length) {
  console.error(`\n不一致 ${fails.length} 件:`);
  fails.slice(0, 20).forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log('  → prototype.html の実装と完全一致');
if (validationFails.length) {
  console.error('\n検証の不備:');
  validationFails.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log(`入力検証: 正常1件 + 不正${badCases.length}件、すべて期待どおり`);
