/**
 * 宣言のフォーク（施策a 段1・A-1）。
 *
 * 正：集客戦略マップ.md §3.6・§3.8
 *
 * 結果画面の直後に置く。結果カードの「読み解きガイドを開く」を押した直後に、
 * 同じページの中で画面だけを差し替える（遷移しないので、3クリックが速い）。
 *
 *   ①職場の、あの人との関係 → 誰と → いつまでに → 記録して読み解きガイドへ
 *   ②恋愛・結婚の関係       → 同上
 *   ③まだ分からない         → 1クリックで記録して読み解きガイドへ（A-3）
 *
 * **飛ばせるようにしてある。** 必ず通る関門にすると全員が宣言済みになり、
 * §3.8 が段1で測れるとした「宣言した人としない人の申込率の差」が測れなくなる。
 * 飛ばした人は申込フォームの構造化宣言（A-4）で拾う。
 *
 * ここは記録の器だけで、文面は作らない（見立てと一手は段3・10月のセッションの後）。
 * クラス名は prototype.html の設問画面のものをそのまま使う（.choices / .choice / .mk /
 * .qtext / .qback）。**新しいクラスを作らない**ので、CSSは1行も足していない。
 */
import { DEADLINES, DECLARE_QUESTIONS, DOMAINS, TARGETS, type Option } from '../lib/declaration.ts';
import { esc } from './result.ts';

const NUMS = ['①', '②', '③', '④', '⑤', '⑥'];

/** 設問1枚。選ぶと次へ進むので、送信ボタンは持たせない。 */
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
 * 結果画面の器の中に並べる節。`.screen` は `active` が付くまで出ない
 * （付け外しは result-page.ts のスクリプトが行う）。
 */
export function declareSection(): string {
  return (
    '<section class="screen" id="declare">' +
      step('domain', DECLARE_QUESTIONS.domain, 'domain', DOMAINS) +
      step('target-work', DECLARE_QUESTIONS.target, 'target', TARGETS.work) +
      step('target-love', DECLARE_QUESTIONS.target, 'target', TARGETS.love) +
      step('deadline', DECLARE_QUESTIONS.deadline, 'deadline', DEADLINES) +
      '<button class="qback" id="dcBack" type="button" hidden>← ひとつ戻る</button>' +
      '<p class="qhint"><button class="qback" id="dcSkip" type="button">' +
      '答えずに読み解きガイドへ進む</button></p>' +
    '</section>'
  );
}
