/**
 * 結果セッションの判定（F4）の試験。
 *
 *   node --experimental-strip-types tools/result-session-test.mjs
 *
 * DBに触らない純関数（evaluate）とCookieの組み立てだけを見る。
 * ここが崩れると「一度閉じたら見られない」「他のデバイスでは見られない」が静かに壊れる。
 */
import {
  evaluate, buildResultCookie, clearResultCookie, readResultCookie,
  randomToken, isoPlus, RESULT_COOKIE, DEFAULT_LIMITS,
} from '../src/lib/result-session.ts';

let pass = 0;
const fails = [];
function check(label, cond) {
  if (cond) pass++;
  else fails.push(label);
}
function eq(label, a, b) {
  check(`${label}（期待 ${JSON.stringify(b)}、実際 ${JSON.stringify(a)}）`, JSON.stringify(a) === JSON.stringify(b));
}

const T0 = '2026-09-03T10:00:00.000Z';
const TAB = 'tab-abc';
const row = (o = {}) => ({
  id: 'sess-1',
  tab_token: TAB,
  response_id: 'resp-1',
  issued_at: T0,
  expires_at: isoPlus(T0, 2 * 3600_000),   // 発行から2時間
  last_seen_at: T0,
  closed_at: null,
  closed_reason: null,
  ...o,
});

// ── 通るケース ──
eq('発行直後・タブ一致 → 表示できる',
  evaluate(row(), TAB, T0), { ok: true, responseId: 'resp-1' });

eq('29分後（無操作30分の手前）→ まだ表示できる',
  evaluate(row(), TAB, isoPlus(T0, 29 * 60_000)), { ok: true, responseId: 'resp-1' });

eq('操作を続けていれば1時間59分後でも表示できる',
  evaluate(row({ last_seen_at: isoPlus(T0, 119 * 60_000) }), TAB, isoPlus(T0, 119 * 60_000)),
  { ok: true, responseId: 'resp-1' });

// ── (b) 一度閉じたら見られない ──
eq('タブを閉じた（sessionStorage が消えて照合値が無い）→ 見られない',
  evaluate(row(), null, T0), { ok: false, reason: 'tab_mismatch' });

eq('同じブラウザの別タブ（照合値が違う）→ 見られない',
  evaluate(row(), 'tab-other', T0), { ok: false, reason: 'tab_mismatch' });

eq('「結果を閉じる」を押した → 見られない',
  evaluate(row({ closed_at: isoPlus(T0, 60_000), closed_reason: 'user_close' }), TAB, isoPlus(T0, 120_000)),
  { ok: false, reason: 'closed' });

eq('もう一度診断した（retake で閉じた）→ 古い結果は見られない',
  evaluate(row({ closed_at: T0, closed_reason: 'retake' }), TAB, T0),
  { ok: false, reason: 'closed' });

// ── (a)(c) 他のデバイス・他人にはCookieが無い ──
eq('Cookie が無い（＝別デバイス、URLを受け取っただけの他人）→ 見られない',
  evaluate(null, TAB, T0), { ok: false, reason: 'not_found' });

// ── 失効 ──
eq('無操作ちょうど30分 → 失効',
  evaluate(row(), TAB, isoPlus(T0, 30 * 60_000)), { ok: false, reason: 'expired' });

eq('発行からちょうど2時間 → 失効（操作を続けていても）',
  evaluate(row({ last_seen_at: isoPlus(T0, 119 * 60_000) }), TAB, isoPlus(T0, 120 * 60_000)),
  { ok: false, reason: 'expired' });

eq('閉じたものが失効時刻を過ぎても、理由は closed のまま',
  evaluate(row({ closed_at: T0, closed_reason: 'user_close' }), TAB, isoPlus(T0, 10 * 3600_000)),
  { ok: false, reason: 'closed' });

// ── Cookie の組み立て ──
const cookie = buildResultCookie('abc123');
check('Cookie に HttpOnly が付く（JSから読めない＝他デバイスへ移せない）', cookie.includes('HttpOnly'));
check('Cookie に Secure が付く', cookie.includes('Secure'));
check('Cookie に SameSite が付く', cookie.includes('SameSite=Lax'));
check('Cookie の Path が / ', cookie.includes('Path=/'));
check('**Cookie に Max-Age を付けない**（付けるとブラウザを閉じても残り、要求4が壊れる）',
  !/Max-Age/i.test(cookie));
check('**Cookie に Expires を付けない**（同上）', !/Expires/i.test(cookie));
check('閉じるときの Cookie は Max-Age=0 で消す', /Max-Age=0/.test(clearResultCookie()));

// ── Cookie の読み取り ──
eq('Cookie ヘッダから値を取れる', readResultCookie(`a=1; ${RESULT_COOKIE}=xyz; b=2`), 'xyz');
eq('前後に空白があっても取れる', readResultCookie(` ${RESULT_COOKIE} = xyz `), 'xyz');
eq('似た名前のCookieを誤って拾わない', readResultCookie('xrs=zzz; rs_other=yyy'), null);
eq('ヘッダが無ければ null', readResultCookie(null), null);
eq('空の値は null 扱い', readResultCookie(`${RESULT_COOKIE}=`), null);

// ── トークン ──
const a = randomToken(), b = randomToken();
check('トークンは64桁の16進（32バイト）', /^[0-9a-f]{64}$/.test(a));
check('毎回違う値になる', a !== b);

// ── 既定値 ──
eq('既定の有効期限は無操作30分・発行から2時間', DEFAULT_LIMITS, { idleMinutes: 30, maxHours: 2 });

console.log(`結果セッションの試験: ${pass} 件通過`);
if (fails.length) {
  console.error(`\n失敗 ${fails.length} 件:`);
  fails.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log('  → F4（ワンタイム表示・デバイス束縛）の判定は仕様どおり');
