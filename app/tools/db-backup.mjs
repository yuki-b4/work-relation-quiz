/**
 * 本番D1のバックアップを取る（アプリ化要件定義.md 6.3・D-3）。
 *
 *   npm run db:backup            … スキーマとデータをまとめて1本のSQLに書き出す
 *   npm run db:backup -- --schema-only
 *
 * Cloudflare の Time Travel は**過去30日まで巻き戻せる**が、それは Cloudflare の中の話で、
 * 手元には何も残らない。アカウントごと失う事故（請求の停止・誤削除）には効かない。
 * だから **Cloudflare の外に置いた1本のファイル**を、別に持っておく。
 *
 * 書き出し先は backups/ で、.gitignore に入れてある。**リポジトリに入れない**
 * （回答本文・氏名・メールが入るので、公開リポジトリに置いた時点で漏洩になる）。
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const schemaOnly = args.includes('--schema-only');
const db = 'nature-shindan';

// ファイル名は日時を入れる。上書きにすると、壊れたデータで上書きしたときに戻れない。
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = resolve(import.meta.dirname, '..', 'backups');
const out = resolve(dir, `${db}-${stamp}${schemaOnly ? '-schema' : ''}.sql`);
mkdirSync(dir, { recursive: true });

const cmd = [
  'wrangler', 'd1', 'export', db, '--remote', `--output=${out}`,
  ...(schemaOnly ? ['--no-data'] : []),
];
console.log(`$ npx ${cmd.join(' ')}`);
execFileSync('npx', cmd, { stdio: 'inherit' });

const size = statSync(out).size;
console.log(`\n書き出しました：${out}（${(size / 1024).toFixed(1)} KB）`);
if (size < 1024) {
  console.log('⚠ 中身が小さすぎます。エクスポートが空でないか、開いて確かめてください。');
}
console.log('\nこのファイルは Cloudflare の外に置いてください（リポジトリには入れません）。');
console.log('戻し方は app/README.md の「壊したときに戻す」にあります。');
