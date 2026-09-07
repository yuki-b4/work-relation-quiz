/**
 * ページの器。
 *
 * CSS は prototype.html の <style> をそのまま埋め込む（F3-1）。
 * 外部CSSにせず inline にしているのは、1リクエストで描き切って LCP を稼ぐため（F7-4）。
 */
import { APP_CSS, INDEX_CSS } from '../content/styles.ts';
import { esc } from './result.ts';

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Noto+Serif+JP:wght@400;600;700&display=swap" rel="stylesheet">';

export type PageOptions = {
  title: string;
  description?: string;
  /** 検索結果に出さない画面（/result・/guide・/apply）は true（F6-3）。 */
  noindex?: boolean;
  canonical?: string;
  bodyClass?: string;
  /** <head> に足すもの（OGP・構造化データなど）。 */
  head?: string;
  /** </body> の直前に置くスクリプト。 */
  script?: string;
};

/**
 * 公開ページの共通フッター（F6-2 の内部リンク）。
 * `/privacy` と `/terms` はここからしか辿れないので、置き場所を削らない。
 *
 * **`.app` の内側に置くこと。** body は中央寄せの flex で、`.app` が唯一の子である前提。
 * 外に出すと横に並んでしまう。
 * index させる公開ページにだけ付ける。結果やガイドの途中に外へ出る導線は増やさない。
 */
const FOOT_LINKS: [string, string][] = [
  ['/', '診断を受ける'],
  ['/types', '全8タイプ'],
  ['/about', 'ナチュール診断とは'],
  ['/faq', 'よくある質問'],
  ['/contact', 'お問い合わせ'],
  ['/privacy', 'プライバシーポリシー'],
  ['/terms', '利用規約'],
];

const FOOT_CSS =
  '.site-foot{margin-top:56px; padding-top:22px; border-top:1px solid var(--line);' +
  ' font-size:13px; color:var(--muted)}' +
  '.site-foot nav{display:flex; flex-wrap:wrap; gap:10px 18px; margin-bottom:16px}' +
  '.site-foot a{color:var(--muted); text-decoration:none}' +
  '.site-foot a:hover{color:var(--ink); text-decoration:underline}' +
  '.site-foot .foot-name{font-size:12px; color:var(--faint); letter-spacing:.04em}' +
  // 設問に進んだら消す。答えている最中に、外へ出るリンクを足元に残さない。
  // #intro があるのはトップだけなので、ほかのページには効かない。
  '.app:has(#intro:not(.active)) .site-foot{display:none}';

export function siteFooter(): string {
  return (
    '<footer class="site-foot">' +
      '<nav>' +
        FOOT_LINKS.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join('') +
      '</nav>' +
      '<p class="foot-name">ナチュール診断　運営：Mikata</p>' +
    '</footer>'
  );
}

export function page(opts: PageOptions, body: string): string {
  const robots = opts.noindex
    ? '<meta name="robots" content="noindex, nofollow">'
    : '';
  const canonical = opts.canonical ? `<link rel="canonical" href="${esc(opts.canonical)}">` : '';
  const desc = opts.description ? `<meta name="description" content="${esc(opts.description)}">` : '';
  return (
    '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    `<title>${esc(opts.title)}</title>` +
    desc + robots + canonical + (opts.head ?? '') + FONTS +
    `<style>${APP_CSS}\n${INDEX_CSS}\n${FOOT_CSS}</style></head>` +
    `<body${opts.bodyClass ? ` class="${esc(opts.bodyClass)}"` : ''}>` +
    body +
    (opts.script ? `<script>${opts.script}</script>` : '') +
    '</body></html>'
  );
}

/** 結果が見られなくなったときの案内（F4-4）。410 で返す。 */
export function closedPage(): string {
  return page(
    { title: 'この結果は閉じられています | ナチュール診断', noindex: true },
    '<div class="app">' +
      '<header class="app-header">ナチュール診断</header>' +
      '<section class="screen active">' +
        '<h1 class="hero" style="font-size:clamp(22px,5vw,30px)">この結果はすでに閉じられています</h1>' +
        '<p class="lead">診断結果は、その場かぎりの表示です。画面を閉じると、同じ端末でももう一度開くことはできません。</p>' +
        '<p class="lead">もう一度受けていただくと、あらためて結果をご覧いただけます。</p>' +
        '<a class="btn btn-wide" href="/" style="display:block; text-align:center; text-decoration:none">もう一度診断を受ける</a>' +
      '</section>' +
    '</div>'
  );
}
