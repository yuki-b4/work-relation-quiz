/**
 * Admin のパスワードを作り直すためのハッシュを作る（アプリ化要件定義.md F2-1）。
 *
 *   node tools/admin-password.mjs                     # パスワードも自動で作る
 *   node tools/admin-password.mjs 'ここに新しいパスワード'
 *
 * **1アカウント運用なので、パスワードを忘れると誰も入れなくなる。** その復旧手段がこれ。
 * 出てくる UPDATE 文を wrangler で流すと、そのアカウントのパスワードが入れ替わり、
 * ロックも解除される。手順は app/README.md の「パスワードを忘れた・変えたいとき」。
 *
 * このスクリプトは**DBには触らない**。作るのはハッシュとSQLの文字列だけなので、
 * 手元でもクラウドのセッションでも動く。
 */
import { hashPassword, PBKDF2_ITERATIONS } from '../src/lib/password.ts';

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 24文字のパスワードを作る。人が読み書きしない前提なので、紛らわしい字だけ抜いてある。 */
function generate(length = 24) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const given = process.argv[2];
const password = given ?? generate();

if (given && given.length < 12) {
  console.error('パスワードが短すぎます。12文字以上にしてください。');
  process.exit(1);
}

const hash = await hashPassword(password);

console.log('=== 新しいパスワード ===');
console.log(password);
console.log('');
console.log(given
  ? '  （引数で渡した値です）'
  : '  自動生成しました。**パスワードマネージャに保存してから**次へ進んでください（F2-1）。');
console.log('');
console.log(`=== ハッシュ（PBKDF2-HMAC-SHA256・${PBKDF2_ITERATIONS.toLocaleString()}回） ===`);
console.log(hash);
console.log('');
console.log('=== 流すSQL（メールアドレスを自分のものに直す） ===');
console.log(`UPDATE admin_users SET password_hash = '${hash}', failed_count = 0, locked_until = NULL, disabled_at = NULL WHERE lower(email) = lower('you@example.com');`);
console.log('');
console.log('  ローカル : npx wrangler d1 execute nature-shindan --local  --command "…"');
console.log('  本番     : npx wrangler d1 execute nature-shindan --remote --command "…"');
console.log('');
console.log('入れ替えたあと、開いているログインセッションも切るなら：');
console.log(`UPDATE admin_sessions SET revoked_at = '${new Date().toISOString()}' WHERE revoked_at IS NULL;`);
