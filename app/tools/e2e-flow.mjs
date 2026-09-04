/**
 * 診断を最初から最後まで、実際のブラウザで通す試験。
 *
 *   npm run dev                      # 別のターミナルで起動しておく
 *   npx playwright install chromium  # 初回だけ（ブラウザ本体を入れる）
 *   npm run test:flow
 *
 * ここでしか確かめられないのが F4-2 の「別タブでは結果が開けない」。
 * sessionStorage はタブごとなので、HTTPだけの試験では再現できない。
 */
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';

/** 実行環境にあるChromiumを探す。PLAYWRIGHT_BROWSERS_PATH があればそちらを優先。 */
function findChromium() {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, `${process.env.HOME}/.cache/ms-playwright`]
    .filter(Boolean);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const dir = readdirSync(root).find((d) => /^chromium-\d+$/.test(d));
    if (!dir) continue;
    for (const rel of ['chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const exe = `${root}/${dir}/${rel}`;
      if (existsSync(exe)) return exe;
    }
  }
  return undefined; // playwright の既定の探索に任せる
}

let fail = 0;
const t = (label, actual, expected) => {
  if (String(actual) !== String(expected)) {
    fail++;
    console.log(`  NG: ${label} → 期待 ${expected} / 実際 ${actual}`);
  }
};

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const p = await ctx.newPage();

// 紹介リンクと共有リンクの両方のパラメータを付けて入る
await p.goto(`${BASE}/?ref=TKtp46k&src=x`);
t('イントロが出る', await p.isVisible('#intro'), true);

await p.click('#startBtn');
t('フレームへ進む', await p.isVisible('#frame'), true);

await p.click('#frameStart');
t('設問へ進む', await p.isVisible('#quiz'), true);
t('1問目', await p.textContent('#qcount'), '1 / 24');

// 9問（二択）
for (let i = 1; i <= 9; i++) {
  t(`${i}問目のカウンタ`, await p.textContent('#qcount'), `${i} / 24`);
  await p.click('.choice >> nth=0');
}
t('10問目でリッカートに変わる', await p.isVisible('.scale-dots'), true);

// ひとつ戻る
await p.click('#backBtn');
t('戻ると9問目', await p.textContent('#qcount'), '9 / 24');
await p.click('.choice >> nth=0');

// 15問（リッカート）
for (let i = 10; i <= 24; i++) {
  t(`${i}問目のカウンタ`, await p.textContent('#qcount'), `${i} / 24`);
  await p.click('.scale-dots .dot >> nth=3');
}

await p.waitForURL('**/result', { timeout: 15000 });
await p.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
t('結果に着く', new URL(p.url()).pathname, '/result');
t('軸の帯が8本', (await p.$$('.axis-row')).length, 8);
t('トリセツが4枚', (await p.$$('.ts-card')).length, 4);
t('全Aを選ぶと OBL', await p.textContent('.chip'), 'OBL');

// 軸の点が動いているか（初期値0%のままなら動いていない）
const dots = await p.$$eval('.axis-dot', (els) => els.map((e) => e.style.left));
t('点が初期位置のままでない', dots.every((d) => d === '0%'), false);

// F4-2：別タブでは開けない
const p2 = await ctx.newPage();
await p2.goto(`${BASE}/result`);
await p2.waitForURL('**/result/closed', { timeout: 10000 });
t('別タブでは開けない', new URL(p2.url()).pathname, '/result/closed');

// F4-1：同じタブのリロードでは消えない
await p.reload();
await p.waitForSelector('body[data-ready="1"]', { timeout: 10000 });
t('リロードしても見られる', new URL(p.url()).pathname, '/result');

await browser.close();
console.log(fail ? `\n失敗 ${fail} 件` : '\n診断の通し動作：問題なし');
process.exit(fail ? 1 : 0);
