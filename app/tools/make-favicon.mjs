/**
 * favicon 一式を作る（D-4）。
 *
 *   npm run favicon
 *
 * 出るもの（すべて assets/）
 *   favicon.svg          対応ブラウザはこれを使う。どの大きさでも滲まない
 *   favicon.ico          16+32px を1つにまとめた古い形式。/favicon.ico を直接見に来る相手向け
 *   apple-touch-icon.png 180×180。iOS のホーム画面用。**透過にしない**（黒地に合成されるため）
 *
 * **意匠はサイトのロゴと同じ（2026-10-06 の刷新で変えた）。** 藍と杏の2つの円を少し重ね、
 * 重なった部分を抜く。「あなた」と「相手」、そのあいだにある関係。ヘッダーのロゴ・OGP の印と同じもの。
 * 以前はコーラル／ティールを左右に塗り分けていたが、その2色は**タイプの極だけ**に使うことにしたので変えた。
 *
 * **重なりは塗らずに抜く。** ヘッダーでは地の色で塗っているが、タブの地は明るいことも暗いこともあるので、
 * 透過にしてどちらの地でも同じ形に見えるようにする。
 *
 * 16px では文字は読めないので、色と形だけで見分けがつくようにする。円の間隔は半径と同じにして、
 * 重なりの幅（16px で約5px）が潰れないようにする。
 *
 * 色は prototype.html の CSS から取る（OGP と同じやり方）。サイトの色を変えれば追従する。
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { APP_CSS } from '../src/content/styles.ts';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(here, '../assets');

function cssVar(name, fallback) {
  const m = new RegExp(`--${name}\\s*:\\s*([^;}]+)`).exec(APP_CSS);
  return m ? m[1].trim() : fallback;
}
const C = {
  bg: cssVar('bg', '#F6F1E9'),
  ai: cssVar('ai', '#2D4A6B'),
  an: cssVar('an', '#E9A24C'),
};

// ───────── 意匠（SVGが正。PNG も ICO もこれを描いて作る） ─────────

/**
 * 2つの円（左＝藍、右＝杏）と、重なりのレンズ形。
 * 半径 r の円を、中心の間隔 r で並べる（ロゴの viewBox 28×20 と同じ比率）。
 */
function mark(r, cx, cy) {
  const x1 = cx - r / 2, x2 = cx + r / 2;
  const h = Math.sqrt(r * r - (r / 2) * (r / 2));   // 交点の上下の距離
  const top = (cy - h).toFixed(3), bottom = (cy + h).toFixed(3);
  const lens = `M${cx} ${top}A${r} ${r} 0 0 1 ${cx} ${bottom}A${r} ${r} 0 0 1 ${cx} ${top}Z`;
  return { x1, x2, lens };
}

/**
 * @param opaque true なら背景を塗る（iOS 用）。false なら円の外と重なりは透過にして、
 *   濃いタブバーでも明るいタブバーでも浮かないようにする。
 */
function svg(opaque) {
  // iOS のホーム画面は角丸で切り抜かれるので、背景ありのときは小さめにして余白を取る
  const r = opaque ? 15 : 19;
  const m = mark(r, 32, 32);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <title>ナチュール診断</title>
  ${opaque ? `<rect width="64" height="64" fill="${C.bg}"/>` : ''}
  <mask id="m"><rect width="64" height="64" fill="#fff"/><path d="${m.lens}" fill="#000"/></mask>
  <g mask="url(#m)">
    <circle cx="${m.x1}" cy="32" r="${r}" fill="${C.ai}"/>
    <circle cx="${m.x2}" cy="32" r="${r}" fill="${C.an}"/>
  </g>
</svg>`;
}

// ───────── PNG に焼く ─────────

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

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });

async function png(size, opaque) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(
    `<style>*{margin:0;padding:0}html,body{width:${size}px;height:${size}px;overflow:hidden}` +
    `svg{display:block;width:${size}px;height:${size}px}</style>${svg(opaque)}`
  );
  const buf = await page.screenshot({ type: 'png', omitBackground: !opaque });
  await page.close();
  return buf;
}

// ───────── ICO を組み立てる ─────────

/**
 * ICO は「ヘッダ＋各サイズの目録＋中身」を並べただけの形式。
 * 中身に PNG をそのまま入れられる（Vista 以降）ので、変換は要らない。
 * 256px は目録の幅が1バイトなので 0 と書く決まりだが、ここでは 16 と 32 しか入れない。
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);            // 予約
  header.writeUInt16LE(1, 2);            // 1 = アイコン
  header.writeUInt16LE(images.length, 4);

  const dir = Buffer.alloc(16 * images.length);
  let offset = header.length + dir.length;
  images.forEach(({ size, buf }, i) => {
    const p = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, p);      // 幅
    dir.writeUInt8(size >= 256 ? 0 : size, p + 1);  // 高さ
    dir.writeUInt8(0, p + 2);                       // 色数（PNGなので0）
    dir.writeUInt8(0, p + 3);                       // 予約
    dir.writeUInt16LE(1, p + 4);                    // カラープレーン
    dir.writeUInt16LE(32, p + 6);                   // ビット深度
    dir.writeUInt32LE(buf.length, p + 8);
    dir.writeUInt32LE(offset, p + 12);
    offset += buf.length;
  });
  return Buffer.concat([header, dir, ...images.map((i) => i.buf)]);
}

// ───────── 書き出し ─────────

mkdirSync(ASSETS, { recursive: true });

const svgPath = resolve(ASSETS, 'favicon.svg');
writeFileSync(svgPath, svg(false) + '\n');

const p16 = await png(16, false);
const p32 = await png(32, false);
const icoPath = resolve(ASSETS, 'favicon.ico');
writeFileSync(icoPath, ico([{ size: 16, buf: p16 }, { size: 32, buf: p32 }]));

const applePath = resolve(ASSETS, 'apple-touch-icon.png');
writeFileSync(applePath, await png(180, true));

// 実際の大きさで並べた控え。**16px で見分けがつくか**をここで見る。
const previewPath = resolve(ASSETS, 'favicon-preview.png');
const shot = await browser.newPage({ viewport: { width: 420, height: 150 } });
const asImg = (buf, size) =>
  `<figure><img width="${size}" height="${size}" src="data:image/png;base64,${buf.toString('base64')}">` +
  `<figcaption>${size}px</figcaption></figure>`;
await shot.setContent(
  `<style>*{margin:0;padding:0;box-sizing:border-box}
   body{display:flex;gap:26px;align-items:flex-end;padding:24px;background:#fff;
     font:12px system-ui;color:#666}
   .dark{background:#232427;color:#bbb;padding:24px;display:flex;gap:26px;align-items:flex-end}
   figure{text-align:center}figcaption{margin-top:8px}img{display:block}</style>
   ${asImg(p16, 16)}${asImg(p32, 32)}${asImg(await png(64, false), 64)}
   <div class="dark">${asImg(p16, 16)}${asImg(p32, 32)}</div>`
);
await shot.screenshot({ path: previewPath, type: 'png' });
await browser.close();

const kb = (p) => `${(statSync(p).size / 1024).toFixed(1)} KB`;
console.log('favicon を書き出しました');
for (const p of [svgPath, icoPath, applePath, previewPath]) console.log(`  ${p}（${kb(p)}）`);
console.log('  favicon-preview.png で、16px でも見分けがつくか確認する（明るい地と暗い地の両方）');
