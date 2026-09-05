/**
 * 読み解きガイド（全4章）を実際のブラウザで通す試験。
 *
 *   npm run dev                      # 別のターミナルで起動しておく
 *   npx playwright install chromium  # 初回だけ
 *   npm run test:guide
 *
 * 章送り・章立ての点・終章のCTA・ヒアリングの保存・申込フォームへの到達記録を見る。
 */
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';

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

// 診断を1件受けて、タブ照合値を入れる
await p.goto(`${BASE}/`);
await p.evaluate(async () => {
  const r = await fetch('/api/responses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: ['O','B','L','O','B','L','O','B','L',4,4,4,3,4,3,3,2,3,3,2,2,1,2,2] }),
  });
  sessionStorage.setItem('natur.tab', (await r.json()).tabToken);
});

await p.goto(`${BASE}/guide`);
await p.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
await p.waitForTimeout(300);

t('序章から始まる', await p.textContent('#bkFolio'), '1 / 4');
t('章の見出し', (await p.textContent('#bkHdR')).includes('序章'), true);
t('章立ての点が4つ', (await p.$$('.bk-dot')).length, 4);
t('タイプ名が表紙に出る', (await p.textContent('.bk-cover-for')).includes('突撃隊長'), true);
t('終章のCTAは隠れている', await p.isHidden('#guideEnd'), true);
t('前の章ボタンは隠れている', await p.isHidden('#bkPrev'), true);

for (const [n, want] of [[2, '第一章'], [3, '第二章'], [4, '終章']]) {
  await p.click('#bkNext');
  await p.waitForTimeout(300);
  t(`${n}章目のノンブル`, await p.textContent('#bkFolio'), `${n} / 4`);
  t(`${n}章目の見出し`, (await p.textContent('#bkHdR')).includes(want), true);
}
t('終章でCTAが出る', await p.isVisible('#guideEnd'), true);
t('ヒアリング欄が出る', await p.isVisible('#hearingBlock'), true);
t('次の章ボタンは消える', await p.isHidden('#bkNext'), true);

// 章立ての点から直接飛べる
await p.click('.bk-dot >> nth=1');
await p.waitForTimeout(250);
t('点から第一章へ飛べる', await p.textContent('#bkFolio'), '2 / 4');
await p.click('.bk-dot >> nth=3');
await p.waitForTimeout(250);

// ヒアリングは送信ボタンなしで保存される
await p.fill('#hearNow', '部下に任せたいのに、つい自分でやってしまう');
await p.fill('#hearFuture', '安心して任せられるようになりたい');
await p.locator('#hearFuture').blur();
await p.waitForTimeout(700);
t('保存された旨が出る', (await p.textContent('#hearNote')).includes('お預かり'), true);

// 申込ボタン：到達が記録され、?v= 付きのURLが別タブで開く
const [popup] = await Promise.all([
  ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null),
  p.click('#sessionApply'),
]);
if (!popup) { fail++; console.log('  NG: 申込タブが開かなかった'); }
else {
  const u = new URL(popup.url());
  t('申込URLがタイプ別', u.pathname, '/apply/OBL');
  t('到達IDが付く', /^\?v=[0-9a-f]{64}$/.test(u.search), true);
  await popup.close();
}

await p.click('#bkBack');
await p.waitForURL('**/result');
t('結果に戻れる', new URL(p.url()).pathname, '/result');

await browser.close();
console.log(fail ? `\n失敗 ${fail} 件` : '\nガイドの通し動作：問題なし');
process.exit(fail ? 1 : 0);
