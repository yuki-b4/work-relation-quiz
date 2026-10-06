/**
 * 結果カードのサーバ側描画。
 *
 * 要件：アプリ化要件定義.md F3-1（結果画面のUIと表示ロジックは現行踏襲）。
 *
 * prototype.html の <!-- RESULT --> 節の構造と、renderResult / renderToriset /
 * renderHonshitsu / renderRelations が作るHTMLを、そのままサーバ側で組み立てる。
 * クラス名や入れ子がずれていないかは tools/markup-check.mjs が突き合わせる。
 *
 * 元はクライアントで描いていたが、
 *   ・結果はDBから引くので、タイプ別の文面をブラウザへ配る必要がない
 *   ・その人の結果だけをHTMLで返せば、他タイプの文面が漏れない
 * ため、サーバで組み立てる形にした。
 */
import { AX, RADAR_AXES, RADAR_META } from '../content/quiz.ts';
import {
  HONSHITSU, HONSHITSU_LOOP, TORISET, TYPE_ICON, TYPE_NAME_HTML, TYPES, type TypeCode,
} from '../content/types.ts';
import type { RadarKey, RadarScores, Tally } from '../lib/scoring.ts';

/** HTMLへ埋める前に必ず通す。文面は自分たちのデータだが、素通しにはしない。 */
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const AXIS_LABEL: Record<string, string> = { h: '本音', c: '衝突', w: '重心' };
const NUMS = ['1', '2', '3', '4'];

/** 軸の1行。3軸と5軸で同じ形を使う（prototype.html も同じ .axis-row）。 */
function axisRow(name: string, left: string, right: string, frac: number, leftOn: boolean, rightOn: boolean): string {
  // 点の位置は 8% 〜 92%。prototype.html の (8 + frac*84) と同じ。
  // 元の実装は左端(0%)から最終位置へ動かして見せるので、初期値は 0% にしておき、
  // 最終位置は data-pos に入れる。描画後にシェルのJSが動かす（F3-1）。
  const pos = 8 + frac * 84;
  return (
    '<div class="axis-row">' +
      `<div class="axis-name">${esc(name)}</div>` +
      '<div class="axis-track-wrap">' +
        `<div class="axis-ends"><span class="${leftOn ? 'on' : ''}">${esc(left)}</span>` +
        `<span class="${rightOn ? 'on' : ''}">${esc(right)}</span></div>` +
        `<div class="axis-track"><span class="axis-dot" style="left:0%" data-pos="${pos.toFixed(2)}"></span></div>` +
      '</div>' +
    '</div>'
  );
}

export type ResultData = {
  code: TypeCode;
  counts: Record<'h' | 'c' | 'w', Tally>;
  radar: RadarScores;
  /** 共有リンクに載せるURLの基点。省略すると共有ブロックを出さない。 */
  origin?: string;
};

/**
 * X共有リンク（F5）。
 *
 * 文面（確認事項1＝a で確定）：
 *   私は「{タイプ名}」でした！ナチュール診断を受ける
 *   {URL} #ナチュール診断
 *
 * ・本文・改行・URL・ハッシュタグを**すべて text にまとめる**。url= を使うと
 *   Xが末尾にURLを足して、URLの後にハッシュタグという並びが崩れる（F5-4）
 * ・共有するURLは**トップページ**。結果はワンタイムなので共有しても他人は開けない
 * ・計測は ?src=x。?ref= は紹介者コードなので使わない（F5-3）
 */
export function shareUrl(origin: string, typeName: string): string {
  const text = `私は「${typeName}」でした！ナチュール診断を受ける\n${origin}/?src=x #ナチュール診断`;
  return 'https://x.com/intent/post?text=' + encodeURIComponent(text);
}

const SVG_SHARE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3v12"/><path d="M7 8l5-5 5 5"/></svg>';

/** 結果カードの共有ブロック。prototype.html に無い節なので、「ほかのタイプを知る」と同じ形で組む。 */
function shareBlock(origin: string, typeName: string): string {
  return (
    '<div class="row-block r-card r-more">' +
      '<p class="sectlabel">結果をシェアする</p>' +
      '<p>あなたのタイプを X に投稿できます。診断結果そのものは共有されません。</p>' +
      `<a class="btn btn-sm btn-ghost" id="shareX" href="${esc(shareUrl(origin, typeName))}"` +
      ` target="_blank" rel="noopener">${SVG_SHARE}X に投稿する</a>` +
    '</div>'
  );
}

/** 名前の下に並べる3語＝出ている側の極の名前。 */
function rays(code: TypeCode): string {
  return (['h', 'c', 'w'] as const)
    .map((axis, i) => {
      const meta = AX[axis];
      const word = code[i] === meta.poles[0] ? meta.left : meta.right;
      return `<span class="ray">${esc(word)}</span>`;
    })
    .join('');
}

/** 3軸の帯。「3つの極 → タイプ」の図は、名前のカードに極の3語を並べたので外した（2026-10-06）。 */
function axesBlock(data: ResultData): string {
  const rows = (['h', 'c', 'w'] as const)
    .map((axis) => {
      const ct = data.counts[axis];
      const meta = AX[axis];
      return axisRow(AXIS_LABEL[axis]!, meta.left, meta.right, ct.total ? ct.R / ct.total : 0.5, ct.L > ct.R, ct.R > ct.L);
    })
    .join('');

  return `<div class="axes" id="r-axes">${rows}</div>`;
}

/** わたしのトリセツ（番号つきカード4枚）。 */
function torisetBlock(code: TypeCode): string {
  const items = (TORISET as Record<string, readonly { l: string; t: string }[]>)[code] ?? [];
  return items
    .map(
      (it, i) =>
        '<div class="ts-card">' +
          `<span class="ts-l"><span class="num">${NUMS[i] ?? ''}</span>${esc(it.l)}</span>` +
          `<span class="ts-t">${esc(it.t)}</span>` +
        '</div>'
    )
    .join('');
}

/** 5つの関わり方傾向の帯。 */
function spectrumsBlock(radar: RadarScores): string {
  return RADAR_AXES.map((a) => {
    const s = radar[a];
    const m = RADAR_META[a];
    return axisRow(m.name, m.left, m.right, s, s < 0.5, s > 0.5);
  }).join('');
}

/** 中央から最も離れた1軸を「いちばん出ている傾向」として両面で見せる。優劣はつけない。 */
function focusBlock(radar: RadarScores): string {
  let f: RadarKey = RADAR_AXES[0];
  RADAR_AXES.forEach((a) => {
    if (Math.abs(radar[a] - 0.5) > Math.abs(radar[f] - 0.5)) f = a;
  });
  const m = RADAR_META[f];
  const right = radar[f] >= 0.5;
  const pole = right ? m.right : m.left;
  const gift = right ? m.rightGift : m.leftGift;
  const side = right ? m.rightSide : m.leftSide;
  const other = right ? m.left : m.right;
  return (
    '<div class="pv-head"><span class="pv-kicker">いちばん出ている傾向</span>' +
      `<b>${esc(m.name)}</b></div>` +
    '<div class="pv-body">' +
      `<div class="pv-pole">「${esc(pole)}」</div>` +
      `<div class="focus-item"><span class="focus-tag focus-tag-gift">持ち味</span><p>${esc(gift)}</p></div>` +
      `<div class="focus-item"><span class="focus-tag focus-tag-side">惜しい</span><p>${esc(side)}</p></div>` +
      `<p class="focus-grow">意識して「${esc(other)}」を少し取り入れると、関わり方の幅が広がります。</p>` +
    '</div>'
  );
}

const SVG_TARGET =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>';
const SVG_BOOK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/></svg>';

/** 節の見出し。英字の添え書きとアイコンの面は付けない（2026-10-06）。id は節へ飛ぶチップの行き先。 */
function sectHead(id: string, title: string): string {
  return `<div class="secthead" id="${id}"><span class="sh-text"><span class="sh-title">${esc(title)}</span></span></div>`;
}

/** 節へ飛ぶチップ。長い結果の中で、読みたいところへすぐ行けるようにする。 */
const JUMP =
  '<nav class="r-jump" aria-label="この結果の節">' +
  [['sec-axes', '3つの軸'], ['sec-aru', 'あるある・強み'], ['sec-tori', 'トリセツ'], ['sec-tend', '5つの傾向'], ['sec-deep', '深層']]
    .map(([id, label]) => `<a href="#${id}">${label}</a>`)
    .join('') +
  '</nav>';

const DAYS: [string, string][] = [
  ['序章', 'なぜ、相手ではなく自分から始めるのか'],
  ['第一章', 'あなたが自然体でいられる環境'],
  ['第二章', 'あなたの中の「もう一人のあなた」'],
  ['終章', '「霧が晴れる感覚」をあなたへ'],
];

/**
 * 結果カード全体。prototype.html の <section id="result"> の .card 部分にあたる。
 * ガイドCTAは全員に出す（確認事項9＝b でセグメント出し分けを廃止。F3-3）。
 */
export function renderResultCard(data: ResultData): string {
  const t = TYPES[data.code];
  const h = HONSHITSU[data.code];
  const guard = t.pole === 'guard';
  const accent = guard
    ? '--accent:var(--teal);--accent-soft:var(--teal-soft);--accent-ink:var(--teal-ink);--accent-deep:#0E5040'
    : '--accent:var(--coral);--accent-soft:var(--coral-soft);--accent-ink:var(--coral-ink);--accent-deep:#7A2E1A';

  return (
    `<div class="card" id="card" style="${accent}">` +
      '<div class="card-head">' +
        '<p class="r-label">あなたのタイプ</p>' +
        '<div class="emblem-wrap">' +
          `<div class="emblem" id="r-emblem" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${TYPE_ICON[data.code] ?? ''}</svg></div>` +
        '</div>' +
        `<p class="tcatch" id="r-catch">${esc(t.catch)}</p>` +
        // タイプ名は文節で区切った HTML（エスケープ済み・<wbr> 入り）
        `<h2 class="tname" id="r-name">${TYPE_NAME_HTML[data.code]}</h2>` +
        `<span class="chip" id="r-code">${esc(data.code)}</span>` +
        `<div class="rays" id="r-rays">${rays(data.code)}</div>` +
      '</div>' +
      JUMP +
      '<div class="card-body">' +
        sectHead('sec-axes', 'タイプを決める3つの軸') +
        axesBlock(data) +

        '<p class="sectlabel" id="sec-aru">あるある</p>' +
        `<ul class="aru" id="r-aru">${t.aru.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` +

        '<div class="row-block">' +
          '<p class="sectlabel">強み</p>' +
          `<p class="r-card" id="r-tsuyomi">${esc(t.tsuyomi)}</p>` +
        '</div>' +

        '<div class="toriset-band" id="sec-tori">' +
          '<p class="ts-title">わたしのトリセツ</p>' +
          '<p class="ts-lead">「私はこういう人」<br>周りの人に教えてあげて</p>' +
          `<div id="r-toriset">${torisetBlock(data.code)}</div>` +
        '</div>' +

        sectHead('sec-tend', '5つの関わり方傾向') +
        '<p class="sect-sub">同じタイプでも、この5つの出方は人によって違います。</p>' +
        `<div class="axes" id="r-spectrums">${spectrumsBlock(data.radar)}</div>` +

        '<p class="sectlabel is-sub">特徴的な傾向と、その活かし方</p>' +
        `<div class="pv" id="r-focus">${focusBlock(data.radar)}</div>` +

        '<div class="deep-section" id="sec-deep">' +
          `<div class="secthead"><span class="sh-icon" aria-hidden="true">${SVG_TARGET}</span>` +
            '<span class="sh-text"><span class="sh-title">あなたの深層</span>' +
            '<span class="hs-sub">あなたの振る舞いを決める「ほんとうの理由」</span></span></div>' +
          '<div class="honshitsu">' +
            `<p class="hs-core" id="r-hs-core">${esc(h.core)}</p>` +
            `<p class="hs-cost" id="r-hs-cost">${esc(h.cost)}</p>` +
            `<p class="hs-loop" id="r-hs-loop">${esc(HONSHITSU_LOOP)}</p>` +
          '</div>' +
          '<div class="compat">' +
            '<div class="compat-cta" id="deepBlock">' +
              `<p class="cc-text" id="r-cc-intro">そこで、人間関係の悩みを解決し自然体の時間を増やせるように、あなたのタイプ〈<b>${esc(t.name)}</b>〉のタイプ別読み解きガイドをご用意しました。</p>` +
              '<div class="cc-label">人間関係の悩みは生きる上で大きな大きな悩みの種です。</div>' +
              '<p class="cc-text"><b>登録不要</b>で読み始めることができます。</p>' +
              `<button class="btn btn-wide btn-accent" id="openGuide">${SVG_BOOK}読み解きガイドを開く</button>` +
              '<p class="day-head">この読み解きガイドでわかること</p>' +
              `<ol class="day-list">${DAYS.map(([n, d]) => `<li><span>${n}</span>${esc(d)}</li>`).join('')}</ol>` +
              '<p class="optout-note">全4章。8分ほどで読み終わります。</p>' +
            '</div>' +
          '</div>' +
        '</div>' +

        (data.origin ? shareBlock(data.origin, t.name) : '') +

        '<div class="row-block r-card r-more">' +
          '<p class="sectlabel">ほかのタイプを知る</p>' +
          '<p>8つのタイプには、それぞれ違った関わり方のクセがあります。身近なあの人を思い浮かべながら、全タイプを眺めてみてください。</p>' +
          '<a class="btn btn-sm btn-ghost" href="/types" target="_blank" rel="noopener">全8タイプを見る</a>' +
        '</div>' +

        '<div class="afterbar">' +
          '<button class="btn btn-sm btn-ghost" id="restartBtn">もう一度診断する</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}
