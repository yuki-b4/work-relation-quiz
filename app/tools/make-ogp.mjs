/**
 * OGP画像（1200×630）を作る。
 *
 *   npm run ogp
 *
 * 要件：アプリ化要件定義.md F7-3（OGP画像は1200×630px、**診断名が読める大きさ**で入っていること）。
 *
 * **外部のデザインツールを使わず、スクリプトで作る。** 理由は3つ。
 *   ・色を prototype.html の CSS から取るので、サイトの色を変えれば追従できる
 *   ・文言を変えたくなったら、このファイルを直して再実行するだけで済む
 *   ・結果が毎回同じになる（手で描くと作り直すたびに少しずつ違うものになる）
 *
 * フォントは Noto Sans JP（サイトと同じ）。Google Fonts から取ってきて**データURIで埋め込む**。
 * ブラウザから直接 fonts.googleapis.com を読ませると、環境によっては取得に失敗して
 * 黙って別のフォントで描かれるため、先に取得して確実に埋める。
 * 取得できない環境では、端末にあるフォントへ落とす（警告を出す）。
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { APP_CSS } from '../src/content/styles.ts';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../assets/ogp.png');
/**
 * 実際に表示される大きさの控え。Xのタイムラインは幅500px前後で出るので、
 * **その大きさで診断名が読めるか**をここで見る（F7-3）。原寸だけ見ていると気づけない。
 */
const PREVIEW = resolve(here, '../assets/ogp-preview-500.png');

// ───────── 色はサイトから取る ─────────

/** APP_CSS の :root から変数を1つ読む。サイトの色を変えれば、この画像も追従する。 */
function cssVar(name, fallback) {
  const m = new RegExp(`--${name}\\s*:\\s*([^;}]+)`).exec(APP_CSS);
  return m ? m[1].trim() : fallback;
}

const C = {
  bg: cssVar('bg', '#F3F3EF'),
  surface: cssVar('surface', '#FFFFFF'),
  ink: cssVar('ink', '#232427'),
  muted: cssVar('muted', '#6E7176'),
  line: cssVar('line', '#E4E3DD'),
  trust: cssVar('trust', '#274A73'),
  coral: cssVar('coral', '#C0492B'),
  teal: cssVar('teal', '#0F6E56'),
};

// ───────── フォント ─────────

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/120.0.0.0 Safari/537.36';

/**
 * Noto Sans JP を @font-face のデータURIとして組み立てる。
 * 取れなければ空文字を返し、端末のフォントに任せる（描けるが、見た目はサイトと少しずれる）。
 */
async function embedFont(weights = [400, 700, 900]) {
  try {
    const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weights.join(';')}&display=swap`;
    // Chrome の UA で聞くと woff2 が返る（既定のUAだと ttf になり、10倍近く重い）
    const css = await (await fetch(url, { headers: { 'User-Agent': CHROME_UA } })).text();
    const faces = [];
    // 日本語は複数のサブセットに分かれて返る。**全部埋める**（1つだけだと一部の字が欠ける）
    for (const block of css.split('@font-face').slice(1)) {
      const src = /src:\s*url\((https:[^)]+)\)\s*format\('([^']+)'\)/.exec(block);
      const weight = /font-weight:\s*(\d+)/.exec(block);
      const range = /unicode-range:\s*([^;]+)/.exec(block);
      if (!src) continue;
      const buf = Buffer.from(await (await fetch(src[1])).arrayBuffer());
      faces.push(
        `@font-face{font-family:'Noto Sans JP';font-style:normal;font-weight:${weight ? weight[1] : 400};` +
        `src:url(data:font/${src[2]};base64,${buf.toString('base64')}) format('${src[2]}');` +
        (range ? `unicode-range:${range[1]};` : '') + '}'
      );
    }
    if (!faces.length) throw new Error('@font-face が取れなかった');
    return faces.join('\n');
  } catch (err) {
    console.warn('⚠ Noto Sans JP を取得できませんでした。端末のフォントで描きます。');
    console.warn(`  （${err.message}）サイトと同じ見た目にするには、ネットに繋がる環境で作り直してください。`);
    return '';
  }
}

// ───────── 中身 ─────────

/**
 * 載せる文言。**サイトのトップと同じ言葉を使う**。
 * 共有カードを見て開いた人が、同じ言葉に迎えられるようにするため。
 */
const COPY = {
  site: 'ナチュール診断',
  head: ['あなたの自然体が', 'わかる診断'],
  sub: '24問・2分・登録不要',
  url: 'natur-indicator.com',
};

function html(fontFaces) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
${fontFaces}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;
  font-family:'Noto Sans JP','Hiragino Sans','Yu Gothic',IPAGothic,sans-serif;
  background:${C.bg}; color:${C.ink}; -webkit-font-smoothing:antialiased}
.card{position:relative;width:1200px;height:630px;display:flex;flex-direction:column;
  justify-content:center; padding:0 96px}
/* 左端のアクセント。タイプの2つの極（オープン＝コーラル／ガード＝ティール）の色。
   **境目はぼかさない。** 中間色を作るとにじみに見えて、2つの極という意味が消える。 */
.bar{position:absolute;left:0;top:0;bottom:0;width:18px;
  background:linear-gradient(180deg, ${C.coral} 0%, ${C.coral} 50%, ${C.teal} 50%, ${C.teal} 100%)}
/* 診断名。F7-3 が「**診断名が読める大きさ**で入っていること」を求めているので、
   共有カードが小さく出る場面（Xのタイムラインは幅500px前後）でも読める大きさにする。 */
.site{font-size:40px;font-weight:900;letter-spacing:.16em;color:${C.trust};margin-bottom:30px}
.head{font-size:88px;font-weight:900;line-height:1.32;letter-spacing:.01em}
.sub{margin-top:34px;font-size:31px;font-weight:500;color:${C.muted};letter-spacing:.06em}
.foot{position:absolute;right:96px;bottom:54px;font-size:24px;font-weight:500;
  color:${C.muted};letter-spacing:.04em}
/* 右下の淡い円。余白が単調にならない程度に置く。文字には重ねない。 */
.blob{position:absolute;right:-150px;top:-150px;width:520px;height:520px;border-radius:50%;
  background:${C.surface};opacity:.75}
</style></head><body>
<div class="card">
  <div class="blob"></div>
  <div class="bar"></div>
  <div class="site">${COPY.site}</div>
  <div class="head">${COPY.head.join('<br>')}</div>
  <div class="sub">${COPY.sub}</div>
  <div class="foot">${COPY.url}</div>
</div>
</body></html>`;
}

// ───────── 書き出し ─────────

function findChromium() {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, `${process.env.HOME}/.cache/ms-playwright`].filter(Boolean);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const dir = readdirSync(root).find((d) => /^chromium-\d+$/.test(d));
    if (!dir) continue;
    for (const rel of ['chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const exe = `${root}/${dir}/${rel}`;
      if (existsSync(exe)) return exe;
    }
  }
  return undefined;
}

const fontFaces = await embedFont();
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html(fontFaces), { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
mkdirSync(dirname(OUT), { recursive: true });
await page.screenshot({ path: OUT, type: 'png' });

// 表示される大きさの控えも書き出す。file:// は読み込めないのでデータURIで貼る。
const { readFileSync, statSync } = await import('node:fs');
const preview = await browser.newPage({ viewport: { width: 500, height: 263 } });
await preview.setContent(
  `<style>*{margin:0}img{width:500px;display:block}</style>` +
  `<img src="data:image/png;base64,${readFileSync(OUT).toString('base64')}">`
);
await preview.waitForTimeout(300);
await preview.screenshot({ path: PREVIEW, type: 'png' });
await browser.close();

console.log(`OGP画像を書き出しました`);
console.log(`  ${OUT}`);
console.log(`    1200×630 / ${(statSync(OUT).size / 1024).toFixed(1)} KB`);
console.log(`  ${PREVIEW}`);
console.log(`    500×263（Xのタイムラインでの見え方。診断名が読めるか確認する）`);
console.log(`  フォント: ${fontFaces ? 'Noto Sans JP（サイトと同じ）' : '端末のフォント（要注意）'}`);
