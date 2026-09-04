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
  HONSHITSU, HONSHITSU_LOOP, TORISET, TYPE_ICON, TYPES, type TypeCode,
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
const NUMS = ['①', '②', '③', '④'];

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
};

/** エンブレムから放射する3語＝出ている側の極の名前。 */
function rays(code: TypeCode): string {
  const rayPos = ['ray-r1', 'ray-l', 'ray-r2'];
  return (['h', 'c', 'w'] as const)
    .map((axis, i) => {
      const meta = AX[axis];
      const word = code[i] === meta.poles[0] ? meta.left : meta.right;
      return `<span class="ray ${rayPos[i]}"><b></b><i></i>${esc(word)}</span>`;
    })
    .join('');
}

/** 3軸の帯と、その下の「3つの極 → タイプ」の図。 */
function axesBlock(data: ResultData): string {
  const rows = (['h', 'c', 'w'] as const)
    .map((axis) => {
      const ct = data.counts[axis];
      const meta = AX[axis];
      return axisRow(AXIS_LABEL[axis]!, meta.left, meta.right, ct.total ? ct.R / ct.total : 0.5, ct.L > ct.R, ct.R > ct.L);
    })
    .join('');

  const picked = (['h', 'c', 'w'] as const).map((axis, i) => {
    const meta = AX[axis];
    return data.code[i] === meta.poles[0] ? meta.left : meta.right;
  });
  const t = TYPES[data.code];
  const note =
    '<div class="f-row">' +
      picked.map((p) => `<span class="f-chip">${esc(p)}</span>`).join('<span class="f-op">+</span>') +
    '</div>' +
    '<div class="f-arrow">↓</div>' +
    `<div class="f-type">${esc(t.name)}<small>${esc(data.code)}</small></div>`;

  return `<div class="axes" id="r-axes">${rows}</div><div class="formula" id="r-axes-note">${note}</div>`;
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

const SVG_PEOPLE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="9" cy="8.5" r="3"/><circle cx="16.5" cy="10.5" r="2.4"/>' +
  '<path d="M3.5 19.5c.5-3.4 2.7-5.3 5.5-5.3s5 1.9 5.5 5.3"/><path d="M15.5 14.6c2.1.4 3.5 2.1 4 5"/></svg>';
const SVG_SCALE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M4 8h5"/><path d="M13 8h7"/><circle cx="11" cy="8" r="2.2"/>' +
  '<path d="M4 16h11"/><path d="M19 16h1"/><circle cx="17" cy="16" r="2.2"/></svg>';
const SVG_TARGET =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="12" cy="12" r="2.6"/><circle cx="12" cy="12" r="6.4"/><circle cx="12" cy="12" r="10"/></svg>';

function sectHead(svg: string, kicker: string, title: string): string {
  return (
    `<div class="secthead"><span class="sh-icon" aria-hidden="true">${svg}</span>` +
    `<span class="sh-text"><span class="sh-kicker">${esc(kicker)}</span>` +
    `<span class="sh-title">${esc(title)}</span></span></div>`
  );
}

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
        '<div class="emblem-wrap">' +
          `<div class="emblem" id="r-emblem" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${TYPE_ICON[data.code] ?? ''}</svg></div>` +
          `<div class="rays" id="r-rays" aria-hidden="true">${rays(data.code)}</div>` +
        '</div>' +
        `<p class="tcatch" id="r-catch">${esc(t.catch)}</p>` +
        `<h2 class="tname" id="r-name">${esc(t.name)}</h2>` +
        `<span class="chip" id="r-code">${esc(data.code)}</span>` +
      '</div>' +
      '<div class="card-body">' +
        sectHead(SVG_PEOPLE, 'RELATIONSHIP TYPE', 'あなたの関係性タイプ') +
        axesBlock(data) +

        '<p class="sectlabel">あるある</p>' +
        `<ul class="aru" id="r-aru">${t.aru.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` +

        '<div class="row-block">' +
          '<p class="sectlabel">強み</p>' +
          `<p id="r-tsuyomi">${esc(t.tsuyomi)}</p>` +
        '</div>' +

        '<div class="toriset-band">' +
          '<div class="ts-label">TORISETSU</div>' +
          '<p class="ts-title">わたしのトリセツ</p>' +
          '<p class="ts-lead">「私はこういう人」<br>周りの人に教えてあげて</p>' +
          `<div id="r-toriset">${torisetBlock(data.code)}</div>` +
        '</div>' +

        sectHead(SVG_SCALE, '5 TENDENCIES', '5つの関わり方傾向') +
        `<div class="axes" id="r-spectrums">${spectrumsBlock(data.radar)}</div>` +

        '<p class="sectlabel">特徴的な傾向と、その活かし方</p>' +
        `<div class="pv" id="r-focus">${focusBlock(data.radar)}</div>` +

        '<div class="deep-section">' +
          sectHead(SVG_TARGET, 'DEEP DIVE', 'あなたの深層') +
          '<div class="honshitsu">' +
            '<p class="hs-sub">あなたの振る舞いを決める「ほんとうの理由」</p>' +
            `<p class="hs-core" id="r-hs-core">${esc(h.core)}</p>` +
            `<p class="hs-cost" id="r-hs-cost">${esc(h.cost)}</p>` +
            `<p class="hs-loop" id="r-hs-loop">${esc(HONSHITSU_LOOP)}</p>` +
          '</div>' +
          '<div class="compat">' +
            '<div class="compat-cta" id="deepBlock">' +
              `<p class="cc-text" id="r-cc-intro">そこで、人間関係の悩みを解決し自然体の時間を増やせるように、あなたのタイプ〈<b>${esc(t.name)}</b>〉のタイプ別読み解きガイドをご用意しました。</p>` +
              '<div class="cc-label">人間関係の悩みは生きる上で大きな大きな悩みの種です。</div>' +
              '<p class="cc-text"><b>登録不要</b>で読み始めることができます。</p>' +
              '<button class="btn btn-wide btn-accent" id="openGuide">読み解きガイドを開く</button>' +
              '<p class="day-head">この読み解きガイドでわかること</p>' +
              '<p class="day-list">序章　なぜ、相手ではなく自分から始めるのか<br>第一章　あなたが自然体でいられる環境<br>第二章　あなたの中の「もう一人のあなた」<br>終章　「霧が晴れる感覚」をあなたへ</p>' +
              '<p class="optout-note">全4章。8分ほどで読み終わります。</p>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="row-block" style="margin-top:28px">' +
          '<p class="sectlabel">ほかのタイプを知る</p>' +
          '<p style="margin-bottom:14px">8つのタイプには、それぞれ違った関わり方のクセがあります。身近なあの人を思い浮かべながら、全タイプを眺めてみてください。</p>' +
          '<a class="btn btn-sm btn-ghost" href="/types" target="_blank" rel="noopener" style="display:inline-block; text-decoration:none">全8タイプを見る →</a>' +
        '</div>' +

        '<div class="afterbar">' +
          '<button class="btn btn-sm btn-ghost" id="restartBtn">もう一度診断する</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}
