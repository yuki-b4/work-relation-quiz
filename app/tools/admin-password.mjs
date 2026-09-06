/**
 * Admin のパスワードを作り直す（アプリ化要件定義.md F2-1）。
 *
 *   npm run admin:password -- --email you@example.com
 *   npm run admin:password -- --email you@example.com --password '自分で決めた長いパスワード'
 *
 * **1アカウント運用なので、パスワードを忘れると誰も入れなくなる。** その復旧手段がこれ。
 * 新しいパスワードと、それを流すための **SQLファイル** を書き出す。
 *
 * このスクリプトは**DBには触らない**。作るのはハッシュとSQLファイルだけなので、
 * 手元でもクラウドのセッションでも動く。
 *
 * **なぜ --command でなくファイルなのか**：ハッシュは `$` を3つ含む
 * （`pbkdf2-sha256$100000$ソルト$ハッシュ`）。これを
 * `wrangler d1 execute --command "…"` のダブルクォートに入れると、**シェルが `$` を
 * 変数として展開して値が壊れる**（`$100000` → `00000` など）。壊れたまま保存されても
 * エラーにはならず、「パスワードが違います」としか出ないので原因に辿りつけない。
 * クォート付きのヒアドキュメントか、このファイル経由なら展開されない。
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hashPassword, PBKDF2_ITERATIONS } from '../src/lib/password.ts';

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const OUT = 'admin-password.sql';

/** 24文字のパスワードを作る。人が読み書きしない前提なので、紛らわしい字だけ抜いてある。 */
function generate(length = 24) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
// 位置引数でもパスワードを渡せる（以前の使い方との互換）。
const positional = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1]?.startsWith('--') !== true);

const password = flag('password') ?? positional ?? generate();
const email = flag('email');

if (password.length < 12) {
  console.error('パスワードが短すぎます。12文字以上にしてください。');
  process.exit(1);
}

const hash = await hashPassword(password);
const target = email ?? 'you@example.com';
const sql = [
  '-- ナチュール診断 Admin のパスワード再設定（アプリ化要件定義.md F2-1）',
  `-- 生成 ${new Date().toISOString()}`,
  '-- 流し終えたらこのファイルは消すこと。',
  '',
  `UPDATE admin_users SET password_hash = '${hash}',`,
  '       failed_count = 0, locked_until = NULL, disabled_at = NULL',
  ` WHERE lower(email) = lower('${target}');`,
  '',
].join('\n');

writeFileSync(resolve(OUT), sql, 'utf8');

console.log('=== 新しいパスワード ===');
console.log(password);
console.log('');
console.log(flag('password') || positional
  ? '  （指定された値です）'
  : '  自動生成しました。**先にパスワードマネージャへ保存してから**次へ進んでください（F2-1）。');
console.log('');
console.log(`=== 書き出したSQL（${OUT}）===`);
console.log(sql.split('\n').filter((l) => l && !l.startsWith('--')).join('\n'));
console.log('');

if (!email) {
  console.log('⚠ メールアドレスが未指定なので you@example.com のままです。');
  console.log(`  ${OUT} を開いて自分のアドレスに直すか、--email を付けて実行し直してください。`);
  console.log('');
}

console.log('=== 流す ===');
console.log(`  本番     : npx wrangler d1 execute nature-shindan --remote --file=${OUT}`);
console.log(`  ローカル : npx wrangler d1 execute nature-shindan --local  --file=${OUT}`);
console.log('');
console.log('  **--command には貼らないこと。** ハッシュに $ が入っているので、シェルが');
console.log('  変数として展開して値が壊れる。壊れても保存は成功し、「パスワードが違います」');
console.log('  としか出ないので原因が分からなくなる。');
console.log('');
console.log('=== 入ったか確かめる（$ を含まないので --command でよい）===');
console.log('  npx wrangler d1 execute nature-shindan --remote \\');
console.log('    --command "select substr(password_hash,1,21) as head from admin_users"');
console.log(`  → pbkdf2-sha256$${PBKDF2_ITERATIONS}$ と出れば正しい`);
console.log('');
console.log(`確認できたら ${OUT} を消す（rm ${OUT}）。`);
console.log('');
console.log('開いているログインセッションも切るなら：');
console.log(`  npx wrangler d1 execute nature-shindan --remote --command "update admin_sessions set revoked_at = '${new Date().toISOString()}' where revoked_at is null"`);
