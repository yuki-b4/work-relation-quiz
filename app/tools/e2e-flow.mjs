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

// ── 宣言のフォーク（施策a 段1・A-1）。結果に重ねるモーダル・3クリック以内 ──
await p.click('#openGuide');
t('モーダルで開く', await p.$eval('#dcModal', (d) => d.open), true);
t('結果は裏に残る（取り上げない）', await p.isVisible('#result'), true);
t('どちらの出し方かが残る', await p.getAttribute('body', 'data-fork'), 'cta');
t('フォークが出る', await p.isVisible('#dcModal [data-step="domain"]'), true);
t('1問目は場面', (await p.textContent('#dcModal [data-step="domain"] .qtext')).includes('この結果を、どこで使いますか'), true);

await p.click('#dcModal [data-step="domain"] .choice >> nth=0');   // ①職場
t('2問目は相手（職場の選択肢）', await p.isVisible('#dcModal [data-step="target-work"]'), true);
t('恋愛の選択肢は出ない', await p.isHidden('#dcModal [data-step="target-love"]'), true);

await p.click('#dcBack');
t('ひとつ戻れる', await p.isVisible('#dcModal [data-step="domain"]'), true);

await p.click('#dcModal [data-step="domain"] .choice >> nth=0');   // ①職場
await p.click('#dcModal [data-step="target-work"] .choice >> nth=0'); // 上司
t('3問目は期限', await p.isVisible('#dcModal [data-step="deadline"]'), true);
await p.click('#dcModal [data-step="deadline"] .choice >> nth=0');  // 今すぐ

// ブリッジ：宣言をそのまま読み上げ、場面に合った約束と、ガイドで何を読み解くかを返す
await p.waitForSelector('#dcModal [data-step="bridge"]:not([hidden])', { timeout: 10000 });
t('選んだ相手が返ってくる', await p.textContent('#dcHead'), '上司との関係');
t('選んだ場面と期限も返る', await p.textContent('#dcSub'), '職場　／　今すぐ');
// 約束には**選んだ相手の名前**が入る（§3.5：核は変えず、相手と場面だけ差し替える）
t('約束に相手の名前が入る',
  await p.textContent('#dcModal [data-promise="work:boss"]'), '上司と話した日に、どっと疲れて帰るのをやめる。');
t('ほかの相手の約束は出ない', await p.isHidden('#dcModal [data-promise="work:peer"]'), true);
t('恋愛の約束も出ない', await p.isHidden('#dcModal [data-promise="love:partner"]'), true);
// 一手（実演）：結果カードのトリセツ1枚がそのまま持ってこられる
t('トリセツが1枚だけ持ってこられる', (await p.$$('#dcCard .ts-card')).length, 1);
t('結果カードと同じ1枚目', (await p.textContent('#dcCard .ts-card')).includes('こう接すると、うまくいく'), true);
t('一手に相手の名前が入る',
  await p.textContent('#dcModal [data-action="work:boss"]'), 'この1枚だけ、上司に伝えてみてください。');
t('ほかの相手の一手は出ない', await p.isHidden('#dcModal [data-action="love:partner"]'), true);
// 限界（ガイド終章の断ち切りの先出し）→ ガイドの中身 → CTA
t('一人では気づけないと置く',
  (await p.textContent('#dcModal .link-note')).includes('自分だけでは気づくことができません'), true);
t('ガイドで何を読み解くかが出る',
  (await p.textContent('#dcModal .link-note')).includes('なぜ、相手ではなく自分から始めるのか'), true);
t('ブリッジでは戻るを出さない', await p.isHidden('#dcBack'), true);
t('ブリッジでは飛ばすを出さない', await p.isHidden('#dcSkipWrap'), true);

await p.click('#dcGo');
await p.waitForURL('**/guide', { timeout: 15000, waitUntil: 'domcontentloaded' });
t('宣言のあとはガイドへ', new URL(p.url()).pathname, '/guide');


// 記録できていれば、戻ってきても二度は聞かれない（declared がサーバから返る）
await p.goto(`${BASE}/result`);
await p.waitForSelector('body[data-ready="1"]', { timeout: 10000 });
await p.click('#openGuide');
await p.waitForURL('**/guide', { timeout: 15000, waitUntil: 'domcontentloaded' });
t('宣言済みならフォークを出さない', new URL(p.url()).pathname, '/guide');

// ── ボタンを押さない人にも出す（auto）。結果を読み終えたところで1回だけ ──
// **ここが今回の肝。** ガイドへ進ませるのが目的なので、押す気配のない人にこそ出す。
const p3 = await ctx.newPage();
await p3.goto(`${BASE}/`);
await p3.evaluate(async () => {
  const r = await fetch('/api/responses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: ['O','B','L','O','B','L','O','B','L',4,4,4,3,4,3,3,2,3,3,2,2,1,2,2] }),
  });
  sessionStorage.setItem('natur.tab', (await r.json()).tabToken);
});
await p3.goto(`${BASE}/result`);
await p3.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
t('開いた直後には出ない', await p3.$eval('#dcModal', (d) => d.open), false);

// 深層（カードの終盤）まで読んだ人に出す。最低滞在を満たすまでは出ない
await p3.locator('.deep-section').scrollIntoViewIfNeeded();
await p3.waitForSelector('#dcModal[open]', { timeout: 40000 });
t('押していない人にも出る', await p3.getAttribute('body', 'data-fork'), 'auto');
t('中身は同じフォーク', await p3.isVisible('#dcModal [data-step="domain"]'), true);

await p3.click('#dcClose');
t('閉じれば結果に戻れる', await p3.$eval('#dcModal', (d) => d.open), false);
await p3.click('#openGuide');
t('閉じたあともボタンからは開き直せる', await p3.$eval('#dcModal', (d) => d.open), true);

await browser.close();
console.log(fail ? `\n失敗 ${fail} 件` : '\n診断の通し動作：問題なし');
process.exit(fail ? 1 : 0);
