/**
 * 公開ページの検索まわりを機械的に見る。
 *
 *   npm run dev
 *   npm run test:seo
 *
 * アプリ化要件定義.md F6（インデックス設計）／F7-3（オンサイトの必須項目）／F8-2（robots.txt）。
 */
import { HONSHITSU, TORISET, TYPES, TYPE_CODES } from '../src/content/types.ts';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
let fail = 0;
const t = (label, actual, expected) => {
  if (String(actual) !== String(expected)) { fail++; console.log(`  NG: ${label} → 期待 ${expected} / 実際 ${actual}`); }
};
const get = async (p) => {
  const r = await fetch(BASE + p, { redirect: 'manual' });
  const body = await r.text();
  return {
    status: r.status,
    location: r.headers.get('location'),
    robots: r.headers.get('x-robots-tag'),
    body,
    // CSSは全ページに埋め込まれていて、そこに全画面のクラス名が並んでいる。
    // 「この画面にこのブロックが出ていないか」を見るときは、必ずこちらを使う。
    markup: body.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, ''),
  };
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

// 結果画面の中身を公開ページへ出していないこと。
// トリセツ・深層・5つの傾向は、診断を受けた人だけのものにする。
//
// 文言の部分一致で見ると、CTAの「わたしのトリセツも出ます」という案内に反応してしまう。
// 構造（そのブロック固有のクラス）と、実データの本文そのもので見る。
for (const path of ['/types', ...TYPE_CODES.map((c) => `/types/${c}`)]) {
  const r = await get(path);
  for (const marker of ['toriset-band', 'ts-card', 'class="honshitsu"', 'hs-core',
                        'r-spectrums', 'pv-kicker', 'focus-tag']) {
    t(`${path} に ${marker} が無い`, r.markup.includes(marker), false);
  }
}
for (const code of TYPE_CODES) {
  const r = await get(`/types/${code}`);
  t(`/types/${code} に深層の本文が無い`, r.markup.includes(HONSHITSU[code].core.slice(0, 24)), false);
  t(`/types/${code} にトリセツの本文が無い`, r.markup.includes(TORISET[code][0].t.slice(0, 16)), false);
  // 逆に、載せると決めたものは入っていること
  t(`/types/${code} にワンポイントがある`, r.markup.includes(TYPES[code].hitotsu.slice(0, 24)), true);
  t(`/types/${code} に相性がある`, r.markup.includes(TYPES[code].aishou.slice(0, 16)), true);
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
