/**
 * 宣言のフォーク（施策a 段1・A-1）と、その直後のブリッジ画面。
 *
 * 正：集客戦略マップ.md §3.5（約束の確定文言）・§3.6・§3.8
 *
 * 結果画面の上に**モーダル**で出す（2026-09-12に画面差し替えから変更）。出し方は2つ。
 *
 *   ・`cta`  …… 結果カードの「読み解きガイドを開く」を押した
 *   ・`auto` …… **押していない人**にも出す。結果を読み終えた（深層まで到達した）か、
 *                しばらく手が止まった人に、滞在の途中で1回だけ
 *
 * **押した人だけに出していては、いちばん届けたい人に届かない。** ガイドへ進ませることが
 * 目的なので、進む気配のない人にこそ「この結果をどう使うか」を差し出す。
 * 差し替えでなくモーダルにしたのは、**読んでいる最中に結果を取り上げないため**。
 * 閉じれば結果に戻れるし、閉じたら二度目は出さない。
 *
 *   ①職場の、あの人との関係 → 誰と → いつまでに → 記録 → ブリッジ → 読み解きガイド
 *   ②恋愛・結婚の関係       → 同上
 *   ③まだ分からない         → 1クリックで記録 → ブリッジ → 読み解きガイド（A-3）
 *
 * **ブリッジは、ガイドに進むと何があるのかを、本人の宣言に結びつけて返す1枚。**
 * 自分ごと化はコピーの上手さでなく**相手の固有情報**で起こす
 * （`0to1マーケティング戦略.md` §3.6）ので、まず選んだ相手と期限をそのまま読み上げる。
 *
 * 並びは「興味 → 教育 → 必要」を1枚に畳んだもの。
 *   1. お礼                    …… 回答ありがとうございました。
 *   2. **悩みの理由の名指し**   …… 宣言した場面と相手を差し込む（分岐するのはここだけ）
 *   3. **証拠**               …… その人のトリセツ1枚を結果カードから複製して見せる
 *   4. **一般化**             …… 強みがある一方で落とし穴もある（タイプ名を差し込む）
 *   5. ガイドの意味づけ → CTA
 *
 * **コンテンツは増やさない。** 3はトリセツの複製、4はタイプ名の差し込みだけで、
 * タイプ別の文面はここに1本も持たない。見立て（段3）も書かない。
 *
 * **飛ばせるようにしてある。** 必ず通る関門にすると全員が宣言済みになり、
 * §3.8 が段1で測れるとした「宣言した人としない人の申込率の差」が測れなくなる。
 *
 * 中身のクラス名は prototype.html のものをそのまま使う（.choices / .choice / .mk / .qtext /
 * .qback / .eyebrow / .lead-cta / .link-note / .btn / .optout-note）。
 * **器（モーダル）だけは prototype.html に無いので、ここで最小限のCSSを書く**
 * （Admin と同じ扱いの例外。色は必ず `:root` のトークンを使い、診断側の色に追従させる）。
 */
import {
  allCauses, BRIDGE_EYEBROW, BRIDGE_NOTE, DEADLINES, DECLARE_QUESTIONS, DOMAINS,
  TARGETS, type Option,
} from '../lib/declaration.ts';
import { esc } from './result.ts';

const NUMS = ['①', '②', '③', '④', '⑤', '⑥'];

/**
 * 設問1枚。選ぶと次へ進むので、送信ボタンは持たせない。
 * ブリッジの文はサーバ側で全パターン描いてあるので、ここは値だけ持たせればよい。
 */
function step(name: string, question: string, kind: string, options: readonly Option[]): string {
  const choices = options
    .map(
      (o, i) =>
        `<button class="choice" type="button" data-k="${esc(kind)}" data-v="${esc(o.value)}">` +
        `<span class="mk">${NUMS[i] ?? ''}</span><span>${esc(o.label)}</span></button>`
    )
    .join('');
  return (
    `<div data-step="${esc(name)}" hidden>` +
      `<p class="qtext">${esc(question)}</p>` +
      `<div class="choices">${choices}</div>` +
    '</div>'
  );
}

/**
 * ブリッジ（宣言 → 読み解きガイド）。
 *
 * 悩みの理由は「場面×相手」で出し分けるので、出しうる全パターンを置いて選ばれたものだけを
 * 表示する（**サーバから追加で取りに行かせない**。宣言の直後に通信を挟むと、ここで止まって見える）。
 */
function bridge(): string {
  // 悩みの理由は「場面 × 相手」の組ごとに文が変わる（相手の名前が入る）。**その場で文字列を
  // 組み立てさせない**で、出しうる全パターンを描いておき、選ばれた1本だけを見せる。
  const causes = allCauses()
    .map((c) => `<p class="lead-cta" data-cause="${esc(c.key)}" hidden>${esc(c.text)}</p>`)
    .join('');
  return (
    '<div data-step="bridge" hidden>' +
      `<div class="eyebrow">${esc(BRIDGE_EYEBROW)}</div>` +
      causes +
      // 証拠と一般化。トリセツ1枚とタイプ名は結果カードから借りる（result-page.ts が複製する）。
      // 読み物を足さず、**いま見たばかりの自分の結果**でそのまま話を進める。
      '<div class="row-block" id="dcDemo" style="margin-top:20px" hidden>' +
        '<div id="dcCard"></div>' +
        '<p id="dcTypeNote" style="margin-top:14px"></p>' +
      '</div>' +
      `<p class="link-note">${BRIDGE_NOTE}</p>` +
      '<button class="btn btn-wide btn-accent" id="dcGo" type="button" style="margin-top:22px">' +
      '読み解きガイドを開く</button>' +
      '<p class="optout-note" style="text-align:center">全4章・8分ほど。登録は要りません。</p>' +
    '</div>'
  );
}

/**
 * モーダルの器のCSS。**prototype.html に無い画面なので、ここだけ手で書く。**
 *
 * `<dialog>` を使うのは、背景を触れなくする・Escで閉じる・フォーカスを閉じ込めるを
 * ブラウザに任せるため（自前で作ると必ずどれかが抜ける）。
 * 色はすべて `:root` のトークン。診断側の色を変えればここも追従する。
 */
export const DECLARE_CSS =
  '<style>' +
  '#dcModal{position:fixed; inset:0; width:100%; max-width:none; height:100%; max-height:none;' +
  ' margin:0; padding:0; border:0; background:transparent; overflow-y:auto; overscroll-behavior:contain}' +
  '#dcModal[open]{display:flex; align-items:center; justify-content:center}' +
  '#dcModal::backdrop{background:rgba(24,24,22,.5)}' +
  '.dc-sheet{position:relative; width:100%; max-width:470px; margin:auto; padding:26px 22px 30px;' +
  ' background:var(--bg); border-radius:20px; box-shadow:var(--shadow)}' +
  // 閉じるは**必ず見える位置に置く**。逃げ場の無いモーダルは、結果ごと嫌われる。
  '.dc-close{position:absolute; top:10px; right:12px; width:34px; height:34px; padding:0;' +
  ' background:none; border:none; cursor:pointer; color:var(--faint); font-size:20px; line-height:1}' +
  '.dc-close:hover{color:var(--muted)}' +
  '@media (max-width:520px){.dc-sheet{max-width:none; margin:auto 0 0; border-radius:20px 20px 0 0}}' +
  '</style>';

/**
 * 結果画面に重ねるモーダル。開け閉めは result-page.ts のスクリプトが行う。
 * `<dialog>` は `open` が付くまで出ないので、`.screen`/`active` の仕組みは使わない。
 */
export function declareSection(): string {
  return (
    '<dialog id="dcModal" aria-label="この結果の使いみち">' +
      '<div class="dc-sheet">' +
        '<button class="dc-close" id="dcClose" type="button" aria-label="閉じる">×</button>' +
        step('domain', DECLARE_QUESTIONS.domain, 'domain', DOMAINS) +
        step('target-work', DECLARE_QUESTIONS.target, 'target', TARGETS.work) +
        step('target-love', DECLARE_QUESTIONS.target, 'target', TARGETS.love) +
        step('deadline', DECLARE_QUESTIONS.deadline, 'deadline', DEADLINES) +
        bridge() +
        '<button class="qback" id="dcBack" type="button" hidden>← ひとつ戻る</button>' +
        '<p class="qhint" id="dcSkipWrap"><button class="qback" id="dcSkip" type="button">' +
        '答えずに読み解きガイドへ進む</button></p>' +
      '</div>' +
    '</dialog>'
  );
}
