/**
 * 情報ページ（`/about`・`/faq`・`/contact`・`/privacy`・`/terms`）。
 *
 * 要件：アプリ化要件定義.md F6-2（index対象・SSR・見出し階層・内部リンク）と
 * F7-3（サイト名の統一・メタ情報・構造化データ・一問一答）。
 *
 * **文面はここに書かない。** 正は次の3ファイルで、`npm run content` が写している。
 *   公開ページ文面.md      → /about・/faq・/contact
 *   プライバシーポリシー.md → /privacy
 *   利用規約.md            → /terms
 * この器は、その中身に見出しとメタ情報と構造化データを付けるだけ。
 */
import { FAQ_ITEMS, INFO_PAGES, type InfoPage } from '../content/pages.ts';
import { page, siteFooter } from './layout.ts';
import { esc } from './result.ts';

export type InfoKey = keyof typeof INFO_PAGES;

/** URL のパスと中身の対応。ここに無いパスは 404 にする。 */
export const INFO_PATHS: Record<string, InfoKey> = {
  '/about': 'about',
  '/faq': 'faq',
  '/contact': 'contact',
  '/privacy': 'privacy',
  '/terms': 'terms',
};

/**
 * 本文まわりの見た目。
 *
 * prototype.html の CSS は `*{margin:0;padding:0}` で既定値を全部落としている。
 * 素の `<p>` `<ul>` をそのまま置くと、行間の無い塊になって読めない。
 * ここは prototype.html に無い画面なので、この CSS だけは手で書く（Admin と同じ扱い）。
 */
const INFO_CSS =
  '.info p{margin-bottom:15px; line-height:1.95}' +
  '.info ul,.info ol{margin:0 0 18px 1.5em}' +
  '.info ul{list-style:disc}' +
  '.info ol{list-style:decimal}' +
  '.info li{margin-bottom:7px; line-height:1.9}' +
  '.info li::marker{color:var(--faint)}' +
  '.info a{color:var(--trust); text-underline-offset:3px}' +
  '.info strong{font-weight:700}' +
  '.info code{font-size:.92em; background:#EDEDE8; border-radius:4px; padding:1px 5px}' +
  // 節の見出し。.sectlabel の見た目を借りつつ、最初の1つだけ上の余白を詰める。
  '.info h2{font-size:18px; font-weight:900; letter-spacing:.02em; line-height:1.5;' +
  ' margin:40px 0 14px}' +
  '.info h2:first-of-type{margin-top:30px}' +
  '.info .lead-in{font-size:15.5px; color:var(--ink); line-height:1.95; margin-bottom:6px}' +
  '.info .lead-in p{margin-bottom:12px}' +
  '.info .cta{margin-top:44px; padding-top:26px; border-top:1px solid var(--line)}';

const SITE = 'ナチュール診断';

function ogp(title: string, description: string, canonical: string): string {
  return (
    '<meta property="og:type" content="article">' +
    `<meta property="og:site_name" content="${SITE}">` +
    `<meta property="og:title" content="${esc(title)}">` +
    `<meta property="og:description" content="${esc(description)}">` +
    `<meta property="og:url" content="${esc(canonical)}">` +
    '<meta property="og:locale" content="ja_JP">' +
    '<meta name="twitter:card" content="summary_large_image">'
  );
}

/** サイト名としての認識（F7-3）。全ページに同じものを載せる。 */
function websiteLd(origin: string) {
  return {
    '@type': 'WebSite',
    name: SITE,
    alternateName: ['なちゅーる診断', 'ナチュール しんだん', 'Nature診断'],
    url: `${origin}/`,
    inLanguage: 'ja',
  };
}

/** 提供元の明示（F7-3 の E-E-A-T）。/about に載せる。 */
function organizationLd(origin: string) {
  return {
    '@type': 'Organization',
    name: 'Mikata',
    url: `${origin}/about`,
    founder: { '@type': 'Person', name: '齋藤祐希' },
    email: 'capou0872@gmail.com',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'JP',
      addressRegion: '埼玉県',
      addressLocality: '志木市',
      streetAddress: '本町6-26-18 クレルピエス 101号',
    },
  };
}

function breadcrumbLd(origin: string, name: string, canonical: string) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE, item: `${origin}/` },
      { '@type': 'ListItem', position: 2, name, item: canonical },
    ],
  };
}

/** よくある質問（F7-3）。リッチリザルトとAI要約での引用を狙う。 */
function faqLd() {
  return {
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/** ページの下に置く導線。どこから来ても診断へ戻れるようにする（F6-2）。 */
function cta(key: InfoKey): string {
  const links: Record<InfoKey, [string, string][]> = {
    about: [['/types', '全8タイプを見る'], ['/faq', 'よくある質問']],
    faq: [['/about', 'ナチュール診断とは'], ['/types', '全8タイプを見る']],
    contact: [['/faq', 'よくある質問'], ['/about', 'ナチュール診断とは']],
    privacy: [['/terms', '利用規約'], ['/contact', 'お問い合わせ']],
    terms: [['/privacy', 'プライバシーポリシー'], ['/contact', 'お問い合わせ']],
  };
  return (
    '<div class="cta">' +
      '<p style="margin-bottom:14px">24の質問に答えると、あなたのタイプがわかります。登録は不要で、約2分です。</p>' +
      '<a class="btn btn-wide" href="/" style="display:block; text-align:center; text-decoration:none">診断を受ける</a>' +
      '<p style="margin-top:16px; font-size:13px">' +
        links[key].map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join('　／　') +
      '</p>' +
    '</div>'
  );
}

export function infoPage(key: InfoKey, origin: string): string {
  const data: InfoPage = INFO_PAGES[key];
  const canonical = `${origin}/${key}`;

  const graph: unknown[] = [websiteLd(origin), breadcrumbLd(origin, data.h1, canonical)];
  if (key === 'faq') graph.push(faqLd());
  if (key === 'about') graph.push(organizationLd(origin));
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });

  const sections = data.sections
    .map((s) => `<h2>${esc(s.heading)}</h2>${s.html}`)
    .join('');

  return page(
    {
      title: `${data.title} | ${SITE}`,
      description: data.description,
      canonical,
      head:
        `<style>${INFO_CSS}</style>` +
        ogp(data.title, data.description, canonical) +
        `<script type="application/ld+json">${jsonLd}</script>`,
    },
    '<div class="app">' +
      `<header class="app-header"><a href="/" style="color:inherit; text-decoration:none">${SITE}</a></header>` +
      '<section class="screen active info">' +
        `<h1 class="hero">${esc(data.h1)}</h1>` +
        (data.lead ? `<div class="lead-in">${data.lead}</div>` : '') +
        sections +
        cta(key) +
      '</section>' +
      siteFooter() +
    '</div>'
  );
}
