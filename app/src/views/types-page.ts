/**
 * 全8タイプ一覧（/types）とタイプ個別（/types/{code}）。
 *
 * 要件：アプリ化要件定義.md F6-2（index対象）／F7-3（タイプ個別8ページでロングテールを
 * 面で取る。ただし**結果画面と同一にすると独自性が薄れるので、読み物として編集し直す**）。
 *
 * 何を出して、何を出さないか：
 *   ・出す：あるある／強み／ワンポイント（hitotsu）／相性（aishou）／トリセツ
 *     hitotsu と aishou は**結果画面では使っていない長文**で、ここの独自コンテンツになる
 *   ・出さない：深層（HONSHITSU）と5つの傾向
 *     深層は「あなたの深層」として結果画面の核であり、5軸はそもそも個人差なので、
 *     公開ページに置くと診断を受ける理由が薄くなる
 */
import { AX } from '../content/quiz.ts';
import { TORISET, TORI_LABEL, TYPES, TYPE_CODES, TYPE_ICON, type TypeCode } from '../content/types.ts';
import { page } from './layout.ts';
import { esc } from './result.ts';

const NUMS = ['①', '②', '③', '④'];

/** そのタイプが3軸のどちら側かを言葉にする。 */
function poles(code: TypeCode): string[] {
  return (['h', 'c', 'w'] as const).map((axis, i) => {
    const meta = AX[axis];
    return code[i] === meta.poles[0] ? meta.left : meta.right;
  });
}

function emblem(code: TypeCode): string {
  return (
    '<div class="emblem-wrap"><div class="emblem" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    `stroke-linecap="round" stroke-linejoin="round">${TYPE_ICON[code]}</svg></div></div>`
  );
}

/** 8タイプの索引。一覧にも個別ページの末尾にも置いて、回遊できるようにする（F6-2）。 */
function indexLinks(current?: TypeCode): string {
  return (
    '<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px">' +
    TYPE_CODES.map((code) => {
      const t = TYPES[code];
      const cls = t.pole === 'guard' ? 'ix guard' : 'ix open';
      const here = code === current;
      return (
        `<a class="${cls}" href="/types/${code}"` +
        (here ? ' aria-current="page" style="opacity:.55; pointer-events:none"' : '') +
        `><span class="c">${esc(code)}</span><span>${esc(t.name)}</span></a>`
      );
    }).join('') +
    '</div>'
  );
}

const AXIS_ROWS: [string, 'h' | 'c' | 'w', string][] = [
  ['本音', 'h', '思ったことを、その場で出すか、ひとまず胸にとどめるか'],
  ['衝突', 'c', '意見がぶつかったとき、切り込むか、角が立たない道を探すか'],
  ['重心', 'w', 'みんなで動くとき、前に立つか、後ろから支えるか'],
];

/** 3軸の説明。一覧ページの独自コンテンツで、タイプコードの読み方にもなる。 */
function axisGuide(): string {
  return (
    '<div class="tw" style="overflow-x:auto">' +
    AXIS_ROWS.map(([name, axis, desc]) => {
      const m = AX[axis];
      return (
        '<div class="row-block">' +
          `<p class="sectlabel">${esc(name)}</p>` +
          `<p style="margin-bottom:10px">${esc(desc)}</p>` +
          '<div class="f-row">' +
            `<span class="f-chip">${esc(m.left)}（${esc(m.poles[0])}）</span>` +
            '<span class="f-op">or</span>' +
            `<span class="f-chip">${esc(m.right)}（${esc(m.poles[1])}）</span>` +
          '</div>' +
        '</div>'
      );
    }).join('') +
    '</div>'
  );
}

const LIST_TITLE = 'ナチュール診断の全8タイプ一覧';
const LIST_DESC =
  'ナチュール診断の8つの人間関係タイプ（突撃隊長・正論ハンマー・お祭り隊長・自由人コメンテーター・沈黙の大黒柱・縁の下の職人・根回しの仕掛け人・がんばり屋の調整役）を一覧で紹介します。3つの軸の組み合わせで決まる、それぞれの関わり方のクセがわかります。';

export function typesIndexPage(origin: string): string {
  const canonical = `${origin}/types`;
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ナチュール診断', item: `${origin}/` },
      { '@type': 'ListItem', position: 2, name: '全8タイプ', item: canonical },
    ],
  });

  return page(
    {
      title: `${LIST_TITLE} | ナチュール診断`,
      description: LIST_DESC,
      canonical,
      head:
        `<meta property="og:type" content="website">` +
        `<meta property="og:site_name" content="ナチュール診断">` +
        `<meta property="og:title" content="${esc(LIST_TITLE)}">` +
        `<meta property="og:description" content="${esc(LIST_DESC)}">` +
        `<meta property="og:url" content="${canonical}">` +
        `<meta property="og:locale" content="ja_JP">` +
        `<meta name="twitter:card" content="summary_large_image">` +
        `<script type="application/ld+json">${jsonLd}</script>`,
    },
    '<div class="app">' +
      '<header class="app-header"><a href="/" style="color:inherit; text-decoration:none">ナチュール診断</a></header>' +
      '<section class="screen active">' +
        `<h1 class="hero" style="font-size:clamp(22px,5vw,30px)">${esc(LIST_TITLE)}</h1>` +
        '<p class="lead">ナチュール診断は、力を抜いたときの「自然体のあなた」の関わり方を8つのタイプで映し出します。タイプは3つの軸の組み合わせで決まります。</p>' +
        indexLinks() +
        '<div class="row-block" style="margin-top:32px">' +
          '<p class="sectlabel">タイプを決める3つの軸</p>' +
          '<p style="margin-bottom:16px">タイプコードの3文字は、それぞれの軸でどちら側に出ているかを表します。たとえば OBL は「オープン・ぶつかる・引っ張る」の組み合わせです。</p>' +
        '</div>' +
        axisGuide() +
        '<div class="row-block" style="margin-top:32px">' +
          '<p class="sectlabel">あなたはどのタイプ</p>' +
          '<p style="margin-bottom:14px">24の質問に答えると、あなたのタイプがわかります。登録は不要で、約2分です。</p>' +
          '<a class="btn btn-wide" href="/" style="display:block; text-align:center; text-decoration:none">診断を受ける</a>' +
        '</div>' +
      '</section>' +
    '</div>'
  );
}

export function typeDetailPage(code: TypeCode, origin: string): string {
  const t = TYPES[code];
  const guard = t.pole === 'guard';
  const canonical = `${origin}/types/${code}`;
  const title = `${t.name}（${code}）とは | ナチュール診断`;
  const desc =
    `ナチュール診断の「${t.name}」（${code}）は、${poles(code).join('・')}の組み合わせのタイプです。` +
    `${t.tsuyomi.slice(0, 60)} あるある・強み・関わり方のワンポイント・相性を紹介します。`;
  const accent = guard
    ? '--accent:var(--teal);--accent-soft:var(--teal-soft);--accent-ink:var(--teal-ink);--accent-deep:#0E5040'
    : '--accent:var(--coral);--accent-soft:var(--coral-soft);--accent-ink:var(--coral-ink);--accent-deep:#7A2E1A';

  const jsonLd = JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `${t.name}（${code}）とは`,
      description: desc,
      inLanguage: 'ja',
      isPartOf: { '@type': 'WebSite', name: 'ナチュール診断', url: `${origin}/` },
      mainEntityOfPage: canonical,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ナチュール診断', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: '全8タイプ', item: `${origin}/types` },
        { '@type': 'ListItem', position: 3, name: t.name, item: canonical },
      ],
    },
  ]);

  const toriset = ((TORISET as Record<string, readonly { l: string; t: string }[]>)[code] ?? [])
    .map(
      (it, i) =>
        '<div class="ts-card">' +
          `<span class="ts-l"><span class="num">${NUMS[i] ?? ''}</span>${esc(it.l)}</span>` +
          `<span class="ts-t">${esc(it.t)}</span>` +
        '</div>'
    )
    .join('');

  return page(
    {
      title,
      description: desc,
      canonical,
      head:
        `<meta property="og:type" content="article">` +
        `<meta property="og:site_name" content="ナチュール診断">` +
        `<meta property="og:title" content="${esc(title)}">` +
        `<meta property="og:description" content="${esc(desc)}">` +
        `<meta property="og:url" content="${canonical}">` +
        `<meta property="og:locale" content="ja_JP">` +
        `<meta name="twitter:card" content="summary_large_image">` +
        `<script type="application/ld+json">${jsonLd}</script>`,
    },
    '<div class="app">' +
      '<header class="app-header"><a href="/" style="color:inherit; text-decoration:none">ナチュール診断</a></header>' +
      '<section class="screen active">' +
        '<nav class="qhint" style="text-align:left; margin-bottom:14px">' +
          '<a href="/" style="color:inherit">ナチュール診断</a>　›　' +
          '<a href="/types" style="color:inherit">全8タイプ</a>　›　' +
          `${esc(t.name)}` +
        '</nav>' +
        `<div class="card" style="${accent}">` +
          '<div class="card-head">' +
            emblem(code) +
            `<p class="tcatch">${esc(t.catch)}</p>` +
            `<h1 class="tname">${esc(t.name)}</h1>` +
            `<span class="chip">${esc(code)}</span>` +
          '</div>' +
          '<div class="card-body">' +
            '<p class="sectlabel">このタイプの組み立て</p>' +
            '<div class="formula">' +
              '<div class="f-row">' +
                poles(code).map((p) => `<span class="f-chip">${esc(p)}</span>`).join('<span class="f-op">+</span>') +
              '</div>' +
              '<div class="f-arrow">↓</div>' +
              `<div class="f-type">${esc(t.name)}<small>${esc(code)}</small></div>` +
            '</div>' +

            '<p class="sectlabel">あるある</p>' +
            `<ul class="aru">${t.aru.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` +

            '<div class="row-block">' +
              '<p class="sectlabel">強み</p>' +
              `<p>${esc(t.tsuyomi)}</p>` +
            '</div>' +

            // ここから下は結果画面には出していない、このページだけの読み物（F7-3）
            '<div class="row-block">' +
              '<p class="sectlabel">関わり方のワンポイント</p>' +
              `<p>${esc(t.hitotsu)}</p>` +
            '</div>' +

            '<div class="row-block">' +
              '<p class="sectlabel">ほかのタイプとの相性</p>' +
              `<p>${esc(t.aishou)}</p>` +
            '</div>' +

            '<div class="toriset-band">' +
              '<div class="ts-label">TORISETSU</div>' +
              `<p class="ts-title">${esc(t.name)}のトリセツ</p>` +
              '<p class="ts-lead">「この人はこういう人」<br>身近にいる方はこちらを</p>' +
              `<div>${toriset}</div>` +
            '</div>' +

            '<div class="row-block" style="margin-top:28px">' +
              '<p class="sectlabel">あなたのタイプを知る</p>' +
              `<p style="margin-bottom:14px">ここまで読んで「これは自分かもしれない」と思った方は、24の質問で確かめられます。診断では、このページには載せていない「あなたの深層」と「5つの関わり方傾向」も出ます。登録は不要、約2分です。</p>` +
              '<a class="btn btn-wide" href="/" style="display:block; text-align:center; text-decoration:none">診断を受ける</a>' +
            '</div>' +

            '<div class="row-block" style="margin-top:28px">' +
              '<p class="sectlabel">ほかのタイプを見る</p>' +
              indexLinks(code) +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +
    '</div>'
  );
}
