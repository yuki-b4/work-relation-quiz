/**
 * セミナーの告知ページ（`/seminar/{slug}`）。
 *
 * 要件：アプリ化要件定義.md F4-5「セミナーの告知ページ」。
 * 参加申込はここでは受けず、Peatix のイベントページへ送る。
 *
 * **文面はここに書かない。** 正は `セミナーLP文面.md` で、`npm run content` が
 * `src/content/seminars.ts` に写している。この器は、開催情報から日時の表記・申込ボタン・
 * 構造化データを組み、終了後の表示に切り替えるだけ。
 */
import type { Seminar, SeminarImage } from '../content/seminars.ts';
import { websiteLd } from './info-page.ts';
import { page, siteFooter } from './layout.ts';
import { esc } from './result.ts';

const SITE = 'ナチュール診断';
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * このページだけの見た目。prototype.html に無い画面なので、ここだけは手で書く（info-page と同じ扱い）。
 * 色と書体は prototype.html の変数（--ink・--muted・--line・--coral など）に揃える。
 */
const SEM_CSS =
  // 写真の上に縦書きを載せる。写真が無いときは濃い地のまま縦書きだけを出す
  '.sem-hero{position:relative; overflow:hidden; border-radius:20px; background:#232427;' +
  ' aspect-ratio:4/5; margin-bottom:26px}' +
  // 写真が無いあいだは縦書きの高さだけあればよい。濃い面を大きく取りすぎない
  '.sem-hero.no-photo{aspect-ratio:1/1}' +
  '@media (min-width:560px){.sem-hero,.sem-hero.no-photo{aspect-ratio:16/11}}' +
  '.sem-hero img{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:62% 50%}' +
  // 縦書きは画像にせず文字で組む（小さい「っ」や句点の位置をブラウザが正しく組む）。
  // Noto Sans JP（Web フォント）は縦書きの字幅を持っていて、正しく組める（2026-09-25に確認）。
  // 読み込み中は端末のフォントで描かれる。縦書きの字幅を持たないフォント（一部の Linux の
  // WenQuanYi など）に当たると、その間だけ漢字が重なって見えることがある
  '.sem-catch{position:absolute; top:clamp(20px,6vw,36px); left:clamp(18px,5vw,34px); margin:0;' +
  ' writing-mode:vertical-rl; font-family:var(--display); font-weight:900; color:#FCFAF4;' +
  ' font-size:clamp(30px,8.4vw,46px); line-height:1.7; letter-spacing:.14em;' +
  ' text-shadow:0 1px 10px rgba(0,0,0,.3)}' +
  '.sem-kicker{font-size:13px; font-weight:700; color:var(--coral); letter-spacing:.06em; margin-bottom:10px}' +
  '.sem-h1{font-family:var(--display); font-weight:900; font-size:clamp(21px,6.3vw,34px);' +
  ' line-height:1.45; letter-spacing:.01em; margin-bottom:12px}' +
  '.sem-sub{font-size:clamp(15px,4vw,18px); font-weight:700; color:var(--muted); line-height:1.7; margin-bottom:22px}' +
  '.sem-facts{list-style:none; margin:0 0 22px; padding:12px 18px; background:var(--surface);' +
  ' border:1px solid var(--line); border-radius:14px; font-size:14.5px}' +
  '.sem-facts li{display:flex; gap:14px; padding:5px 0; line-height:1.7}' +
  '.sem-facts li+li{border-top:1px solid var(--line)}' +
  '.sem-facts b{flex:0 0 4em; color:var(--muted); font-weight:700}' +
  '.sem-cta .btn{display:block; text-align:center; text-decoration:none}' +
  '.sem-cta .btn.is-off{background:var(--faint); cursor:default}' +
  '.sem-cta-note{font-size:13px; color:var(--muted); text-align:center; margin-top:10px}' +
  '.sem-ended{font-weight:700; text-align:center; margin-bottom:14px}' +
  '.sem-nowrap{white-space:nowrap}' +
  '.sem-lead{font-size:15.5px; line-height:1.95; margin-top:40px}' +
  '.sem-lead p{margin-bottom:12px}' +
  '.sem-sec{margin-top:46px}' +
  '.sem-sec h2{font-size:19px; font-weight:900; line-height:1.5; letter-spacing:.02em; margin-bottom:14px;' +
  ' padding-left:12px; border-left:3px solid var(--coral)}' +
  '.sem-sec h3{font-size:15.5px; font-weight:700; line-height:1.6; margin:24px 0 6px}' +
  '.sem-sec p{margin-bottom:14px; line-height:1.95}' +
  '.sem-sec ul,.sem-sec ol{margin:0 0 16px 1.4em}' +
  '.sem-sec ul{list-style:disc}' +
  '.sem-sec ol{list-style:decimal}' +
  '.sem-sec li{margin-bottom:8px; line-height:1.85}' +
  '.sem-sec li::marker{color:var(--faint)}' +
  '.sem-sec strong{font-weight:700}' +
  '.sem-sec a{color:var(--trust); text-underline-offset:3px}' +
  '.sem-spk{display:flex; gap:16px; align-items:center; margin-bottom:16px}' +
  '.sem-spk img,.sem-initial{width:88px; height:88px; border-radius:50%; flex:0 0 88px; object-fit:cover}' +
  '.sem-initial{display:flex; align-items:center; justify-content:center; background:var(--line);' +
  ' color:var(--muted); font-family:var(--display); font-weight:900; font-size:30px}' +
  // .sem-sec p（段落の余白）より強くするため、親を付けて詳細度を上げる
  '.sem-spk .sem-spk-name{font-weight:900; font-size:18px; margin:0; line-height:1.5}' +
  '.sem-spk .sem-spk-role{font-size:13px; color:var(--muted); margin:2px 0 0; line-height:1.6}' +
  '.sem-dl{display:grid; grid-template-columns:5.5em 1fr; gap:12px 14px; margin:0; padding:18px;' +
  ' background:var(--surface); border:1px solid var(--line); border-radius:14px}' +
  '.sem-dl dt{color:var(--muted); font-weight:700; font-size:14px; line-height:1.7}' +
  '.sem-dl dd{margin:0; font-size:14.5px; line-height:1.7}' +
  '.sem-dl small{display:block; color:var(--muted); font-size:12.5px}' +
  '.sem-close{margin-top:54px; padding:28px 20px; background:var(--surface); border:1px solid var(--line);' +
  ' border-radius:20px}' +
  '.sem-closing{font-family:var(--display); font-weight:900; font-size:clamp(18px,4.8vw,22px);' +
  ' line-height:1.6; text-align:center; margin-bottom:18px}';

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
const timeSpan = (s: Seminar) => `<span class="sem-nowrap">${esc(s.start)}〜${esc(s.end)}</span>`;

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
 * Peatix へは同じタブで移る（別タブにすると、戻ってきた人が迷う）。
 */
function cta(s: Seminar, ended: boolean): string {
  if (ended) {
    return (
      '<div class="sem-cta">' +
        '<p class="sem-ended">このセミナーは終了しました。</p>' +
        '<a class="btn btn-wide" href="/">診断を受ける（約2分・無料）</a>' +
      '</div>'
    );
  }
  const button = s.ticketUrl
    ? `<a class="btn btn-wide" href="${esc(s.ticketUrl)}">Peatixで申し込む（${esc(s.fee)}）</a>`
    : '<span class="btn btn-wide is-off" aria-disabled="true">お申し込みの受付は準備中です</span>';
  return (
    '<div class="sem-cta">' +
      button +
      (s.ctaNote ? `<p class="sem-cta-note">${esc(s.ctaNote)}</p>` : '') +
    '</div>'
  );
}

function speakerBlock(s: Seminar, origin: string): string {
  const img = s.images.speaker;
  const face = img
    ? `<img src="${esc(imageUrl(origin, s.slug, 'speaker', img))}" alt="${esc(s.speakerName)}の写真"` +
      ` width="${img.width}" height="${img.height}" loading="lazy">`
    // 写真が無いあいだは名前の頭文字。空の枠や仮の写真は置かない
    : `<span class="sem-initial" aria-hidden="true">${esc(s.speakerName.slice(0, 1))}</span>`;
  return (
    '<div class="sem-spk">' + face +
      '<div>' +
        `<p class="sem-spk-name">${esc(s.speakerName)}</p>` +
        `<p class="sem-spk-role">${esc(s.speakerRole)}</p>` +
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
    '<dl class="sem-dl">' +
      `<dt>日時</dt><dd>${esc(dayLabel(s.date, true))}${timeSpan(s)}</dd>` +
      `<dt>形式</dt><dd>${esc(s.place)}${s.placeNote ? `<small>${esc(s.placeNote)}</small>` : ''}</dd>` +
      `<dt>参加費</dt><dd>${esc(s.fee)}</dd>` +
      `<dt>登壇</dt><dd>${esc(s.speakerName)}</dd>` +
      '<dt>主催</dt><dd>ナチュール診断（運営：Mikata）</dd>' +
      `<dt>お申し込み</dt><dd>${apply}</dd>` +
    '</dl>'
  );
}

function sections(s: Seminar, origin: string, ended: boolean): string {
  return s.sections.map((sec) => {
    const head = `<h2>${esc(sec.heading)}</h2>`;
    switch (sec.kind) {
      case 'speaker':
        return `<section class="sem-sec">${head}${speakerBlock(s, origin)}${sec.html}</section>`;
      case 'overview':
        return `<section class="sem-sec">${head}${overview(s, ended)}</section>`;
      case 'faq':
        return (
          `<section class="sem-sec">${head}` +
            sec.items.map((it) => `<h3>${esc(it.q)}</h3>${it.html}`).join('') +
          '</section>'
        );
      default:
        return `<section class="sem-sec">${head}${sec.html}</section>`;
    }
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

export function seminarPage(s: Seminar, origin: string, now: number): string {
  const canonical = `${origin}/seminar/${s.slug}`;
  const ended = seminarEnded(s, now);

  const og = s.images.og;
  const ogUrl = og ? imageUrl(origin, s.slug, 'og', og) : `${origin}/ogp.png`;
  const ogMeta = og ? { width: og.width, height: og.height, alt: s.title } : undefined;

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

  const hero = s.images.hero;
  const heroImg = hero
    ? `<img src="${esc(imageUrl(origin, s.slug, 'hero', hero))}" alt="" width="${hero.width}" height="${hero.height}"` +
      ' fetchpriority="high">'
    : '';

  const kicker = `${dayLabel(s.date)}${s.start}〜${s.end}｜${s.place}｜${feeLabel(s.fee)}`;

  return page(
    {
      title: `${s.title} | ${SITE}`,
      description: s.description,
      canonical,
      noindex: ended,
      ogImage: ogUrl,
      ogImageMeta: ogMeta,
      head:
        `<style>${SEM_CSS}</style>` +
        '<meta property="og:type" content="website">' +
        `<meta property="og:site_name" content="${SITE}">` +
        `<meta property="og:title" content="${esc(s.title)}">` +
        `<meta property="og:description" content="${esc(s.description)}">` +
        `<meta property="og:url" content="${esc(canonical)}">` +
        '<meta property="og:locale" content="ja_JP">' +
        '<meta name="twitter:card" content="summary_large_image">' +
        `<script type="application/ld+json">${jsonLd}</script>`,
    },
    '<div class="app">' +
      `<header class="app-header"><a href="/" style="color:inherit; text-decoration:none">${SITE}</a></header>` +
      '<main class="screen active sem">' +
        `<div class="sem-hero${hero ? '' : ' no-photo'}">` +
          heroImg +
          `<p class="sem-catch">${s.catchLines.map(esc).join('<br>')}</p>` +
        '</div>' +
        `<p class="sem-kicker">${esc(kicker)}</p>` +
        `<h1 class="sem-h1">${joinLines(s.headlineLines)}</h1>` +
        `<p class="sem-sub">${joinLines(s.subLines)}</p>` +
        '<ul class="sem-facts">' +
          `<li><b>日時</b><span>${esc(dayLabel(s.date, true))}${timeSpan(s)}</span></li>` +
          `<li><b>形式</b><span>${esc(s.place)}</span></li>` +
          `<li><b>参加費</b><span>${esc(s.fee)}</span></li>` +
        '</ul>' +
        cta(s, ended) +
        `<div class="sem-lead">${s.lead}</div>` +
        sections(s, origin, ended) +
        '<div class="sem-close">' +
          (s.closing && !ended ? `<p class="sem-closing">${joinLines(s.closing.split('|'))}</p>` : '') +
          cta(s, ended) +
        '</div>' +
      '</main>' +
      siteFooter() +
    '</div>'
  );
}
