/**
 * 宣言のフォーク（施策a 段1・A-1）と、その直後のブリッジ画面。
 *
 * 正：集客戦略マップ.md §3.5（約束の確定文言）・§3.6・§3.8
 *
 * 結果画面の直後に置く。結果カードの「読み解きガイドを開く」を押した直後に、
 * 同じページの中で画面だけを差し替える（遷移しないので、3クリックが速い）。
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
 *   1. 宣言の読み上げ          …… あなたが選んだこと
 *   2. 約束（相手の名前入り）   …… §3.5 の確定文言
 *   3. **一手（実演）**        …… トリセツ1枚を取り出して「この1枚だけ伝えてみて」
 *   4. **限界**               …… 「自分のクセは自分だけでは気づけない」（終章の先出し）
 *   5. ガイドが何を読み解くか → CTA
 *
 * **コンテンツは増やさない。** 3の中身は結果カードのトリセツの複製、4はガイド終章の一文。
 * 分岐するのは2と3の1行ずつだけで、見立て（段3）はここに書かない。
 *
 * **飛ばせるようにしてある。** 必ず通る関門にすると全員が宣言済みになり、
 * §3.8 が段1で測れるとした「宣言した人としない人の申込率の差」が測れなくなる。
 *
 * クラス名は prototype.html のものをそのまま使う（.choices / .choice / .mk / .qtext /
 * .qback / .eyebrow / .lead-cta / .link-note / .btn / .optout-note）。
 * **新しいクラスを作らない**ので、CSSは1行も足していない。
 */
import {
  allActions, allPromises, BRIDGE_NOTE, DEADLINES, DECLARE_QUESTIONS, DEMO_LEAD, DOMAINS,
  TARGETS, type Option,
} from '../lib/declaration.ts';
import { esc } from './result.ts';

const NUMS = ['①', '②', '③', '④', '⑤', '⑥'];

/**
 * 設問1枚。選ぶと次へ進むので、送信ボタンは持たせない。
 * `data-l` は**ブリッジの文の中で使う語**。場面は短い呼び方（職場／恋愛・結婚）、
 * 相手は総称に直したもの（その他 → あの人／大切な人。「その他との関係」は日本語が壊れる）。
 */
function step(
  name: string, question: string, kind: string,
  options: readonly (Option & { short?: string; subject?: string })[]
): string {
  const choices = options
    .map(
      (o, i) =>
        `<button class="choice" type="button" data-k="${esc(kind)}" data-v="${esc(o.value)}"` +
        ` data-l="${esc(o.short ?? o.subject ?? o.label)}">` +
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
 * 見出しと副題はJSが宣言から組み立てる。約束は「場面×相手」で出し分けるので、
 * 出しうる全パターンを置いて選ばれたものだけを表示する（**サーバから追加で取りに
 * 行かせない**。宣言の直後に通信を挟むと、ここで止まって見える）。
 */
function bridge(): string {
  // 約束は「場面 × 相手」の組ごとに文が変わる（相手の名前が入る）。**その場で文字列を
  // 組み立てさせない**で、出しうる全パターンを描いておき、選ばれた1本だけを見せる。
  const promises = allPromises()
    .map((p) => `<p class="lead-cta" data-promise="${esc(p.key)}" hidden>${esc(p.text)}</p>`)
    .join('');
  const actions = allActions()
    .map((a) => `<p data-action="${esc(a.key)}" hidden>${esc(a.text)}</p>`)
    .join('');
  return (
    '<div data-step="bridge" hidden>' +
      '<div class="eyebrow">あなたが選んだこと</div>' +
      '<p class="qtext" id="dcHead" style="text-align:left; margin-bottom:10px"></p>' +
      '<p class="qhint" id="dcSub" style="text-align:left; margin-top:0"></p>' +
      promises +
      // 一手（実演）。結果カードのトリセツ1枚をここへ持ってくる（中身は result-page.ts が複製する）。
      // 説明でなく実演にするのは、how-toの読み物を足さないため（集客戦略マップ.md §3.1）。
      '<div class="row-block" id="dcDemo" style="margin-top:26px" hidden>' +
        `<p class="sectlabel" style="margin-top:0">${esc(DEMO_LEAD)}</p>` +
        '<div id="dcCard"></div>' +
        actions +
      '</div>' +
      `<p class="link-note">${BRIDGE_NOTE}</p>` +
      '<button class="btn btn-wide btn-accent" id="dcGo" type="button" style="margin-top:22px">' +
      '読み解きガイドを開く</button>' +
      '<p class="optout-note" style="text-align:center">全4章・8分ほど。登録は要りません。</p>' +
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
      bridge() +
      '<button class="qback" id="dcBack" type="button" hidden>← ひとつ戻る</button>' +
      '<p class="qhint" id="dcSkipWrap"><button class="qback" id="dcSkip" type="button">' +
      '答えずに読み解きガイドへ進む</button></p>' +
    '</section>'
  );
}
