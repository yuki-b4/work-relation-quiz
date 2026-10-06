/**
 * 全8タイプ一覧（/types）とタイプ個別（/types/{code}）。
 *
 * 要件：アプリ化要件定義.md F6-2（index対象）／F7-3（タイプ個別8ページでロングテールを
 * 面で取る。ただし**結果画面と同一にすると独自性が薄れるので、読み物として編集し直す**）。
 *
 * 何を出して、何を出さないか：
 *   ・出す：あるある／強み／ワンポイント（hitotsu）／相性（aishou）
 *     hitotsu と aishou は**結果画面では使っていない長文**で、ここの独自コンテンツになる
 *   ・出さない：トリセツ／深層（HONSHITSU）／5つの傾向
 *     いずれも結果画面の中身。公開ページに置くと診断を受ける理由が薄くなる
 */
import { AX } from '../content/quiz.ts';
import { TYPES, TYPE_CODES, TYPE_ICON, TYPE_NAME_HTML, type TypeCode } from '../content/types.ts';
import { page, siteFooter, siteHeader } from './layout.ts';
import { esc } from './result.ts';

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

/** 1タイプ分のカード（エンブレム・コード・名前・キャッチ）。一覧と個別ページの末尾で使う。 */
function typeCard(code: TypeCode, current?: TypeCode): string {
  const t = TYPES[code];
  const here = code === current;
  return (
    `<li><a class="tl-card${t.pole === 'guard' ? ' is-guard' : ''}" href="/types/${code}"` +
    (here ? ' aria-current="page" style="pointer-events:none"' : '') + '>' +
      '<span class="tl-emblem" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${TYPE_ICON[code]}</svg></span>` +
      '<span class="tl-main">' +
        `<span class="tl-top"><span class="tl-code">${esc(code)}</span><span class="tl-name">${TYPE_NAME_HTML[code]}</span></span>` +
        `<span class="tl-catch">${esc(t.catch)}</span>` +
      '</span>' +
      '<span class="tl-chev" aria-hidden="true"></span>' +
    '</a></li>'
  );
}

/**
 * 8タイプの索引。一覧にも個別ページの末尾にも置いて、回遊できるようにする（F6-2）。
 * 本音の極（オープン／ガード）でまとめる。色を付けるのは本音の極だけ（2026-10-06）。
 */
function indexLinks(current?: TypeCode): string {
  const m = AX.h;
  const group = (pole: 'open' | 'guard', label: string) =>
    `<h2 class="tl-group${pole === 'guard' ? ' is-guard' : ''}">本音が${esc(label)}の4タイプ</h2>` +
    `<ul class="tl-list${current ? ' tl-wide' : ''}">` +
    TYPE_CODES.filter((c) => TYPES[c].pole === pole).map((c) => typeCard(c, current)).join('') +
    '</ul>';
  return group('open', `${m.left}（${m.poles[0]}）`) + group('guard', `${m.right}（${m.poles[1]}）`);
}

const AXIS_ROWS: [string, 'h' | 'c' | 'w', string][] = [
  ['本音', 'h', '思ったことを、その場で出すか、ひとまず胸にとどめるか'],
  ['衝突', 'c', '意見がぶつかったとき、切り込むか、角が立たない道を探すか'],
  ['重心', 'w', 'みんなで動くとき、前に立つか、後ろから支えるか'],
];

/**
 * 3軸の説明。一覧ページの独自コンテンツで、タイプコードの読み方にもなる。
 * 色はタイプの極を表す本音の軸にだけ付け、衝突・重心は無地にする（色の意味を混ぜない）。
 */
function axisGuide(): string {
  return (
    '<div class="ax-cards">' +
    AXIS_ROWS.map(([name, axis, desc]) => {
      const m = AX[axis];
      const tint = axis === 'h';
      return (
        '<div class="ax-card">' +
          `<p class="ax-name">${esc(name)}</p>` +
          `<p class="ax-desc">${esc(desc)}</p>` +
          '<div class="ax-poles">' +
            `<span class="ax-pole${tint ? ' is-open' : ''}">${esc(m.left)}（${esc(m.poles[0])}）</span>` +
            `<span class="ax-pole${tint ? ' is-guard' : ''}">${esc(m.right)}（${esc(m.poles[1])}）</span>` +
          '</div>' +
        '</div>'
      );
    }).join('') +
    '</div>'
  );
}

/** 診断への導線。トップの締めの帯と同じ形。 */
const TAKE_BAND =
  '<section class="top-band">' +
    '<h2 class="top-h">あなたはどのタイプ？</h2>' +
    '<p class="top-p">24の質問に答えると、あなたのタイプがわかります。登録は不要で、約2分です。</p>' +
    '<a class="btn btn-wide" href="/">診断を受ける</a>' +
  '</section>';

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
      ogImage: `${origin}/ogp.png`,
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
      siteHeader() +
      '<section class="screen active">' +
        // 見出しは「の」のあとで改行する（スマホで1行に収まる長さに分ける）
        `<h1 class="hero">${esc(LIST_TITLE).replace('ナチュール診断の', 'ナチュール診断の<br>')}</h1>` +
        '<p class="lead">ナチュール診断は、力を抜いたときの「自然体のあなた」の関わり方を8つのタイプで映し出します。タイプは3つの軸の組み合わせで決まります。</p>' +
        indexLinks() +
        '<div class="row-block">' +
          '<p class="sectlabel" style="margin-top:48px">タイプを決める3つの軸</p>' +
          '<p>タイプコードの3文字は、それぞれの軸でどちら側に出ているかを表します。たとえば OBL は「オープン・ぶつかる・引っ張る」の組み合わせです。</p>' +
        '</div>' +
        axisGuide() +
        TAKE_BAND +
      '</section>' +
      siteFooter() +
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

  return page(
    {
      title,
      description: desc,
      canonical,
      ogImage: `${origin}/ogp.png`,
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
      siteHeader() +
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
            `<h1 class="tname">${TYPE_NAME_HTML[code]}</h1>` +
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

            '<div class="row-block" style="margin-top:28px">' +
              '<p class="sectlabel">あなたのタイプを知る</p>' +
              `<p style="margin-bottom:14px">ここまで読んで「これは自分かもしれない」と思った方は、24の質問で確かめられます。診断では、このページには載せていない「わたしのトリセツ」「あなたの深層」「5つの関わり方傾向」も出ます。登録は不要、約2分です。</p>` +
              '<a class="btn btn-wide" href="/" style="display:block; text-align:center; text-decoration:none">診断を受ける</a>' +
            '</div>' +

            '<div class="row-block">' +
              '<p class="sectlabel">ほかのタイプを見る</p>' +
              indexLinks(code) +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +
      siteFooter() +
    '</div>'
  );
}
