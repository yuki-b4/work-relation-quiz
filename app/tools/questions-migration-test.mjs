/**
 * 申込フォームの設問マスタ（migrations/0008_questions.sql・0009_drop_legacy_columns.sql と lib/questions.ts）の試験。
 *
 *   node --experimental-strip-types tools/questions-migration-test.mjs
 *
 * node:sqlite に 0001〜0007 をそのまま流し、旧形式のデータを入れてから 0008 を当てる。
 * 見どころは5つ。どれも間違えると、本番に当ててから気づくことになる。
 *   ・**既存の回答が1件も落ちずに写る**（気になっていること・ご質問・追加項目。壊れた JSON があっても止まらない）
 *   ・今の画面が変わらない（guide と既存のセミナーに「人間関係の設問」が付く。帯は長さの表記から組む）
 *   ・**古いコードのまま動く**（0008 を当ててからデプロイするまでの間も申込は来る）
 *   ・写す部分を2回流しても増えない（0009 で流し直して、その間の申込を拾う）
 *   ・外部キー：申込を消せば回答も消え、回答のある設問は消せない
 *   ・0009：その間の申込を拾ってから旧列を消す。**行も回答も1件も消えない**（表を作り直さない）
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  answerRows, answersText, formQuestions, groupAnswers, loadQuestionAnswers, questionChoices, selectedQuestionIds,
} from '../src/lib/questions.ts';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const sql = (f) => readFileSync(join(MIGRATIONS, f), 'utf8');
const SUBJECT = '0008_questions.sql';
const DROP = '0009_drop_legacy_columns.sql';
const BEFORE = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && f < SUBJECT).sort();
/** 「既存の回答を写す」から後ろ。0009 で流し直す部分。 */
const COPY = sql(SUBJECT).split(/^-- 既存の回答を写す。.*$/m)[1];

let pass = 0;
const fails = [];
const check = (label, cond) => { if (cond) pass++; else fails.push(label); };

const db = new DatabaseSync(':memory:');
for (const f of BEFORE) db.exec(sql(f));
db.exec('pragma foreign_keys = on');
db.exec(`
  insert into entries (id, slug, kind, name, headline, session_label, fields_json, created_at) values
    ('entry_s1','sem-0928','seminar','9/28','見出し','45分','["役職"," 店舗の人数 "]','2026-09-17T00:00:00.000Z'),
    ('entry_s2','sem-1010','seminar','10/10',null,null,null,'2026-10-01T00:00:00.000Z'),
    ('entry_s3','sem-1020','seminar','10/20',null,'  ','not json','2026-10-02T00:00:00.000Z');
  insert into entry_seminars (entry_id, held_on) values
    ('entry_s1','2026-09-28'),('entry_s2','2026-10-10'),('entry_s3','2026-10-20');
  insert into session_applications
    (id, created_at, entry_id, name, email, concern, question, custom_answers, source) values
    ('app_g',   '2026-09-01T00:00:00.000Z','entry_guide','山田','a@example.com','任せ方','日程は？',null,'in-app'),
    ('app_s1',  '2026-09-28T00:00:00.000Z','entry_s1',   '高橋','b@example.com',null,'特に',
                '{"役職":"店長","店舗の人数":"12","消えたラベル":"x","空欄":"  "}','in-app'),
    ('app_bad', '2026-10-20T00:00:00.000Z','entry_s3',   '佐藤','c@example.com','   ',null,'{broken','in-app'),
    ('app_form','2026-07-01T00:00:00.000Z','entry_guide','鈴木','d@example.com','部下','',null,'google-form-import');
`);

db.exec(sql(SUBJECT));

const all = (s, ...p) => db.prepare(s).all(...p);
const one = (s, ...p) => db.prepare(s).get(...p);
const throws = (s) => { try { db.exec(s); return false; } catch { return true; } };
const answersOf = (id) => all(`select question_id, position, label, answer from question_answers
                                 where application_id = ? order by position`, id);

// ───────── 設問マスタ ─────────
const q = Object.fromEntries(all(`select * from questions`).map((r) => [r.id, r]));
check('人間関係の設問が入る', q.q_concern?.label === 'いま、人間関係で気になっていること');
check('人間関係の設問の注釈',
  q.q_concern?.hint === 'ひと言でも大丈夫です。書いていただけると、当日の読み解きが早く、深くなります。');
check('副業の設問（期間）が注釈なしで入る', q.q_side_since?.label === '副業を始めたいと思ってどのくらい経ちますか？' && q.q_side_since.hint === null);
check('副業の設問（悩み）が注釈なしで入る', q.q_side_worry?.label === '副業を始める上で悩んでいることを教えてください' && q.q_side_worry.hint === null);
check('ご質問は固定の設問', q.q_message?.label === 'ご質問・伝えておきたいこと' && q.q_message.fixed === 1);
check('固定はご質問だけ', all(`select id from questions where fixed = 1`).length === 1);
check('最初の4問はアーカイブされていない', ['q_concern', 'q_side_since', 'q_side_worry', 'q_message'].every((id) => q[id].archived === 0));
const legacy = all(`select label, archived from questions where id like 'q_legacy_%' order by label`);
check('旧形式の追加項目が設問になる（前後の空白は落とす）',
  JSON.stringify(legacy.map((r) => r.label)) === JSON.stringify(['店舗の人数', '役職', '消えたラベル', '空欄'].sort()));
check('旧形式の設問はアーカイブ（新しい入口の選択肢に出さない）', legacy.every((r) => r.archived === 1));

// ───────── 入口ごとの設問 ─────────
const eq = (entry) => all(`select question_id, position from entry_questions where entry_id = ? order by position`, entry)
  .map((r) => `${r.position}:${r.question_id}`).join(',');
const legacyId = (label) => one(`select id from questions where label = ?`, label).id;
check('guide には人間関係の設問', eq('entry_guide') === '1:q_concern');
check('direct には何も付けない（自分のページを持たない）', eq('entry_direct') === '');
check('既存のセミナーには人間関係の設問', eq('entry_s2') === '1:q_concern');
check('追加項目を持つセミナーは、その後ろに並び順のまま',
  eq('entry_s1') === `1:q_concern,2:${legacyId('役職')},3:${legacyId('店舗の人数')}`);
check('壊れた追加項目の入口でも止まらない', eq('entry_s3') === '1:q_concern');

// ───────── 見出しの帯 ─────────
const eyebrow = (id) => one(`select eyebrow from entries where id = ?`, id).eyebrow;
check('長さの表記から帯を組む', eyebrow('entry_s1') === '体験セッション（45分・無料）');
check('長さの表記が無ければ NULL（既定の帯）', eyebrow('entry_s2') === null && eyebrow('entry_guide') === null);
check('空白だけの長さの表記も NULL', eyebrow('entry_s3') === null);

// ───────── 既存の回答を写す ─────────
const fmt = (rows) => rows.map((r) => `${r.position}:${r.question_id}=${r.answer}`).join(' | ');
check('ガイド経由：気になっていること → ご質問',
  fmt(answersOf('app_g')) === '1:q_concern=任せ方 | 2:q_message=日程は？');
check('設問文を写す', answersOf('app_g')[0].label === 'いま、人間関係で気になっていること');
const s1 = answersOf('app_s1');
check('追加項目は入口の並び順で写す',
  s1.find((r) => r.label === '役職')?.position === 2 && s1.find((r) => r.label === '店舗の人数')?.position === 3);
check('入口から消えていた追加項目も落とさない', s1.some((r) => r.label === '消えたラベル' && r.answer === 'x'));
check('空白だけの回答は写さない', !s1.some((r) => r.label === '空欄'));
check('ご質問は最後', s1.at(-1).question_id === 'q_message' && s1.at(-1).answer === '特に');
check('壊れた追加項目・空白だけの気になっていることでも止まらず、何も写さない', answersOf('app_bad').length === 0);
check('Googleフォームの移行分も写す（空のご質問は写さない）', fmt(answersOf('app_form')) === '1:q_concern=部下');
const before = one(`select count(*) n from question_answers`).n;
check('写した件数（2 + 4 + 0 + 1）', before === 7);

// ───────── 古いコードのまま動く ─────────
check('古いコードの入口の読み込みが通る', !throws(
  `select id, slug, headline, intro, session_label, fields_json, active, system from entries where slug = 'sem-0928'`));
check('古いコードの申込の insert が通る', !throws(`
  insert into session_applications
    (id, created_at, entry_id, apply_visit_id, response_id, type_code, name, email,
     concern, preferred_slots, question, custom_answers, source, status)
  values ('app_gap','2026-11-10T01:00:00.000Z','entry_s1',null,null,null,'間','e@example.com',
          '間の申込','[]',null,'{"役職":"副店長"}','in-app','未対応')`));

// ───────── 0009 で流し直す：増えず、その間の申込だけ拾う ─────────
db.exec(COPY);
check('流し直すと、その間の申込を拾う',
  fmt(answersOf('app_gap')) === `1:q_concern=間の申込 | 2:${legacyId('役職')}=副店長`);
check('流し直しても既存の回答は増えない', one(`select count(*) n from question_answers`).n === before + 2);
db.exec(COPY);
check('もう一度流しても増えない', one(`select count(*) n from question_answers`).n === before + 2);

// ───────── 外部キーと一意 ─────────
check('知らない設問への回答は入らない', throws(
  `insert into question_answers (application_id, question_id, position, label) values ('app_g','q_nope',9,'x')`));
check('知らない申込への回答は入らない', throws(
  `insert into question_answers (application_id, question_id, position, label) values ('app_nope','q_concern',1,'x')`));
check('同じ申込に同じ設問は2行入らない', throws(
  `insert into question_answers (application_id, question_id, position, label) values ('app_g','q_concern',5,'x')`));
check('回答のある設問は消せない', throws(`delete from questions where id = 'q_concern'`));
check('入口の中で同じ順番は使えない', throws(
  `insert into entry_questions (entry_id, question_id, position) values ('entry_s2','q_side_since',1)`));
check('申込を消すと回答も消える（cascade）', (() => {
  db.exec(`delete from session_applications where id = 'app_bad'; delete from session_applications where id = 'app_gap'`);
  return one(`select count(*) n from question_answers where application_id = 'app_gap'`).n === 0;
})());
check('入口を消すと入口の設問も消える（cascade）', (() => {
  db.exec(`insert into entries (id, slug, kind, name, created_at) values ('entry_tmp','tmp','seminar','一時','2026-11-10T00:00:00.000Z');
           insert into entry_questions (entry_id, question_id, position) values ('entry_tmp','q_side_since',1);
           delete from entries where id = 'entry_tmp'`);
  return one(`select count(*) n from entry_questions where entry_id = 'entry_tmp'`).n === 0;
})());

// ───────── lib/questions.ts（本物の SQL を本物のスキーマに当てる） ─────────
/** D1（prepare→bind→all/first/run）を node:sqlite で満たす最小の被せもの。 */
function asD1(sqlite) {
  const prepare = (s) => {
    let params = [];
    const stmt = {
      bind: (...a) => { params = a; return stmt; },
      all: async () => ({ results: sqlite.prepare(s).all(...params) }),
      first: async () => sqlite.prepare(s).get(...params) ?? null,
      run: async () => { sqlite.prepare(s).run(...params); return {}; },
    };
    return stmt;
  };
  return { prepare, batch: async (stmts) => Promise.all(stmts.map((x) => x.run())) };
}
{
  const d1 = asD1(db);
  db.exec(`insert into entries (id, slug, kind, name, created_at) values ('entry_side','sem-1111','seminar','11/11 副業','2026-11-01T00:00:00.000Z');
           insert into entry_questions (entry_id, question_id, position) values ('entry_side','q_side_worry',2),('entry_side','q_side_since',1);`);

  const ids = (list) => list.map((x) => x.id).join(',');
  check('選んだ順 → 固定の設問', ids(await formQuestions(d1, 'entry_side')) === 'q_side_since,q_side_worry,q_message');
  check('ガイド経由は人間関係の設問 → 固定の設問', ids(await formQuestions(d1, 'entry_guide')) === 'q_concern,q_message');
  check('設問が0件の入口は固定の設問だけ（新しい入口）',
    ids(await formQuestions(d1, 'entry_direct')) === 'q_message');
  check('アーカイブ済みでも選ばれていれば出す',
    (await formQuestions(d1, 'entry_s1')).some((x) => x.id === legacyId('役職')));

  const shown = await formQuestions(d1, 'entry_side');
  const rows = answerRows(shown, { q_side_since: ' 3年 ', q_side_worry: '', q_concern: '出していない設問', q_message: 'x'.repeat(5000) });
  check('出した設問ぶん1行ずつ作る（空欄も残す）', rows.length === 3 && rows[1].answer === null);
  check('前後の空白は落とす', rows[0].answer === '3年');
  check('並び順は出した順', rows.map((r) => r.position).join(',') === '1,2,3');
  check('出していない設問の回答は入れない', !rows.some((r) => r.question_id === 'q_concern'));
  check('4000字で切る', rows[2].answer.length === 4000);
  check('設問文はマスタから写す', rows[0].label === '副業を始めたいと思ってどのくらい経ちますか？');
  const old = answerRows(await formQuestions(d1, 'entry_guide'), undefined, { concern: '任せ方', question: '質問' });
  check('古い画面（concern / question）からの送信も受ける',
    old.map((r) => `${r.question_id}=${r.answer}`).join(',') === 'q_concern=任せ方,q_message=質問');
  check('answers があれば古い形は見ない',
    answerRows(await formQuestions(d1, 'entry_guide'), {}, { concern: '無視' }).every((r) => r.answer === null));
  check('配列で送られても受けない（古い形とみなす）',
    answerRows(shown, ['a', 'b'], {}).every((r) => r.answer === null));

  check('書いてあるものだけ「設問文：回答」', answersText(rows).split('\n').length === 2 && answersText(rows).startsWith('副業を始めたいと思ってどのくらい経ちますか？：3年'));
  check('申込1件ぶんを並び順で読む',
    (await loadQuestionAnswers(d1, 'app_g')).map((r) => r.question_id).join(',') === 'q_concern,q_message');
  const grouped = groupAnswers(all(`select application_id, question_id, position, label, answer from question_answers order by application_id, position`));
  check('申込ごとにまとめる', grouped.get('app_s1')?.length === 4 && grouped.get('app_g')?.length === 2);

  // 入口の編集画面の選択肢
  const choices = await questionChoices(d1, 'entry_side');
  check('選ばれている順に先に並ぶ', choices[0].id === 'q_side_since' && choices[1].id === 'q_side_worry');
  check('固定の設問は選択肢に出さない', !choices.some((c) => c.id === 'q_message'));
  check('アーカイブ済みは選択肢に出さない', !choices.some((c) => c.id.startsWith('q_legacy_')));
  check('選ばれていない設問は position が null', choices.find((c) => c.id === 'q_concern')?.position === null);
  check('アーカイブ済みでも、その入口で選ばれていれば出す（外せるように）',
    (await questionChoices(d1, 'entry_s1')).some((c) => c.id === legacyId('役職')));

  const pick = (checked, order = {}) => selectedQuestionIds(choices, checked, (id) => order[id] ?? '');
  const okIds = (r) => (r.ok ? r.ids.join(',') : `NG:${r.message}`);
  check('順番の数字の小さい順', okIds(pick(['q_side_worry', 'q_concern'], { q_concern: '1', q_side_worry: '2' })) === 'q_concern,q_side_worry');
  check('順番が空なら画面の並び順', okIds(pick(['q_concern', 'q_side_since'])) === 'q_side_since,q_concern');
  check('順番が同じなら画面の並び順', okIds(pick(['q_concern', 'q_side_worry'], { q_concern: '1', q_side_worry: '1' })) === 'q_side_worry,q_concern');
  check('同じIDが2回来ても1回', okIds(pick(['q_concern', 'q_concern'])) === 'q_concern');
  check('何も選ばなくてよい', okIds(pick([])) === '');
  check('固定の設問は選べない', !pick(['q_message']).ok);
  check('知らない設問は選べない', !pick(['q_nope']).ok);
}

// ───────── 0009：その間の申込を拾ってから旧列を消す ─────────
{
  const d = new DatabaseSync(':memory:');
  for (const f of BEFORE) d.exec(sql(f));
  d.exec('pragma foreign_keys = on');
  d.exec(`
    insert into entries (id, slug, kind, name, session_label, fields_json, created_at) values
      ('entry_s1','sem-0928','seminar','9/28','45分','["役職"]','2026-09-17T00:00:00.000Z');
    insert into entry_seminars (entry_id, held_on) values ('entry_s1','2026-09-28');
    insert into session_applications (id, created_at, entry_id, name, email, concern, question, custom_answers) values
      ('app_old','2026-09-28T00:00:00.000Z','entry_s1','高橋','b@example.com','前から','質問','{"役職":"店長"}');
  `);
  d.exec(sql(SUBJECT));
  // 0008 を当ててから新しいコードを出すまでの間に、古いコードが受けた申込
  d.exec(`insert into session_applications (id, created_at, entry_id, name, email, concern, question, custom_answers) values
            ('app_gap','2026-11-10T01:00:00.000Z','entry_s1','間','g@example.com','間の悩み','間の質問','{"役職":"副店長","新しいラベル":"y"}')`);
  const n = (s_) => d.prepare(s_).get().n;
  const appsBefore = n(`select count(*) n from session_applications`);
  const answersBefore = n(`select count(*) n from question_answers`);
  const eqBefore = n(`select count(*) n from entry_questions`);

  d.exec(sql(DROP));

  const cols = (t) => d.prepare(`select name from pragma_table_info('${t}')`).all().map((r) => r.name);
  const fmt9 = (id) => d.prepare(`select question_id, position, answer from question_answers where application_id = ? order by position, question_id`)
    .all(id).map((r) => `${r.position}:${r.question_id}=${r.answer}`).join(' | ');
  const idOf = (label) => d.prepare(`select id from questions where label = ?`).get(label)?.id;
  check('0009：その間の申込の気になっていること・追加項目・ご質問を拾う',
    fmt9('app_gap') === `1:q_concern=間の悩み | 2:${idOf('役職')}=副店長 | 90:${idOf('新しいラベル')}=y | 91:q_message=間の質問`);
  check('0009：その間に増えたラベルも設問にする（ID は 0008 と被らない）',
    idOf('新しいラベル')?.startsWith('q_legacy9_') && d.prepare(`select archived from questions where label = '新しいラベル'`).get().archived === 1);
  check('0009：0008 で写した回答は増えない', fmt9('app_old') === `1:q_concern=前から | 2:${idOf('役職')}=店長 | 3:q_message=質問`);
  check('0009：回答の件数は「その間の申込」の分だけ増える', n(`select count(*) n from question_answers`) === answersBefore + 4);
  check('0009：申込は1件も消えない', n(`select count(*) n from session_applications`) === appsBefore);
  check('0009：入口の設問も消えない', n(`select count(*) n from entry_questions`) === eqBefore);
  check('0009：氏名とメールは残る', d.prepare(`select name, email from session_applications where id = 'app_old'`).get().email === 'b@example.com');
  for (const c of ['concern', 'question', 'custom_answers']) check(`0009：session_applications.${c} が消える`, !cols('session_applications').includes(c));
  for (const c of ['session_label', 'fields_json']) check(`0009：entries.${c} が消える`, !cols('entries').includes(c));
  check('0009：帯は残る', d.prepare(`select eyebrow from entries where id = 'entry_s1'`).get().eyebrow === '体験セッション（45分・無料）');
  check('0009：新しいコードの申込の insert が通る', !(() => { try {
    d.exec(`insert into session_applications (id, created_at, entry_id, apply_visit_id, response_id, type_code, name, email, preferred_slots, source, status)
              values ('app_new','2026-11-11T00:00:00.000Z','entry_s1',null,null,null,'新','n@example.com','[]','in-app','未対応');
            insert into question_answers (application_id, question_id, position, label, answer) values ('app_new','q_message',1,'ご質問・伝えておきたいこと',null)`);
    return false; } catch { return true; } })());
  check('0009：古いコードの申込の insert は落ちる（だからデプロイを先にする）', (() => { try {
    d.exec(`insert into session_applications (id, created_at, entry_id, name, email, concern) values ('app_x','2026-11-11T00:00:00.000Z','entry_s1','x','x@example.com','x')`);
    return false; } catch { return true; } })());
  check('0009：外部キーは効いたまま', (() => { try {
    d.exec(`insert into question_answers (application_id, question_id, position, label) values ('app_nope','q_concern',1,'x')`); return false; } catch { return true; } })());
  d.exec(`delete from session_applications where id = 'app_gap'`);
  check('0009：申込を消すと回答も消える（cascade は効いたまま）', n(`select count(*) n from question_answers where application_id = 'app_gap'`) === 0);
  check('0009：外部キーの不整合が無い', d.prepare('pragma foreign_key_check').all().length === 0);
  d.close();
}

console.log(`申込の設問マスタ（${SUBJECT}・${DROP}）の試験: ${pass} 件通過`);
if (fails.length) {
  console.error(`\n失敗 ${fails.length} 件:`);
  fails.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log('  → 既存の回答の移行・古いコードとの共存・流し直し・外部キー・設問の読み書きは仕様どおり');
