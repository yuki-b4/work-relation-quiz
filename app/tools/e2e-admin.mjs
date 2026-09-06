/**
 * Admin（F2）を実際のブラウザで通す試験。
 *
 *   npm run dev
 *   npm run test:admin
 *
 * .dev.vars に ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD が要る
 * （既定は .dev.vars.example と同じ admin@example.com）。
 *
 * 見どころ：
 *   ・ログインしないと1枚も開けないこと
 *   ・回答→ガイド→到達→申込を作ってから、それが Admin の1画面で全部見えること
 *   ・氏名とメールが一覧では伏せられ、詳細でだけ出ること（6.2）
 *   ・未紐づけの申込を手で繋げること（F2-4）
 */
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'local-dev-password-1234';

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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();

// ── 1. 診断を1件受けて、ガイド・到達・申込まで作る（Adminに出すデータ） ──
const marker = `試験${Date.now().toString().slice(-6)}`;
await p.goto(`${BASE}/`);
const applyUrl = await p.evaluate(async (marker) => {
  const r = await fetch('/api/responses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      answers: ['O','B','L','O','B','L','O','B','L',4,4,4,3,4,3,3,2,3,3,2,2,1,2,2],
      frame: '自然体', src: 'x',
    }),
  });
  const { tabToken } = await r.json();
  const post = (path, body) => fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabToken, ...body }),
  });
  await post('/api/guide/view', {});
  await post('/api/guide/progress', { chapter: 3 });
  await post('/api/hearing', { now: `${marker}のヒアリング本文`, future: '落ち着いて過ごしたい' });
  const v = await (await post('/api/apply-visits', { cta: 'epilogue-2' })).json();
  return v.url;
}, marker);
t('到達IDつきの申込URLが返る', /^\/apply\/OBL\?v=[0-9a-f]{64}$/.test(applyUrl), true);

// 到達IDつきの申込（自動で紐づく）
await p.goto(`${BASE}${applyUrl}`);
await p.fill('#name', `紐づき ${marker}`);
await p.fill('#email', `linked-${marker}@example.com`);
await p.check('input[name="agree"]');
await p.click('#applySubmit');
await p.waitForSelector('#applyDone:not([hidden])', { timeout: 10000 });

// 手動紐づけの候補になる回答をもう1件作る（同じタイプ・申込なし）。
// これを毎回作らないと、試験を回すたびに候補が減って2回目から落ちる。
await p.goto(`${BASE}/`);
await p.evaluate(async () => {
  const r = await fetch('/api/responses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: ['O','B','L','O','B','L','O','B','L',4,4,4,3,4,3,3,2,3,3,2,2,1,2,2] }),
  });
  const { tabToken } = await r.json();
  // 申込フォームまで到達させる。候補の並びは「到達が新しい順」なので、これが先頭に来る。
  await fetch('/api/apply-visits', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabToken, cta: 'epilogue-1' }),
  });
});

// 到達IDなしの申込（未紐づけ。移行分や ?v= が落ちた場合にあたる）
await p.goto(`${BASE}/apply/OBL`);
await p.fill('#name', `未紐づけ ${marker}`);
await p.fill('#email', `orphan-${marker}@example.com`);
await p.check('input[name="agree"]');
await p.click('#applySubmit');
await p.waitForSelector('#applyDone:not([hidden])', { timeout: 10000 });

// ── 2. 認証（F2-1） ──
await p.goto(`${BASE}/admin/responses`);
t('未ログインでは開けない', await p.isVisible('input[name="password"]'), true);
t('一覧の中身が出ていない', (await p.textContent('body')).includes('紹介元コード'), false);

await p.fill('#email', EMAIL);
await p.fill('#password', 'wrong-password');
await p.click('button[type="submit"]');
await p.waitForSelector('.warn', { timeout: 8000 });
t('失敗の理由は伏せる', (await p.textContent('.warn')).includes('メールアドレスまたはパスワードが違います'), true);

await p.fill('#email', EMAIL);
await p.fill('#password', PASSWORD);
await p.click('button[type="submit"]');
await p.waitForURL('**/admin/responses', { timeout: 10000 });
t('ログインすると回答一覧へ入る', new URL(p.url()).pathname, '/admin/responses');
t('ログイン中のアドレスが出る', (await p.textContent('.ad-me')).includes(EMAIL), true);

// noindex（F6-3）
// ここは必ず**ページの中から**取りに行く。Playwright の request コンテキストは
// Secure Cookie を http へ送らないので、外から叩くと未ログインの応答を見てしまう。
const head = await p.evaluate(() => document.querySelector('meta[name="robots"]')?.content);
t('meta robots が noindex', head, 'noindex, nofollow');
const hdr = await p.evaluate(async () => {
  const r = await fetch('/admin/responses', { credentials: 'same-origin' });
  return {
    status: r.status, robots: r.headers.get('x-robots-tag'), cache: r.headers.get('cache-control'),
    frames: r.headers.get('content-security-policy'),
  };
});
t('ログイン済みで開ける', hdr.status, 200);
t('X-Robots-Tag が付く', hdr.robots, 'noindex, nofollow');
t('キャッシュさせない', (hdr.cache ?? '').includes('no-store'), true);
t('iframe に入れさせない（クリックジャッキング）', hdr.frames, "frame-ancestors 'none'");

// ── 3. 回答一覧（F2-2） ──
const headers = await p.$$eval('thead th', (els) => els.map((e) => e.textContent.trim()));
for (const col of ['日時', 'タイプ', '紹介元コード', '紹介者名', '流入元', 'ガイド到達', '対応状況']) {
  t(`列がある（${col}）`, headers.some((h) => h.includes(col)), true);
}
await p.goto(`${BASE}/admin/responses?visit=yes`);
const visitedRows = await p.$$eval('tbody tr', (els) => els.length);
t('申込フォーム到達ありで絞り込める', visitedRows >= 1, true);
await p.goto(`${BASE}/admin/responses?q=${encodeURIComponent(marker)}`);
t('ヒアリング本文でフリーワード検索できる', await p.$$eval('tbody tr', (e) => e.length), 1);

// ── 4. 回答詳細（F2-3） ──
await p.click('tbody tr:first-child a');
await p.waitForSelector('h1', { timeout: 8000 });
const detail = await p.textContent('body');
for (const block of ['1. 基本情報', '2. 診断結果', '3. 設問別回答（24問）', '4. 検証アンケート',
                     '5. 商談前ヒアリング', '6. 読み解きガイド到達', '7. 申込フォームへの到達と申込', '8. 運用']) {
  t(`ブロックがある（${block}）`, detail.includes(block), true);
}
t('設問が24行ある', await p.$$eval('table.q tbody tr', (els) => els.length), 24);
t('設問文が出る', detail.includes('誰かと話していて違和感を覚えたとき'), true);
t('リッカートの選んだ選択肢が出る', detail.includes('とてもそう思う（4）'), true);
t('5軸の帯が5本', await p.$$eval('.bar', (els) => els.length), 5);
t('ヒアリング本文が出る', detail.includes(`${marker}のヒアリング本文`), true);
t('ガイドの終章到達が出る', detail.includes('終章'), true);
t('申込者の氏名は詳細で全表示', detail.includes(`紐づき ${marker}`), true);
t('到達したCTAが出る', detail.includes('epilogue-2'), true);

// 運用欄の保存（F2-3 ブロック8）
await p.selectOption('#admin_status', '対応中');
await p.fill('#admin_note', `${marker} のメモ`);
await p.click('form[action^="/admin/responses/"] button[type="submit"]');
await p.waitForSelector('.ok', { timeout: 8000 });
t('保存できる', (await p.textContent('.ok')).includes('保存しました'), true);
t('保存した対応状況が残る', await p.inputValue('#admin_status'), '対応中');
t('保存したメモが残る', await p.inputValue('#admin_note'), `${marker} のメモ`);

// ── 5. 申込一覧と手動紐づけ（F2-4） ──
await p.goto(`${BASE}/admin/sessions?q=${encodeURIComponent(marker)}`);
const list = await p.textContent('body');
t('一覧では氏名を伏せる', list.includes(`紐づき ${marker}`), false);
t('一覧ではメールを伏せる', list.includes(`linked-${marker}@example.com`), false);
t('伏せた形で出る', /紐◯/.test(list), true);
t('未紐づけが目立つ', list.includes('未紐づけ'), true);

await p.click(`tbody tr:has-text("未◯") td:first-child a`);
await p.waitForSelector('h1', { timeout: 8000 });
t('詳細では氏名を全表示', (await p.textContent('body')).includes(`未紐づけ ${marker}`), true);
t('紐づけ候補が出る', await p.isVisible('input[name="response_id"]'), true);
await p.locator('input[name="response_id"]').first().check();
await p.click('button:has-text("選んだ回答に紐づける")');
await p.waitForSelector('.ok', { timeout: 8000 });
t('手で紐づけられる', (await p.textContent('.ok')).includes('紐づけました'), true);
t('紐づいた回答へのリンクが出る', await p.isVisible('a[href^="/admin/responses/"]'), true);

await p.goto(`${BASE}/admin/sessions?q=${encodeURIComponent(marker)}&linked=no`);
t('未紐づけの絞り込みから消える', (await p.textContent('body')).includes('未◯'), false);

// ── 6. 紹介者（F2-6） ──
await p.goto(`${BASE}/admin/referrers`);
await p.fill('#name', `紹介者${marker}`);
await p.fill('#initials', 'TK');
await p.click('button:has-text("コードを発行する")');
await p.waitForSelector('.ok', { timeout: 8000 });
const refs = await p.textContent('body');
t('コードを発行できる', /TK[a-z0-9]{5}/.test(refs), true);
t('紹介リンクが作られる', refs.includes('/?ref=TK'), true);
t('実績の列がある', refs.includes('ガイド到達'), true);

// ── 7. CSV（F2-7） ──
const csv = await p.evaluate(async () => {
  const r = await fetch('/admin/export/responses.csv', { credentials: 'same-origin' });
  const buf = new Uint8Array(await r.arrayBuffer());
  return {
    status: r.status,
    type: r.headers.get('content-type'),
    disposition: r.headers.get('content-disposition'),
    bom: buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf,
    // BOM を外してから読む。付けたまま読むと1列目の名前が合わなくなる。
    firstLine: new TextDecoder().decode(buf).replace(/^\uFEFF/, '').split('\r\n')[0],
  };
});
t('CSVが返る', csv.status, 200);
t('CSVとして返す', csv.type.startsWith('text/csv'), true);
t('ダウンロードさせる', (csv.disposition ?? '').includes('attachment'), true);
t('UTF-8 BOM が付く（Excelでの文字化け防止）', csv.bom, true);
t('ヘッダー行が日本語', csv.firstLine.includes('タイプコード'), true);
t('1列目が回答ID', csv.firstLine.split(',')[0], '回答ID');

// ── 8. ログアウト ──
await p.goto(`${BASE}/admin/responses`);
await p.click('.ad-me button');
await p.waitForSelector('input[name="password"]', { timeout: 8000 });
await p.goto(`${BASE}/admin/responses`);
t('ログアウト後は開けない', await p.isVisible('input[name="password"]'), true);

await browser.close();
console.log(fail ? `\n失敗 ${fail} 件` : '\nAdmin：問題なし');
process.exit(fail ? 1 : 0);
