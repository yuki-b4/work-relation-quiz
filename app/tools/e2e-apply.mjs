/**
 * 申込フォーム（F4-5）とX共有（F5）を実際のブラウザで通す試験。
 *
 *   npm run dev
 *   npm run test:apply
 *
 * 見どころは「申込が到達IDで回答に自動で紐づくか」と、
 * 「申込フォームに診断結果の本文が漏れていないか」。
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
  if (String(actual) !== String(expected)) { fail++; console.log(`  NG: ${label} → 期待 ${expected} / 実際 ${actual}`); }
};

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const p = await ctx.newPage();

await p.goto(`${BASE}/`);
await p.evaluate(async () => {
  const r = await fetch('/api/responses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: ['O','B','L','O','B','L','O','B','L',4,4,4,3,4,3,3,2,3,3,2,2,1,2,2] }),
  });
  sessionStorage.setItem('natur.tab', (await r.json()).tabToken);
});

// ── 結果画面のX共有（F5） ──
await p.goto(`${BASE}/result`);
await p.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
const href = await p.getAttribute('#shareX', 'href');
t('X の intent へ向く', href.startsWith('https://x.com/intent/post?text='), true);
const text = decodeURIComponent(href.split('text=')[1]);
t('タイプ名が「」で入る', text.includes('私は「突撃隊長」でした！'), true);
t('<br> ではなく改行', text.includes('\n') && !text.includes('<br>'), true);
t('共有先はトップ', text.includes('/?src=x'), true);
t('?ref= を使っていない', text.includes('ref='), false);
t('ハッシュタグが末尾', text.trim().endsWith('#ナチュール診断'), true);

// クリックすると記録される（F5-5）。開く先は x.com なので、開いたタブはすぐ閉じる。
const [xTab] = await Promise.all([
  ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null),
  p.click('#shareX'),
]);
if (xTab) await xTab.close().catch(() => {});
await p.waitForTimeout(600);
t('共有が記録された', await p.evaluate(async () => {
  const r = await fetch('/api/share', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabToken: sessionStorage.getItem('natur.tab') })
  });
  return r.ok;
}), true);

// ── ガイド終章から申込へ ──
await p.goto(`${BASE}/guide`);
await p.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
for (let i = 0; i < 3; i++) { await p.click('#bkNext'); await p.waitForTimeout(250); }
const [apply] = await Promise.all([
  ctx.waitForEvent('page', { timeout: 8000 }),
  p.click('#sessionApply'),
]);
await apply.waitForLoadState('domcontentloaded');
t('申込ページが開く', new URL(apply.url()).pathname, '/apply/OBL');

// ── 結果の本文が漏れていないこと（F4-5の必須事項） ──
const shown = await apply.textContent('body');
t('タイプ名は出てよい', shown.includes('突撃隊長'), true);
for (const leak of ['あるある', 'トリセツ', '沈黙が3秒続くと', '停滞をこじ開ける', 'あなたの深層', '部下に任せたいのに']) {
  t(`結果本文が漏れていない（${leak}）`, shown.includes(leak), false);
}

// ── honeypot ──
const hp = await apply.evaluate(() => {
  const el = document.querySelector('input[name="website"]');
  return el ? getComputedStyle(el.closest('div')).position : null;
});
t('honeypot が画面外にある', hp, 'absolute');

// 見た目の崩れを計算後のスタイルで見る。
// .vq-opt を .field の中に置くと .field label{display:block} と .field input{width:100%} に
// 負けて、チェックボックスが全幅になりラベルと縦積みになる。目視でしか気づけないので固定する。
const box = await apply.evaluate(() => {
  const input = document.querySelector('input[name="slots"]');
  const label = input.closest('label');
  const ci = getComputedStyle(input), cl = getComputedStyle(label);
  return { w: ci.width, h: ci.height, display: cl.display, align: cl.alignItems };
});
t('チェックボックスの幅が16px', box.w, '16px');
t('チェックボックスの高さが16px', box.h, '16px');
t('ラベルが横並び（flex）', box.display, 'flex');
t('中央揃え', box.align, 'center');

// ── 送信 ──
await apply.fill('#name', 'テスト太郎');
await apply.fill('#email', 'test@example.com');
await apply.fill('#concern', '任せたいのに抱え込んでしまう');
await apply.check('input[name="slots"][value="平日の夜（19時以降）"]');
await apply.check('input[name="slots"][value="土日の午前"]');
await apply.check('input[name="agree"]');
await apply.click('#applySubmit');
await apply.waitForSelector('#applyDone:not([hidden])', { timeout: 10000 });
t('完了画面が出る', (await apply.textContent('#applyDone')).includes('2営業日以内'), true);
t('フォームは隠れる', await apply.isHidden('#applyForm'), true);

await browser.close();
console.log(fail ? `\n失敗 ${fail} 件` : '\n申込とX共有：問題なし');
process.exit(fail ? 1 : 0);
