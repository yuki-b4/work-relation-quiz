/**
 * セミナーの告知ページ（`/seminar/{slug}`）。
 *
 * 要件：アプリ化要件定義.md F4-5「セミナーの告知ページ」。
 * 参加申込はここでは受けず、Peatix のイベントページへ送る。
 *
 * **診断サイトの見た目（prototype.html のCSS・ヘッダー・フッター）は使わない。** 独立したLPとして、
 * デジタル庁デザインシステム（DADS）の考え方で組む（2026-09-25）。根拠にしたのは公式の配布物：
 *   ・@digital-go-jp/design-tokens 2.0.1（色・文字サイズ・行間・角丸）
 *   ・digital-go-jp/design-system-example-components（ボタン・リンク・見出し・定義リスト・アコーディオン）
 * 取り入れたこと：本文16px以上と行間1.75／文字サイズは rem（OSやブラウザの設定に従う）／
 * リンクは常に下線／ボタンは高さ56px・角丸8px／キーボード操作のフォーカスは黒い枠と黄色の光彩／
 * FAQ はHTMLの details で開閉（JSなし）／本文へ飛ぶリンク／強制カラーモードと視覚効果低減への配慮。
 *
 * **色とフォントは `:root` の --lp-* にだけ書く。** 手本にするLPのトーン＆マナーは、ここを差し替えて当てる。
 *
 * **文面はここに書かない。** 正は `セミナーLP文面.md` で、`npm run content` が
 * `src/content/seminars.ts` に写している。この器は、開催情報から日時の表記・申込ボタン・
 * 構造化データを組み、終了後の表示に切り替えるだけ。
 */
import type { Seminar, SeminarImage } from '../content/seminars.ts';
import { websiteLd } from './info-page.ts';
import { ICONS } from './layout.ts';
import { esc } from './result.ts';

const SITE = 'ナチュール診断';
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** DADS の書体は Noto Sans JP の 400 と 700 だけを使う。 */
const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet">';

/**
 * このページの見た目。数値は DADS のトークンに合わせる（例：16N-175＝1rem・行間1.75・字間0.02em、
 * 24B-150＝1.5rem・太字・行間1.5）。色の値は DADS の既定（キーカラー＝blue-900 など）。
 */
const LP_CSS = `
:root{
  --lp-font:'Noto Sans JP',-apple-system,BlinkMacSystemFont,sans-serif;
  --lp-key:#0017c1; --lp-key-hover:#00118f; --lp-key-active:#000060; --lp-key-soft:#e8f1fe;
  --lp-ink:#1a1a1a; --lp-text:#333333; --lp-sub:#666666;
  --lp-line:#949494; --lp-line-soft:#e6e6e6;
  --lp-bg:#ffffff; --lp-bg-soft:#f2f2f2;
  --lp-link:#00118f; --lp-link-visited:#8b008b;
  --lp-focus:#ffd43d; --lp-disabled-bg:#b3b3b3; --lp-disabled-text:#f2f2f2;
  --lp-photo-shade:rgba(0,0,0,.28); --lp-catch-on-photo:#ffffff;
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0; background:var(--lp-bg); color:var(--lp-text); font-family:var(--lp-font);
  font-size:1rem; line-height:1.75; letter-spacing:.02em; overflow-wrap:anywhere}
img{max-width:100%; height:auto; display:block}
h1,h2,h3,p,ul,ol,dl,dd,figure{margin:0}
ul,ol{padding:0}

/* 本文へ飛ぶリンク。キーボードで最初に止まる */
.lp-skip{position:absolute; left:.5rem; top:-4rem; z-index:10; padding:.75rem 1rem; background:var(--lp-bg);
  color:var(--lp-link); font-weight:700; border-radius:.5rem}
.lp-skip:focus{top:.5rem}

/* リンク：常に下線（DADS）。フォーカスは黄色の地と黒い枠 */
a{color:var(--lp-link); text-decoration:underline; text-underline-offset:.1875rem}
a:visited{color:var(--lp-link-visited)}
a:hover{text-decoration-thickness:.1875rem}
a:focus-visible,summary:focus-visible,.lp-btn:focus-visible{
  outline:4px solid #000; outline-offset:2px; box-shadow:0 0 0 2px var(--lp-focus); border-radius:.25rem}
a:not(.lp-btn):focus-visible{background:var(--lp-focus); color:var(--lp-link)}

.lp-wrap{max-width:45rem; margin:0 auto; padding:0 1rem}
@media (min-width:48rem){.lp-wrap{padding:0 1.5rem}}

/* ヘッダー：主催と開催日だけ。診断サイトのナビゲーションは持たない */
.lp-header{border-bottom:1px solid var(--lp-line-soft)}
.lp-header .lp-wrap{display:flex; align-items:center; justify-content:space-between; gap:1rem; min-height:3.5rem}
.lp-brand{font-size:.875rem; line-height:1.3; color:var(--lp-sub)}
.lp-brand b{display:block; color:var(--lp-ink); font-size:1rem}

/* ファーストビュー。写真があれば写真の上に白の縦書き、無ければ薄い地に濃い縦書き */
.lp-hero{position:relative; background:var(--lp-bg-soft); overflow:hidden}
.lp-hero-img{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:62% 50%}
.lp-hero.has-photo::after{content:""; position:absolute; inset:0; background:var(--lp-photo-shade)}
.lp-hero-inner{position:relative; z-index:1; max-width:45rem; margin:0 auto; padding:2.5rem 1rem;
  min-height:20rem; display:flex}
.lp-hero.has-photo .lp-hero-inner{min-height:min(34rem,120vw)}
.lp-catch{writing-mode:vertical-rl; font-weight:700; color:var(--lp-ink);
  font-size:clamp(2rem,8.5vw,3rem); line-height:1.65; letter-spacing:.12em}
.lp-hero.has-photo .lp-catch{color:var(--lp-catch-on-photo); text-shadow:0 1px 8px rgba(0,0,0,.35)}

/* 上下だけ指定する。左右は .lp-wrap の余白を使う（padding の一括指定で消さない） */
.lp-intro{padding-top:2rem; padding-bottom:3rem}
.lp-shoulder{font-weight:700; font-size:1rem; line-height:1.7; color:var(--lp-key); margin-bottom:.5rem}
.lp-h1{font-size:clamp(1.625rem,6.4vw,2rem); font-weight:700; line-height:1.5; letter-spacing:.01em; color:var(--lp-ink)}
.lp-sub{margin-top:1rem; font-size:clamp(1.0625rem,4.2vw,1.25rem); font-weight:700; line-height:1.6; color:var(--lp-text)}

/* 定義リスト（DADS の Dl）。開催情報の要点と、開催概要の表に使う */
.lp-dl{display:grid; grid-template-columns:auto 1fr; gap:.5rem 1.5rem; margin-top:1.5rem; padding:1rem 1.25rem;
  border:1px solid var(--lp-line); border-radius:.5rem}
.lp-dl dt{font-weight:700; color:var(--lp-ink)}
.lp-dl dd{color:var(--lp-text)}
.lp-dl .lp-note{display:block; font-size:.875rem; line-height:1.6; color:var(--lp-sub)}
.lp-nowrap{white-space:nowrap}

/* ボタン（DADS の solid-fill・lg）。二重線の透明な枠は、強制カラーモードで枠を残すため */
.lp-cta{margin-top:1.5rem}
.lp-btn{display:flex; align-items:center; justify-content:center; width:100%; max-width:26rem;
  min-height:3.5rem; padding:.75rem 1rem; border:4px double transparent; border-radius:.5rem;
  background:var(--lp-key); color:#fff; font-size:1rem; font-weight:700; line-height:1.3; text-align:center;
  text-decoration:none}
.lp-btn:visited{color:#fff}
.lp-btn:hover{background:var(--lp-key-hover); text-decoration:underline}
.lp-btn:active{background:var(--lp-key-active)}
.lp-btn[aria-disabled="true"]{background:var(--lp-disabled-bg); color:var(--lp-disabled-text); cursor:default; text-decoration:none}
.lp-support{margin-top:.5rem; font-size:.875rem; line-height:1.6; color:var(--lp-sub)}

/* 節。見出しは DADS の「チップ」（左の短い縦帯）付き・24B-150 */
.lp-sec{padding:3rem 0}
.lp-sec.is-soft{background:var(--lp-bg-soft)}
.lp-h2{position:relative; padding-left:calc(1em/3 + .5em); font-size:clamp(1.375rem,5.4vw,1.5rem);
  font-weight:700; line-height:1.5; color:var(--lp-ink); margin-bottom:1.5rem}
.lp-h2::before{content:""; position:absolute; left:0; top:.2em; bottom:.1em; width:calc(1em/3); background:var(--lp-key)}
.lp-body p+p,.lp-body p+ul,.lp-body p+ol,.lp-body ul+p,.lp-body ol+p{margin-top:1rem}
.lp-body strong{font-weight:700; color:var(--lp-ink)}
.lp-body ul{list-style:none}
.lp-body ul li{position:relative; padding-left:1.5rem}
.lp-body ul li+li{margin-top:.75rem}
.lp-body ul li::before{content:""; position:absolute; left:.25rem; top:.7em; width:.5rem; height:.5rem;
  border-radius:50%; background:var(--lp-key)}
/* 手順（この60分でやること）は番号付きで */
.lp-body ol{list-style:none; counter-reset:lp-step}
.lp-body ol li{position:relative; counter-increment:lp-step; padding:0 0 0 3rem; min-height:2.25rem}
.lp-body ol li+li{margin-top:1rem}
.lp-body ol li::before{content:counter(lp-step); position:absolute; left:0; top:0; width:2.25rem; height:2.25rem;
  display:flex; align-items:center; justify-content:center; border:1px solid var(--lp-key); border-radius:50%;
  color:var(--lp-key); font-weight:700; line-height:1}
.lp-lead{font-size:1.0625rem; line-height:1.9}

/* 登壇者 */
.lp-spk{display:flex; gap:1rem; align-items:center; margin-bottom:1.5rem}
.lp-spk img,.lp-initial{width:5.5rem; height:5.5rem; border-radius:50%; flex:0 0 5.5rem; object-fit:cover}
.lp-initial{display:flex; align-items:center; justify-content:center; background:var(--lp-key-soft);
  color:var(--lp-key); font-weight:700; font-size:2rem}
.lp-spk-name{font-size:1.25rem; font-weight:700; line-height:1.5; color:var(--lp-ink)}
.lp-spk-role{font-size:.875rem; line-height:1.6; color:var(--lp-sub)}

/* よくある質問（DADS の Accordion。details / summary で、JSを使わない） */
.lp-faq{border-top:1px solid var(--lp-line)}
.lp-faq details{border-bottom:1px solid var(--lp-line)}
.lp-faq summary{position:relative; display:block; cursor:pointer; padding:1rem .5rem 1rem 2.75rem;
  font-weight:700; line-height:1.7; color:var(--lp-ink); list-style:none}
.lp-faq summary::-webkit-details-marker{display:none}
.lp-faq summary:hover{background:var(--lp-bg-soft)}
.lp-faq summary::before{content:""; position:absolute; left:.25rem; top:1.1rem; width:1.5rem; height:1.5rem;
  border:1px solid currentColor; border-radius:50%; background:var(--lp-bg)}
.lp-faq summary::after{content:""; position:absolute; left:.8125rem; top:1.55rem; width:.4rem; height:.4rem;
  border-right:2px solid currentColor; border-bottom:2px solid currentColor; transform:rotate(45deg)}
.lp-faq details[open] summary::after{top:1.75rem; transform:rotate(-135deg)}
.lp-faq .lp-answer{padding:0 .5rem 1.25rem 2.75rem}

/* 最後の申込 */
.lp-close{text-align:center}
.lp-close .lp-btn{margin:0 auto}
.lp-closing{font-size:clamp(1.25rem,5vw,1.5rem); font-weight:700; line-height:1.6; color:var(--lp-ink)}
.lp-ended{font-weight:700; color:var(--lp-ink)}

.lp-footer{border-top:1px solid var(--lp-line-soft); padding:2rem 0 3rem; font-size:.875rem; line-height:1.7; color:var(--lp-sub)}
.lp-footer ul{list-style:none; display:flex; flex-wrap:wrap; gap:.5rem 1.5rem; margin-top:.75rem}

@media (forced-colors:active){
  .lp-h2::before,.lp-body ul li::before{background:CanvasText}
  .lp-hero.has-photo::after{display:none}
}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto !important}}
`.replace(/\n\s*/g, ' ').trim();

/** 開始・終了の時刻（日本時間）を UNIX ミリ秒にする。 */
function at(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00+09:00`);
}

/** 終了時刻を過ぎたか。過ぎたら申込ボタンを外し、noindex にする。 */
export function seminarEnded(s: Seminar, now: number): boolean {
  return now >= at(s.date, s.end);
}

/** `10月10日（土）` の形。曜日は日付だけで決まるので、UTC で数えてよい。 */
function dayLabel(date: string, withYear = false): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${withYear ? `${y}年` : ''}${m}月${d}日（${wd}）`;
}

/** `13:00〜14:00`。狭い画面でも時刻の途中では折らない（折るなら日付との間で）。 */
const timeSpan = (s: Seminar) => `<span class="lp-nowrap">${esc(s.start)}〜${esc(s.end)}</span>`;

const feeLabel = (fee: string) => (fee === '無料' ? '参加無料' : `参加費 ${fee}`);

/** 構造化データ用の参加費。「無料」は 0。数字が読めなければ出さない。 */
function priceOf(fee: string): number | null {
  if (fee.includes('無料')) return 0;
  const n = Number(fee.replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function imageUrl(origin: string, slug: string, name: string, img: SeminarImage): string {
  return `${origin}/seminar/${slug}/${name}.${img.ext}?v=${img.version}`;
}

/**
 * `|` の位置で改行する。**狭い画面でも改行する。** 1行が12字前後で収まる長さなので、
 * 自然な折り返しに任せると「やめ／る」のように語の途中で折れる方が読みにくい。
 */
const joinLines = (lines: string[]) => lines.map(esc).join('<br>');

/**
 * 申込ボタン。終了後は診断への導線に、申込URLが未設定のあいだは押せない表示にする。
 * Peatix へは同じタブで移る（別タブにすると、戻ってきた人が迷う）。行き先は補足で先に伝える。
 */
function cta(s: Seminar, ended: boolean): string {
  if (ended) {
    return (
      '<div class="lp-cta">' +
        '<p class="lp-ended">このセミナーは終了しました。</p>' +
        '<p class="lp-support">ナチュール診断は、いつでも受けられます。</p>' +
        '<a class="lp-btn" href="/" style="margin-top:1rem">診断を受ける（約2分・無料）</a>' +
      '</div>'
    );
  }
  const button = s.ticketUrl
    ? `<a class="lp-btn" href="${esc(s.ticketUrl)}">Peatixで申し込む（${esc(s.fee)}）</a>`
    // 押せない状態は aria-disabled で伝える（DADS のボタンと同じ）。リンクにはしない
    : '<span class="lp-btn" role="link" aria-disabled="true">お申し込みの受付は準備中です</span>';
  const support = [
    s.ctaNote,
    s.ticketUrl ? 'お申し込みは、イベント受付サービスのPeatixで受け付けます。' : '',
  ].filter(Boolean);
  return (
    '<div class="lp-cta">' +
      button +
      support.map((t) => `<p class="lp-support">${esc(t)}</p>`).join('') +
    '</div>'
  );
}

function speakerBlock(s: Seminar, origin: string): string {
  const img = s.images.speaker;
  const face = img
    ? `<img src="${esc(imageUrl(origin, s.slug, 'speaker', img))}" alt="${esc(s.speakerName)}の写真"` +
      ` width="${img.width}" height="${img.height}" loading="lazy">`
    // 写真が無いあいだは名前の頭文字。空の枠や仮の写真は置かない
    : `<span class="lp-initial" aria-hidden="true">${esc(s.speakerName.slice(0, 1))}</span>`;
  return (
    '<div class="lp-spk">' + face +
      '<div>' +
        `<p class="lp-spk-name">${esc(s.speakerName)}</p>` +
        `<p class="lp-spk-role">${esc(s.speakerRole)}</p>` +
      '</div>' +
    '</div>'
  );
}

function overview(s: Seminar, ended: boolean): string {
  const apply = ended
    ? '受付を終了しました'
    : s.ticketUrl
      ? `<a href="${esc(s.ticketUrl)}">Peatixのイベントページ</a>から`
      : '準備中です（Peatixで受け付けます）';
  return (
    '<dl class="lp-dl">' +
      `<dt>日時</dt><dd>${esc(dayLabel(s.date, true))}${timeSpan(s)}</dd>` +
      `<dt>形式</dt><dd>${esc(s.place)}${s.placeNote ? `<span class="lp-note">${esc(s.placeNote)}</span>` : ''}</dd>` +
      `<dt>参加費</dt><dd>${esc(s.fee)}</dd>` +
      `<dt>登壇</dt><dd>${esc(s.speakerName)}</dd>` +
      '<dt>主催</dt><dd>ナチュール診断（運営：Mikata）</dd>' +
      `<dt>お申し込み</dt><dd>${apply}</dd>` +
    '</dl>'
  );
}

/** 節を並べる。背景は白と薄いグレーを交互にして、節の切れ目を色で示す。 */
function sections(s: Seminar, origin: string, ended: boolean): string {
  return s.sections.map((sec, i) => {
    const soft = i % 2 === 0 ? ' is-soft' : '';
    const id = `sec-${i + 1}`;
    const head = `<h2 class="lp-h2" id="${id}">${esc(sec.heading)}</h2>`;
    let body: string;
    switch (sec.kind) {
      case 'speaker':
        body = speakerBlock(s, origin) + `<div class="lp-body">${sec.html}</div>`;
        break;
      case 'overview':
        body = overview(s, ended);
        break;
      case 'faq':
        body =
          '<div class="lp-faq">' +
            sec.items.map((it) =>
              `<details><summary>${esc(it.q)}</summary><div class="lp-answer lp-body">${it.html}</div></details>`
            ).join('') +
          '</div>';
        break;
      default:
        body = `<div class="lp-body">${sec.html}</div>`;
    }
    return `<section class="lp-sec${soft}" aria-labelledby="${id}"><div class="lp-wrap">${head}${body}</div></section>`;
  }).join('');
}

/**
 * Event の構造化データ（検索結果のイベント表示に使われる）。
 * 申込URLが未設定のあいだは、このページ自身を申込先として書く。
 */
function eventLd(s: Seminar, origin: string, canonical: string, ended: boolean) {
  const image = s.images.og
    ? [imageUrl(origin, s.slug, 'og', s.images.og)]
    : s.images.hero ? [imageUrl(origin, s.slug, 'hero', s.images.hero)] : [`${origin}/ogp.png`];
  const price = priceOf(s.fee);
  return {
    '@type': 'Event',
    name: s.title,
    description: s.description,
    startDate: `${s.date}T${s.start}:00+09:00`,
    endDate: `${s.date}T${s.end}:00+09:00`,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'VirtualLocation', url: s.ticketUrl || canonical },
    image,
    inLanguage: 'ja',
    organizer: { '@type': 'Organization', name: 'Mikata', url: `${origin}/about` },
    performer: { '@type': 'Person', name: s.speakerName },
    ...(price === null ? {} : {
      offers: {
        '@type': 'Offer',
        price,
        priceCurrency: 'JPY',
        url: s.ticketUrl || canonical,
        availability: ended ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      },
    }),
  };
}

function head(s: Seminar, origin: string, canonical: string, ended: boolean): string {
  const og = s.images.og;
  const ogUrl = og ? imageUrl(origin, s.slug, 'og', og) : `${origin}/ogp.png`;
  const ogW = og ? og.width : 1200;
  const ogH = og ? og.height : 630;

  const graph = [
    websiteLd(origin),
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE, item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: s.title, item: canonical },
      ],
    },
    eventLd(s, origin, canonical, ended),
  ];
  // JSON を <script> に埋めるので、`</` だけは崩しておく（本文に `</script>` が来ても閉じないように）
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/<\//g, '<\\/');

  return (
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    `<title>${esc(s.title)} | ${SITE}</title>` +
    `<meta name="description" content="${esc(s.description)}">` +
    (ended ? '<meta name="robots" content="noindex, nofollow">' : '') +
    `<link rel="canonical" href="${esc(canonical)}">` +
    ICONS +
    '<meta property="og:type" content="website">' +
    `<meta property="og:site_name" content="${SITE}">` +
    `<meta property="og:title" content="${esc(s.title)}">` +
    `<meta property="og:description" content="${esc(s.description)}">` +
    `<meta property="og:url" content="${esc(canonical)}">` +
    '<meta property="og:locale" content="ja_JP">' +
    `<meta property="og:image" content="${esc(ogUrl)}">` +
    `<meta property="og:image:width" content="${ogW}">` +
    `<meta property="og:image:height" content="${ogH}">` +
    `<meta property="og:image:alt" content="${esc(s.title)}">` +
    '<meta name="twitter:card" content="summary_large_image">' +
    `<meta name="twitter:image" content="${esc(ogUrl)}">` +
    `<script type="application/ld+json">${jsonLd}</script>` +
    FONTS +
    `<style>${LP_CSS}</style>`
  );
}

export function seminarPage(s: Seminar, origin: string, now: number): string {
  const canonical = `${origin}/seminar/${s.slug}`;
  const ended = seminarEnded(s, now);

  const hero = s.images.hero;
  const heroImg = hero
    ? `<img class="lp-hero-img" src="${esc(imageUrl(origin, s.slug, 'hero', hero))}" alt=""` +
      ` width="${hero.width}" height="${hero.height}" fetchpriority="high">`
    : '';

  // 項目の途中では折らない（「参／加無料」のように割れると読みにくい）。折るなら区切りの位置で
  const shoulder = [`${dayLabel(s.date)}${s.start}〜`, s.place, feeLabel(s.fee)]
    .map((x) => `<span class="lp-nowrap">${esc(x)}</span>`).join('｜');

  const body =
    '<a class="lp-skip" href="#main">本文へ移動</a>' +
    '<header class="lp-header"><div class="lp-wrap">' +
      `<p class="lp-brand"><b>オンラインセミナー</b>主催：${SITE}</p>` +
    '</div></header>' +
    '<main id="main">' +
      `<div class="lp-hero${hero ? ' has-photo' : ''}">` +
        heroImg +
        `<div class="lp-hero-inner"><p class="lp-catch">${s.catchLines.map(esc).join('<br>')}</p></div>` +
      '</div>' +
      '<div class="lp-wrap lp-intro">' +
        `<p class="lp-shoulder">${shoulder}</p>` +
        `<h1 class="lp-h1">${joinLines(s.headlineLines)}</h1>` +
        `<p class="lp-sub">${joinLines(s.subLines)}</p>` +
        '<dl class="lp-dl">' +
          `<dt>日時</dt><dd>${esc(dayLabel(s.date, true))}${timeSpan(s)}</dd>` +
          `<dt>形式</dt><dd>${esc(s.place)}</dd>` +
          `<dt>参加費</dt><dd>${esc(s.fee)}</dd>` +
        '</dl>' +
        cta(s, ended) +
        `<div class="lp-body lp-lead" style="margin-top:2.5rem">${s.lead}</div>` +
      '</div>' +
      sections(s, origin, ended) +
      '<section class="lp-sec lp-close" aria-label="お申し込み"><div class="lp-wrap">' +
        (s.closing && !ended ? `<p class="lp-closing">${joinLines(s.closing.split('|'))}</p>` : '') +
        cta(s, ended) +
      '</div></section>' +
    '</main>' +
    '<footer class="lp-footer"><div class="lp-wrap">' +
      `<p>主催：${SITE}（運営：Mikata）</p>` +
      '<ul>' +
        '<li><a href="/privacy">プライバシーポリシー</a></li>' +
        '<li><a href="/contact">お問い合わせ</a></li>' +
        `<li><a href="/">${SITE}を受ける</a></li>` +
      '</ul>' +
    '</div></footer>';

  return `<!DOCTYPE html><html lang="ja"><head>${head(s, origin, canonical, ended)}</head><body>${body}</body></html>`;
}
