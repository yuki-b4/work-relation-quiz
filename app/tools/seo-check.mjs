/**
 * 公開ページの検索まわりを機械的に見る。
 *
 *   npm run dev
 *   npm run test:seo
 *
 * アプリ化要件定義.md F6（インデックス設計）／F7-3（オンサイトの必須項目）／F8-2（robots.txt）。
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
let fail = 0;
const t = (label, actual, expected) => {
  if (String(actual) !== String(expected)) { fail++; console.log(`  NG: ${label} → 期待 ${expected} / 実際 ${actual}`); }
};
const get = async (p) => {
  const r = await fetch(BASE + p, { redirect: 'manual' });
  return { status: r.status, location: r.headers.get('location'), robots: r.headers.get('x-robots-tag'), body: await r.text() };
};
const pick = (s, re) => (s.match(re) ?? [])[1] ?? null;

// ── index させるページ ──
for (const path of ['/', '/types', '/types/OBL', '/types/OBS', '/types/OKL', '/types/OKS',
                    '/types/GBL', '/types/GBS', '/types/GKL', '/types/GKS']) {
  const r = await get(path);
  t(`${path} が 200`, r.status, 200);
  t(`${path} に noindex が付いていない`, /noindex/.test(r.body) || r.robots?.includes('noindex') || false, false);
  t(`${path} に title`, !!pick(r.body, /<title>(.*?)<\/title>/), true);
  t(`${path} に description`, !!pick(r.body, /name="description" content="(.*?)"/), true);
  t(`${path} の canonical が https`, (pick(r.body, /rel="canonical" href="(.*?)"/) ?? '').startsWith('https://'), true);
  t(`${path} の h1 が1つ`, (r.body.match(/<h1/g) ?? []).length, 1);
  t(`${path} に og:title`, r.body.includes('og:title'), true);
  t(`${path} に構造化データ`, r.body.includes('application/ld+json'), true);
  // JSがなくても本文が読めること（F6-1）
  t(`${path} の本文がHTMLに入っている`, r.body.replace(/<[^>]*>/g, '').replace(/\s+/g, '').length > 400, true);
}

// ── index させないページ ──
for (const path of ['/result', '/guide', '/apply/OBL']) {
  const r = await get(path);
  t(`${path} に X-Robots-Tag`, (r.robots ?? '').includes('noindex'), true);
  t(`${path} が sitemap に載っていない`, (await get('/sitemap.xml')).body.includes(`${path}<`), false);
}

// ── リダイレクト（F6-4） ──
for (const [from, to] of [['/quiz', '/'], ['/prototype.html', '/'], ['/index.html', '/'], ['/all-types.html', '/types']]) {
  const r = await get(from);
  t(`${from} が301`, r.status, 301);
  t(`${from} の行き先`, new URL(r.location, BASE).pathname, to);
}

// ── sitemap と robots ──
const sm = await get('/sitemap.xml');
t('sitemap が10件', (sm.body.match(/<loc>/g) ?? []).length, 10);
t('sitemap が https', sm.body.includes('<loc>https://'), true);

const rb = await get('/robots.txt');
t('robots に sitemap', /Sitemap: https:\/\/.+\/sitemap\.xml/.test(rb.body), true);
t('robots が /api/ を止める', rb.body.includes('Disallow: /api/'), true);
// F8：学習クローラは弾き、AI検索とエージェント・検索エンジンは通す（確認事項11＝a）
for (const ua of ['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended', 'Bytespider']) {
  t(`robots が ${ua} を弾く`, rb.body.includes(`User-agent: ${ua}`), true);
}
for (const ua of ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'Twitterbot']) {
  t(`robots が ${ua} を名指しで弾いていない`, rb.body.includes(`User-agent: ${ua}`), false);
}
// Admin は robots.txt に書かない（パスを晒さない・noindexを読ませるため。F6-3）
t('robots に /admin を書いていない', rb.body.includes('/admin'), false);

console.log(fail ? `\n失敗 ${fail} 件` : '\n検索まわり：問題なし');
process.exit(fail ? 1 : 0);
