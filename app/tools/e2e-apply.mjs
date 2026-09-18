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
// **タイプ名も出さない**（2026-09-18）。秘匿のためではなく信頼のため。
// セミナー入口ではCookieからタイプを当てているので、名指しで出すと
// 「なぜ知っているのか」と受け取られる。入口ごとに出し分けるほうが不自然なので一律で消した。
t('タイプ名を出していない', shown.includes('突撃隊長'), false);
t('「◯◯のあなたへ」を出していない', shown.includes('のあなたへ'), false);
// 出さないのは画面だけ。記録には残す
t('タイプコードは hidden で送られる', await apply.getAttribute('input[name="typeCode"]', 'value'), 'OBL');

// ── セッションは60分で固定（2026-09-18）。予約カレンダーの枠と揃える ──
t('見出しの帯が60分', (await apply.textContent('.eyebrow')).trim(), '体験セッション（60分・無料）');
t('30〜45分の表記が残っていない', shown.includes('30〜45分'), false);
// 前置きの本文は削除した。長さと費用は帯が、入力の手間は各項目のヒントが伝える
t('前置きの本文を出していない', shown.includes('このセッションでは、あなたの診断結果をもとに'), false);
t('ガイドへのお礼は残す', shown.includes('読み解きガイドを最後まで読んでくださり'), true);
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
  const input = document.querySelector('input[name="agree"]');
  const label = input.closest('label');
  const ci = getComputedStyle(input), cl = getComputedStyle(label);
  return { w: ci.width, h: ci.height, display: cl.display, align: cl.alignItems };
});
t('チェックボックスの幅が16px', box.w, '16px');
t('チェックボックスの高さが16px', box.h, '16px');
t('ラベルが横並び（flex）', box.display, 'flex');
t('中央揃え', box.align, 'center');

// ── 宣言はここでは聞かない（施策a 段1・2026-09-12）。フォークで取り、無ければ当日に聞く ──
t('場面を聞かない', (await apply.$$('input[name="concernDomain"]')).length, 0);
t('相手を聞かない', (await apply.$$('input[name="concernTarget"]')).length, 0);
t('期限を聞かない', (await apply.$$('input[name="concernDeadline"]')).length, 0);

// ── 希望の時間帯も聞かない（2026-09-14）。送信の直後に予約カレンダーを出すので、
// 先に候補を聞くと同じことを2回させる。代わりに、その順番をボタンの直前で伝える ──
t('希望の時間帯を聞かない', (await apply.$$('input[name="slots"]')).length, 0);
t('送信後に日程を選ぶと伝えている',
  (await apply.textContent('#applyForm')).includes('申込完了後に日程調整のリンクが表示されます'), true);

t('開いた時点では予約カレンダーを読み込まない', await apply.getAttribute('#bookFrame', 'src'), null);

// ── 必須の入力検査（2026-09-18）。**足りないところは一度に全部出す** ──
// 1つ直すたびに送信し直させない。どこが足りないかは、その入力欄の直下に出す。
await apply.click('#applySubmit');
await apply.waitForTimeout(200);
const errs = await apply.$$eval('.field-err', (n) => n.map((e) => e.textContent));
t('空で送ると指摘が3件まとめて出る', errs.length, 3);
t('お名前の指摘', errs.includes('お名前を入力してください。'), true);
t('メールの指摘', errs.includes('メールアドレスを入力してください。'), true);
t('同意の指摘', errs.includes('プライバシーポリシーへの同意が必要です。'), true);
t('お名前に is-invalid が付く', await apply.$eval('#name', (e) => e.classList.contains('is-invalid')), true);
t('同意は囲みの .vq が赤くなる',
  await apply.$eval('#agree', (e) => e.closest('.vq').classList.contains('is-invalid')), true);
// 赤は計算後の色で見る。クラスだけ見ても、CSSが届いていなければ意味がない
t('枠線が実際に赤い', await apply.$eval('#name', (e) => getComputedStyle(e).borderColor), 'rgb(179, 38, 30)');
t('指摘は入力欄の直下にある', await apply.$eval('#name', (e) => e.nextElementSibling.className), 'field-err');
t('aria-invalid が付く', await apply.getAttribute('#email', 'aria-invalid'), 'true');
t('ボタンの下にも要約を出す',
  (await apply.textContent('#applyNote')).includes('上の赤い項目'), true);
t('送信はされない', await apply.isHidden('#applyForm'), false);

// 直したら、その場で赤が消える（送信し直すまで残ると、直ったのか分からない）
await apply.fill('#name', 'テスト太郎');
await apply.waitForTimeout(150);
t('直した項目の赤が消える', await apply.$eval('#name', (e) => e.classList.contains('is-invalid')), false);
t('直した項目の指摘も消える', (await apply.$$('.field-err')).length, 2);
t('他の項目の赤は残る', await apply.$eval('#email', (e) => e.classList.contains('is-invalid')), true);

// メールの形式も見る（サーバ側の検査と同じ形）
await apply.fill('#email', 'bad-email');
await apply.click('#applySubmit');
await apply.waitForTimeout(200);
t('形式が不正なら形式の指摘に変わる',
  (await apply.$$eval('.field-err', (n) => n.map((e) => e.textContent))).some((e) => e.includes('形式をご確認ください')), true);

// ── 送信 ──
await apply.fill('#email', 'test@example.com');
await apply.fill('#concern', '任せたいのに抱え込んでしまう');
await apply.check('input[name="agree"]');

await apply.click('#applySubmit');
await apply.waitForSelector('#applyDone:not([hidden])', { timeout: 10000 });
t('完了画面が出る', (await apply.textContent('#applyDone')).includes('2営業日以内'), true);
t('完了の文言', (await apply.textContent('#applyDone .bk-band')).trim(), 'お申し込みありがとうございました。');
t('フォームは隠れる', await apply.isHidden('#applyForm'), true);

// 予約カレンダー：**送信が通ってから**読み込む（開いただけで Google へ通信させない）
t('送信後に予約カレンダーの src が入る',
  (await apply.getAttribute('#bookFrame', 'src') ?? '').startsWith('https://calendar.google.com/calendar/appointments/'), true);
t('開かないときの逃げ道がある',
  (await apply.textContent('#applyDone')).includes('こちらから日程を選べます'), true);

await browser.close();
console.log(fail ? `\n失敗 ${fail} 件` : '\n申込とX共有：問題なし');
process.exit(fail ? 1 : 0);
