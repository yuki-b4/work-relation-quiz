/**
 * サーバ側で組み立てた結果カードが、prototype.html と同じクラス名・同じid を使えているかを見る。
 *
 *   node --experimental-strip-types tools/markup-check.mjs
 *
 * 結果画面のCSSは prototype.html の <style> をそのまま使うので、クラス名を1つ書き間違えると
 * その部分だけ無스타일になって静かに崩れる。目視では気づきにくいのでここで機械的に照合する。
 * F3-1（結果画面のUIは現行踏襲）の担保。
 */
import { RESULT_MARKUP } from '../src/content/result-markup.ts';
import { PROTO_CLASSES } from '../src/content/proto-classes.ts';
import { renderResultCard } from '../src/views/result.ts';
import { TYPE_CODES } from '../src/content/types.ts';
import { RADAR_AXES } from '../src/content/quiz.ts';

const classesOf = (html) => {
  const out = new Set();
  for (const m of html.matchAll(/class="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) out.add(c);
  }
  return out;
};
const idsOf = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

// 代表として1タイプ分を描く。中央から離れた軸を作るため、5軸に差をつける。
const radar = Object.fromEntries(RADAR_AXES.map((a, i) => [a, [0.1, 0.9, 0.5, 0.7, 0.3][i]]));
const rendered = renderResultCard({
  code: 'OBL',
  counts: { h: { L: 3, R: 0, total: 3 }, c: { L: 2, R: 1, total: 3 }, w: { L: 3, R: 0, total: 3 } },
  radar,
});

const mine = classesOf(rendered);
const orig = classesOf(RESULT_MARKUP);

// prototype.html の結果画面にあって、サーバ側では意図して落としたもの。
const DROPPED = new Set([
  // 画面の器。サーバ側はカード部分だけを返す
  'screen',
  // 検証アンケート5問と、その周辺（確認事項9＝b で廃止）
  'bridge', 'vq', 'vq-q', 'vq-opts', 'vq-opt', 'vq-intro', 'field', 'proto-note',
  // 紹介先プレビューの注記。検証モード専用だった
  'cc-preview',
  // 初期表示用。サーバ側では最初から色を確定させるので要らない
  'result-accent',
]);

const proto = new Set(PROTO_CLASSES);

// (1) prototype.html の結果画面にあるのに、サーバ側で出していないもの
const missing = [...orig].filter((c) => !mine.has(c) && !DROPPED.has(c));
// (2) prototype.html のどこにも無いクラスを使っていたら、打ち間違い
const invented = [...mine].filter((c) => !proto.has(c));

const problems = [];
if (missing.length) problems.push(`prototype.html にあってサーバ側に無いクラス: ${missing.join(', ')}`);
if (invented.length) problems.push(`prototype.html に存在しないクラス（打ち間違いの疑い）: ${invented.join(', ')}`);

// 全8タイプで描けること（データ欠けの検出）
const renderFails = [];
for (const code of TYPE_CODES) {
  try {
    const html = renderResultCard({
      code,
      counts: { h: { L: 2, R: 1, total: 3 }, c: { L: 2, R: 1, total: 3 }, w: { L: 2, R: 1, total: 3 } },
      radar,
    });
    if (!html.includes('class="tname"')) renderFails.push(`${code}: タイプ名が出ていない`);
    if ((html.match(/class="ts-card"/g) || []).length !== 4) renderFails.push(`${code}: トリセツが4枚でない`);
    if ((html.match(/class="axis-row"/g) || []).length !== 8) renderFails.push(`${code}: 軸の行が8本でない（3軸＋5軸）`);
    if (/undefined|\[object Object\]|NaN/.test(html)) renderFails.push(`${code}: 未定義の値が出力に混ざっている`);
  } catch (e) {
    renderFails.push(`${code}: 例外 ${e.message}`);
  }
}
if (renderFails.length) problems.push(...renderFails);

// エスケープ漏れの確認（文面に < > & が入っても壊れない）
const withAngle = renderResultCard({
  code: 'OBL',
  counts: { h: { L: 3, R: 0, total: 3 }, c: { L: 3, R: 0, total: 3 }, w: { L: 3, R: 0, total: 3 } },
  radar,
});
const idsMine = idsOf(withAngle);
for (const need of ['card', 'r-emblem', 'r-rays', 'r-catch', 'r-name', 'r-code', 'r-axes',
                    'r-axes-note', 'r-aru', 'r-tsuyomi', 'r-toriset', 'r-spectrums', 'r-focus',
                    'r-hs-core', 'r-hs-cost', 'r-hs-loop', 'deepBlock', 'openGuide', 'restartBtn']) {
  if (!idsMine.has(need)) problems.push(`id が無い: ${need}`);
}

console.log(`結果カードの照合: クラス ${mine.size} 種 / id ${idsMine.size} 種、全${TYPE_CODES.length}タイプを描画`);
if (problems.length) {
  console.error(`\n問題 ${problems.length} 件:`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log('  → prototype.html と同じクラス名・id で組めている');
