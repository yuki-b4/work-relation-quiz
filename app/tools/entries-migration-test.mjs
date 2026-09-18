/**
 * 申込の入口（migrations/0007_entries.sql と、それを読む Admin の問い合わせ）の試験。
 *
 * 0007 より前のマイグレーションは、ディレクトリから拾って全部当てる。
 *
 *   node --experimental-strip-types tools/entries-migration-test.mjs
 *
 * node:sqlite に 0001〜0004 をそのまま流して、本物のスキーマで確かめる。
 * 見どころは4つ。どれも間違えると、本番に当ててから気づくことになる。
 *   ・**既存の申込が全部残り、正しい入口に寄る**（作り直しなので、ここを落とすと復旧できない）
 *   ・**既存の紐づけ（apply_visit_id / response_id）が保たれる**
 *   ・entry_id の NOT NULL と外部キーが実際に効く
 *   ・guide や direct の入口にセミナー情報を付けられない（複合外部キー）
 *
 * あわせて「apply_visits を同じやり方で作り直すと紐づけが壊れる」ことも実演する。
 * 0004 が session_applications だけを作り直している理由がこれ。
 */
import { DatabaseSync } from 'node:sqlite';
import { listEntries, loadEntry } from '../src/lib/admin-queries.ts';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const sql = (f) => readFileSync(join(MIGRATIONS, f), 'utf8');

/** 試す対象と、その前に当たるもの。 */
const SUBJECT = '0007_entries.sql';
const BEFORE = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && f < SUBJECT).sort();

let pass = 0;
const fails = [];
const check = (label, cond) => { if (cond) pass++; else fails.push(label); };

/** 0001〜0003 を当て、標本データを入れた状態のDBを作る。外部キーは有効のまま。 */
function seeded() {
  const db = new DatabaseSync(':memory:');
  // **0007 より前を全部当ててから試す。** 決め打ちで並べると、あいだに
  // マイグレーションが増えたとき（0004〜0006 がそうだった）に本番と違う順序を試すことになる。
  for (const f of BEFORE) db.exec(sql(f));
  db.exec('pragma foreign_keys = on');
  db.exec(`
    insert into responses (id, created_at, question_set_version, type_code, type_name, axis_h, axis_c, axis_w)
      values ('resp_A','2026-09-01T00:00:00.000Z','2026-09','OBL','突撃隊長','O','B','L'),
             ('resp_B','2026-09-02T00:00:00.000Z','2026-09','GKS','がんばり屋の調整役','G','K','S');
    insert into apply_visits (id, response_id, visited_at, cta)
      values ('visit_1','resp_A','2026-09-01T01:00:00.000Z','epilogue-1');
    insert into session_applications
      (id, created_at, apply_visit_id, response_id, type_code, name, email, source)
      values ('app_guide','2026-09-01T02:00:00.000Z','visit_1','resp_A','OBL','山田','a@example.com','in-app'),
             ('app_cold', '2026-09-03T02:00:00.000Z',null,     null,    'GKS','佐藤','b@example.com','in-app'),
             ('app_gform','2026-07-01T02:00:00.000Z',null,     'resp_B','GKS','鈴木','c@example.com','google-form-import');
  `);
  return db;
}

const db = seeded();
// **外部キーを有効にしたまま**当てられることも、この試験の確認事項のひとつ。
db.exec(sql(SUBJECT));

const all = (s) => db.prepare(s).all();
const one = (s) => db.prepare(s).get();
const cols = (t) => all(`select name from pragma_table_info('${t}')`).map((r) => r.name);
const throws = (s) => { try { db.exec(s); return false; } catch { return true; } };

// ───────── 種類固有の列が entries に残っていない（横持ちにしない） ─────────
for (const c of ['held_on', 'venue', 'audience_count']) {
  check(`entries に ${c} が無い（entry_seminars 側にある）`, !cols('entries').includes(c));
}
check('entries の上書き用の列は残っている',
  ['headline', 'intro', 'session_label', 'fields_json'].every((c) => cols('entries').includes(c)));
check('guide 行は種類固有の列を持たないので NULL にならない',
  Object.values(one(`select id, slug, kind, name, system, active, created_at
                       from entries where id = 'entry_guide'`)).every((v) => v !== null));

// ───────── 移行：件数・入口の割り当て・紐づけの保全 ─────────
const apps = Object.fromEntries(
  all(`select id, entry_id, apply_visit_id, response_id from session_applications`).map((r) => [r.id, r])
);
check('既存の申込が3件とも残る', Object.keys(apps).length === 3);
check('到達IDを持つ申込 → guide', apps.app_guide.entry_id === 'entry_guide');
check('Googleフォーム移行分 → guide', apps.app_gform.entry_id === 'entry_guide');
check('入口が分からない申込 → direct', apps.app_cold.entry_id === 'entry_direct');
check('到達IDの紐づけが保たれる', apps.app_guide.apply_visit_id === 'visit_1');
check('回答の紐づけが保たれる', apps.app_guide.response_id === 'resp_A');
check('apply_visits は作り直していない', !cols('apply_visits').includes('entry_id'));

// ───────── entry_id の NOT NULL と外部キー ─────────
const insertApp = (entryId) =>
  `insert into session_applications (id, created_at, entry_id, name, email)
     values ('t${Math.random().toString(36).slice(2)}','2026-09-17T00:00:00.000Z',${entryId},'テ','t@example.com')`;
check('entry_id に NULL を入れられない', throws(insertApp('null')));
check('存在しない entry_id を入れられない', throws(insertApp(`'entry_nope'`)));
check('正しい entry_id なら入る', !throws(insertApp(`'entry_guide'`)));
check('entry_id を渡さない既存コードの insert は guide になる（既定値）', (() => {
  db.exec(`insert into session_applications (id, created_at, name, email)
             values ('app_legacy','2026-09-17T00:00:00.000Z','旧','legacy@example.com')`);
  return one(`select entry_id from session_applications where id='app_legacy'`).entry_id === 'entry_guide';
})());

// ───────── セミナーの入口を足す ─────────
db.exec(`
  insert into entries (id, slug, kind, name, headline, session_label, fields_json, created_at)
    values ('entry_sem1','sem-0928','seminar','9/28 関係性セミナー',
            '体験セッション（60分・無料）','60分','["role","team_size"]','2026-09-17T00:00:00.000Z');
  insert into entry_seminars (entry_id, held_on, venue, audience_count)
    values ('entry_sem1','2026-09-28','渋谷 会議室A',34);
  insert into session_applications (id, created_at, entry_id, type_code, name, email, custom_answers)
    values ('app_sem','2026-09-28T10:00:00.000Z','entry_sem1','OBL','高橋','d@example.com','{"role":"店長"}');
`);
check('セミナーの入口と付帯情報が入る', one(`select held_on from entry_seminars where entry_id='entry_sem1'`).held_on === '2026-09-28');
check('セミナー経由の申込が入る', one(`select entry_id from session_applications where id='app_sem'`).entry_id === 'entry_sem1');

// ───────── 複合外部キー：種類違いを弾く ─────────
check('guide の入口にセミナー情報を付けられない',
  throws(`insert into entry_seminars (entry_id, held_on) values ('entry_guide','2026-09-28')`));
check('direct の入口にも付けられない',
  throws(`insert into entry_seminars (entry_id, held_on) values ('entry_direct','2026-09-28')`));
check('kind を偽っても弾かれる',
  throws(`insert into entry_seminars (entry_id, kind, held_on) values ('entry_guide','guide','2026-09-28')`));
check('held_on は NOT NULL',
  throws(`insert into entry_seminars (entry_id, held_on) values ('entry_sem1', null)`));
check('1つの入口に付帯情報は1行まで',
  throws(`insert into entry_seminars (entry_id, held_on) values ('entry_sem1','2026-10-01')`));
check('入口を消すと付帯情報も消える（cascade）', (() => {
  db.exec(`insert into entries (id,slug,kind,name,created_at)
             values ('entry_tmp','tmp','seminar','一時','2026-09-17T00:00:00.000Z');
           insert into entry_seminars (entry_id, held_on) values ('entry_tmp','2026-10-05');
           delete from entries where id='entry_tmp'`);
  return one(`select count(*) n from entry_seminars where entry_id='entry_tmp'`).n === 0;
})());

// ───────── 回答を物理削除しても申込は残る（admin.ts の purge） ─────────
db.exec(`update session_applications set response_id = null, apply_visit_id = null where response_id = 'resp_A';
         delete from responses where id = 'resp_A'`);
check('回答を物理削除しても申込は残る', one(`select count(*) n from session_applications where id='app_guide'`).n === 1);
check('回答を物理削除しても入口は残る', one(`select entry_id from session_applications where id='app_guide'`).entry_id === 'entry_guide');

// ───────── 入口別のファネルが1クエリで出る ─────────
const funnel = all(`
  select e.slug, e.kind, es.held_on, es.audience_count,
         count(sa.id) as applications,
         sum(case when sa.status = '成約' then 1 else 0 end) as closed
    from entries e
    left join entry_seminars es on es.entry_id = e.id
    left join session_applications sa on sa.entry_id = e.id and sa.deleted_at is null
   group by e.id order by e.slug`);
check('入口別のファネルが1クエリで出る', funnel.length === 3 && funnel.some((r) => r.slug === 'sem-0928'));

// ───────── なぜ apply_visits を作り直さないのか（実演） ─────────
// 0004 と同じやり方で apply_visits に列を足すと、DROP の暗黙 DELETE が
// session_applications.apply_visit_id の ON DELETE SET NULL を撃つ。
{
  const rebuild = `
    create table entries2 (id text primary key, created_at text not null);
    insert into entries2 values ('entry_guide','2026-09-17T00:00:00.000Z');
    create table apply_visits_new (
      id text primary key,
      response_id text not null references responses(id) on delete cascade,
      entry_id text not null references entries2(id),
      visited_at text not null, cta text not null);
    insert into apply_visits_new select id, response_id, 'entry_guide', visited_at, cta from apply_visits;
    drop table apply_visits;
    alter table apply_visits_new rename to apply_visits;`;
  const link = (d) => d.prepare(`select apply_visit_id from session_applications where id='app_guide'`).get().apply_visit_id;

  const onDb = seeded();
  onDb.exec(rebuild);
  check('【実演】FK 有効のまま apply_visits を作り直すと紐づけが NULL に化ける', link(onDb) === null);
  onDb.close();

  // defer_foreign_keys は違反検査を遅らせるだけで、ON DELETE 動作は止めない。
  const deferDb = seeded();
  deferDb.exec('begin; pragma defer_foreign_keys = true;');
  deferDb.exec(rebuild);
  deferDb.exec('commit');
  check('【実演】defer_foreign_keys でも防げない', link(deferDb) === null);
  deferDb.close();
}

// ───────── Admin の問い合わせ（lib/admin-queries.ts） ─────────
// 本物の SQL を本物のスキーマに当てる。node:sqlite を D1 の形に被せて呼ぶ。
/** D1（prepare→bind→all/first/run と batch）を node:sqlite で満たす最小の被せもの。 */
function asD1(sqlite) {
  const prepare = (sql) => {
    let params = [];
    const stmt = {
      bind: (...a) => { params = a; return stmt; },
      all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
      first: async () => sqlite.prepare(sql).get(...params) ?? null,
      run: async () => { sqlite.prepare(sql).run(...params); return {}; },
    };
    return stmt;
  };
  return { prepare, batch: async (stmts) => Promise.all(stmts.map((x) => x.run())) };
}

{
  const d1 = asD1(db);

  // Admin の「セミナーを追加する」と同じ形（entries と entry_seminars を必ず同時に入れる）。
  await d1.batch([
    d1.prepare(`insert into entries (id, slug, kind, name, system, active, created_at)
                values (?,?,'seminar',?,0,1,?)`)
      .bind('entry_sem2', 'sem-1012', '10/12 関係性セミナー', '2026-09-20T00:00:00.000Z'),
    d1.prepare(`insert into entry_seminars (entry_id, held_on, venue, audience_count) values (?,?,?,?)`)
      .bind('entry_sem2', '2026-10-12', '梅田 セミナールーム', 20),
  ]);
  check('batch でセミナーの入口を追加できる（Adminの追加と同じ形）',
    one(`select count(*) n from entry_seminars where entry_id='entry_sem2'`).n === 1);

  const rows = await listEntries(d1);
  const bySlug = Object.fromEntries(rows.map((r) => [r.slug, r]));
  check('一覧に全ての入口が出る', rows.length === 4);
  check('既定の2行が先頭に並ぶ', rows[0].system === 1 && rows[1].system === 1);
  check('セミナーは開催日の新しい順', rows[2].slug === 'sem-1012' && rows[3].slug === 'sem-0928');
  check('セミナーに付帯情報が結合される',
    bySlug['sem-0928'].held_on === '2026-09-28' && bySlug['sem-0928'].audience_count === 34);
  check('既定の入口に付帯情報は付かない', bySlug.guide.held_on === null && bySlug.guide.audience_count === null);
  check('入口ごとの申込数が出る', bySlug['sem-0928'].application_count === 1 && bySlug['sem-1012'].application_count === 0);
  check('既定の入口の申込数も出る', bySlug.guide.application_count >= 1);
  check('成約数は status で数える', bySlug['sem-0928'].closed_count === 0);
  check('上書き用の文面が読める',
    bySlug['sem-0928'].session_label === '60分' && bySlug['sem-0928'].fields_json === '["role","team_size"]');

  // 成約を1件入れたら成約数が動く（申込率・成約率の分子）。
  db.exec(`update session_applications set status = '成約' where id = 'app_sem'`);
  check('成約に変えると成約数が増える', (await listEntries(d1)).find((r) => r.slug === 'sem-0928').closed_count === 1);

  const one_ = await loadEntry(d1, 'entry_sem1');
  check('1件読みでも付帯情報と実績が揃う',
    one_ !== null && one_.slug === 'sem-0928' && one_.held_on === '2026-09-28' && one_.closed_count === 1);
  check('存在しないIDは null', (await loadEntry(d1, 'entry_nope')) === null);
}

console.log(`申込の入口（${SUBJECT}）の試験: ${pass} 件通過`);
if (fails.length) {
  console.error(`\n失敗 ${fails.length} 件:`);
  fails.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log('  → 移行の保全・entry_id の NOT NULL・種類の制約・Admin の読み取りは仕様どおり');
