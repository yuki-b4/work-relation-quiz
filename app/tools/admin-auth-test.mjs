/**
 * Admin の認証と表示ヘルパの試験（アプリ化要件定義.md F2-1・F2-2・6.2・F2-7）。
 *
 *   node --experimental-strip-types tools/admin-auth-test.mjs
 *
 * DBに触らない部分（パスワードの照合・セッションの判定・ロック・マスク・CSV）だけを見る。
 * ここが崩れると、ログインが素通りする／個人情報が一覧に出る／CSVがExcelで化ける、が静かに起きる。
 */
import {
  hashPassword, verifyPassword, needsRehash, timingSafeEqual, timingSafeEqualStr, PBKDF2_ITERATIONS,
} from '../src/lib/password.ts';
import {
  evaluateAdminSession, isLocked, nextFailureState, buildAdminCookie, clearAdminCookie,
  readAdminCookie, ADMIN_COOKIE, ADMIN_IDLE_MINUTES, MAX_FAILED,
} from '../src/lib/admin-auth.ts';
import {
  jst, jstFull, jstDayStart, jstDayEnd, maskName, maskEmail, duration, jsonArray, guideReach, pct,
} from '../src/lib/admin-format.ts';
import { csvCell, csvRow, toCsv } from '../src/lib/csv.ts';
import { makeReferrerCode } from '../src/lib/admin-queries.ts';
import { viewAnswers, questionSetOf, CURRENT_SET } from '../src/lib/question-archive.ts';
import { notifyConfigured } from '../src/lib/notify.ts';

let pass = 0;
const fails = [];
const check = (label, cond) => { if (cond) pass++; else fails.push(label); };
const eq = (label, a, b) =>
  check(`${label}（期待 ${JSON.stringify(b)}、実際 ${JSON.stringify(a)}）`, JSON.stringify(a) === JSON.stringify(b));

// ───────── パスワード（F2-1） ─────────
{
  // 試験は速さを優先して回数を落とす。本番の既定値は別に確かめる。
  const stored = await hashPassword('correct horse battery staple', 1000);
  check('正しいパスワードが通る', await verifyPassword('correct horse battery staple', stored));
  check('違うパスワードは通らない', !(await verifyPassword('correct horse battery stapl', stored)));
  check('空文字は通らない', !(await verifyPassword('', stored)));
  eq('保存形式は自己記述', stored.split('$').slice(0, 2), ['pbkdf2-sha256', '1000']);

  const again = await hashPassword('correct horse battery staple', 1000);
  check('同じパスワードでもソルトが違うので別のハッシュになる', again !== stored);
  check('別ソルトのハッシュでも照合できる', await verifyPassword('correct horse battery staple', again));

  check('壊れた保存値は false（例外にしない）', !(await verifyPassword('x', 'not-a-hash')));
  check('別アルゴリズムの保存値は false', !(await verifyPassword('x', '$2b$12$abcdefghijklmnopqrstuv')));
  check('回数が異常な保存値は false', !(await verifyPassword('x', 'pbkdf2-sha256$1$AAAA$AAAA')));

  check('回数が低いハッシュは入れ直しの対象', needsRehash(stored));
  check('いまの回数なら入れ直さない', !needsRehash(await hashPassword('pw', PBKDF2_ITERATIONS)));
  check('推奨回数はOWASPの60万回', PBKDF2_ITERATIONS === 600_000);

  const enc = new TextEncoder();
  check('定数時間比較：同じ', timingSafeEqual(enc.encode('abc'), enc.encode('abc')));
  check('定数時間比較：長さ違い', !timingSafeEqual(enc.encode('abc'), enc.encode('abcd')));
  check('定数時間比較（文字列）', timingSafeEqualStr('tok', 'tok') && !timingSafeEqualStr('tok', 'tol'));
}

// ───────── ログインセッション（F2-1） ─────────
{
  const T0 = '2026-09-05T10:00:00.000Z';
  const row = (o = {}) => ({
    id: 's1', user_id: 'u1', created_at: T0, last_seen_at: T0,
    revoked_at: null, csrf_token: 'csrf-1', email: 'a@example.com', disabled_at: null, ...o,
  });
  eq('通常は通る', evaluateAdminSession(row(), T0).ok, true);
  eq('CSRFトークンを返す', evaluateAdminSession(row(), T0).csrf, 'csrf-1');
  eq('行が無ければ not_found', evaluateAdminSession(null, T0).reason, 'not_found');
  eq('ログアウト済みは revoked', evaluateAdminSession(row({ revoked_at: T0 }), T0).reason, 'revoked');
  eq('停止したアカウントは disabled', evaluateAdminSession(row({ disabled_at: T0 }), T0).reason, 'disabled');

  const t29 = new Date(Date.parse(T0) + 29 * 60_000).toISOString();
  const t30 = new Date(Date.parse(T0) + 30 * 60_000).toISOString();
  eq('29分後は通る', evaluateAdminSession(row(), t29).ok, true);
  eq('ちょうど30分で切れる', evaluateAdminSession(row(), t30).reason, 'idle_timeout');
  eq('無操作の上限は30分', ADMIN_IDLE_MINUTES, 30);
}

// ───────── ロック（F2-1） ─────────
{
  const T0 = '2026-09-05T10:00:00.000Z';
  eq('5回でロックする', MAX_FAILED, 5);
  for (let i = 0; i < MAX_FAILED - 1; i++) {
    eq(`${i + 1}回目まではロックしない`, nextFailureState(i, T0).lockedUntil, null);
  }
  const locked = nextFailureState(MAX_FAILED - 1, T0);
  eq('5回目でカウンタが5', locked.failedCount, 5);
  check('5回目でロック時刻が入る', typeof locked.lockedUntil === 'string');
  check('ロック中は弾く', isLocked({ locked_until: locked.lockedUntil }, T0));
  check('ロックが明ければ通る', !isLocked({ locked_until: locked.lockedUntil }, '2026-09-05T11:00:00.000Z'));
  check('ロック無しは通る', !isLocked({ locked_until: null }, T0));
}

// ───────── Cookie（6.1） ─────────
{
  const c = buildAdminCookie('abc');
  check('HttpOnly', c.includes('HttpOnly'));
  check('Secure', c.includes('Secure'));
  check('SameSite=Strict（Admin は外部リンクから入らない）', c.includes('SameSite=Strict'));
  check('Path は /admin に閉じる', c.includes('Path=/admin'));
  check('有効期限を持たせない（ブラウザを閉じたら消える）', !/Max-Age|Expires/.test(c));
  check('消すときだけ Max-Age=0', clearAdminCookie().includes('Max-Age=0'));
  eq('Cookieを読める', readAdminCookie(`x=1; ${ADMIN_COOKIE}=tok; y=2`), 'tok');
  eq('無ければ null', readAdminCookie('x=1'), null);
  eq('結果セッションのCookie（rs）と取り違えない', readAdminCookie('rs=other'), null);
}

// ───────── 表示ヘルパ（6.2・7.3） ─────────
{
  eq('UTC→JSTで9時間進む', jst('2026-09-05T01:23:45.000Z'), '2026-09-05 10:23');
  eq('日をまたぐ', jst('2026-09-04T15:00:00.000Z'), '2026-09-05 00:00');
  eq('秒まで', jstFull('2026-09-05T01:23:45.000Z'), '2026-09-05 10:23:45');
  eq('空は —', jst(null), '—');
  eq('CSVでは空文字', jstFull(null), '');
  eq('JSTの日の始まり', jstDayStart('2026-09-05'), '2026-09-04T15:00:00.000Z');
  eq('JSTの日の終わり（翌日の0時）', jstDayEnd('2026-09-05'), '2026-09-05T15:00:00.000Z');
  eq('壊れた日付は null', jstDayStart('2026-9-5'), null);

  eq('氏名は先頭1文字だけ残す', maskName('山田太郎'), '山◯◯◯');
  eq('長い氏名でも伏せ字は3つまで', maskName('山田太郎四郎'), '山◯◯◯');
  eq('1文字の氏名', maskName('田'), '田◯');
  eq('空の氏名', maskName(''), '—');
  eq('メールはローカル部の頭2文字だけ', maskEmail('taro@example.com'), 'ta**@example.com');
  eq('短いローカル部', maskEmail('a@example.com'), 'a*@example.com');
  eq('@が無ければ全部伏せる', maskEmail('broken'), '***');

  eq('所要時間', duration('2026-09-05T10:00:00.000Z', '2026-09-05T10:02:07.000Z'), '2分07秒');
  eq('1分未満', duration('2026-09-05T10:00:00.000Z', '2026-09-05T10:00:42.000Z'), '42秒');
  eq('片方が無ければ —', duration(null, '2026-09-05T10:00:00.000Z'), '—');

  eq('JSON配列を読む', jsonArray('["A","B"]'), ['A', 'B']);
  eq('「、」連結でも壊れない（移行データの保険）', jsonArray('人が辞める、育たない'), ['人が辞める', '育たない']);
  eq('空は空配列', jsonArray(null), []);

  eq('ガイド未開封', guideReach(null, null, null), '未');
  eq('終章まで', guideReach('t', 3, 't'), '終章');
  eq('第一章まで', guideReach('t', 1, null), '第一章');
  eq('％表示', pct(0.667), '66.7%');
}

// ───────── CSV（F2-7） ─────────
{
  eq('普通の値', csvCell('あいう'), 'あいう');
  eq('カンマは引用する', csvCell('a,b'), '"a,b"');
  eq('引用符は二重にする', csvCell('a"b'), '"a""b"');
  eq('改行は引用する', csvCell('a\nb'), '"a\nb"');
  eq('null は空', csvCell(null), '');
  eq('= で始まる値は数式にしない', csvCell('=1+1'), "'=1+1");
  eq('+ で始まる値も', csvCell('+81 90'), "'+81 90");
  eq('- で始まる値も', csvCell('-5'), "'-5");
  eq('@ で始まる値も', csvCell('@user'), "'@user");
  eq('行の連結', csvRow(['a', 'b,c']), 'a,"b,c"');

  const csv = toCsv(['名前', '値'], [['太郎', 1]]);
  check('先頭にBOMが付く（Excelでの文字化け防止）', csv.charCodeAt(0) === 0xfeff);
  check('改行はCRLF', csv.includes('\r\n'));
  eq('中身', csv.slice(1), '名前,値\r\n太郎,1\r\n');
}

// ───────── 紹介者コード（F2-6） ─────────
{
  const code = makeReferrerCode('tk');
  check('イニシャルは英大文字2文字', /^[A-Z]{2}/.test(code));
  eq('全体で7文字', code.length, 7);
  check('ランダム部は英小文字と数字', /^[A-Z]{2}[a-z0-9]{5}$/.test(code));
  check('紛らわしい字（0 O 1 l i）を使わない', !/[01ilo]/.test(code.slice(2)));
  eq('イニシャルが無ければ XX', makeReferrerCode('').slice(0, 2), 'XX');
  eq('英字以外は落とす', makeReferrerCode('田中tk').slice(0, 2), 'TK');
  check('毎回違う値になる', makeReferrerCode('TK') !== makeReferrerCode('TK'));
}

// ───────── 設問文の引き当て（F2-3） ─────────
{
  const V = '2026-09';
  check('同じ版なら現行の設問セットを返す', questionSetOf(V, V) === CURRENT_SET);
  eq('移行データ（legacy）の設問文は持っていない', questionSetOf('legacy', V), null);
  eq('知らない版も null', questionSetOf('2030-01', V), null);

  const rows = [
    { order_no: 1, question_key: 'bin-1', kind: 'bin', axis: 'h', value: 'O' },
    { order_no: 10, question_key: 'lik-1', kind: 'lik', axis: 'safety', value: '3' },
  ];
  const withText = viewAnswers(rows, CURRENT_SET);
  check('二択の設問文が出る', withText[0].text === CURRENT_SET.binary[0].text);
  check('選んだ側の選択肢が出る', withText[0].answerText === CURRENT_SET.binary[0].a.t);
  eq('3軸の軸名', withText[0].axisLabel, '本音（3軸）');
  check('リッカートの設問文が出る', withText[1].text === CURRENT_SET.likert[0].text);
  eq('リッカートの回答は言葉と数字', withText[1].answerText, 'ややそう思う（3）');
  eq('5軸の軸名', withText[1].axisLabel, '本音（5軸）');

  const noText = viewAnswers(rows, null);
  eq('版が分からなければ設問文を出さない', [noText[0].text, noText[0].answerText], [null, null]);
  eq('それでも行は落とさない', noText.length, 2);
  eq('識別子と値は残る', [noText[0].key, noText[0].value], ['bin-1', 'O']);
}

// ───────── ログイン通知（F2-1） ─────────
{
  check('未設定なら通知は無効', !notifyConfigured({}));
  check('Webhookだけで有効', notifyConfigured({ LOGIN_NOTIFY_WEBHOOK: 'https://example.com/hook' }));
  check('Resendは3点そろって有効',
    notifyConfigured({ RESEND_API_KEY: 'k', LOGIN_NOTIFY_TO: 'a@b.c', LOGIN_NOTIFY_FROM: 'x@y.z' }));
  check('Resendが欠けていれば無効', !notifyConfigured({ RESEND_API_KEY: 'k', LOGIN_NOTIFY_TO: 'a@b.c' }));
}

if (fails.length) {
  console.log(`\nAdmin の試験：失敗 ${fails.length} 件`);
  for (const f of fails) console.log('  NG:', f);
  process.exit(1);
}
console.log(`Admin の試験: ${pass} 件通過`);
console.log('  → 認証・セッション・マスク・CSV・設問文の引き当ては仕様どおり');
