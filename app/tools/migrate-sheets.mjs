/**
 * スプレッドシート → D1 の移行（アプリ化要件定義.md 第7章）。
 *
 *   node tools/migrate-sheets.mjs --dir ./export --out migrate.sql
 *   node tools/migrate-sheets.mjs --dir ./export --check      # 投入せず照合レポートだけ出す
 *
 * 期待するファイル（Googleスプレッドシートから「CSV でダウンロード」したもの。文字コードはUTF-8）：
 *   指標v2.csv        → responses ＋ response_answers ＋ feedback_surveys ＋ hearings
 *   法人リード.csv     → corp_leads
 *   紹介者マスタ.csv   → referrers
 *   申込フォーム.csv   → session_applications
 * どれも無ければ飛ばす。ファイル名は --responses などで個別に指定してもよい。
 *
 * 出力は SQL ファイル。中身を目で見てから、次で流す。
 *
 *   npx wrangler d1 execute nature-shindan --local  --file=migrate.sql
 *   npx wrangler d1 execute nature-shindan --remote --file=migrate.sql
 *
 * 決めごと：
 *   ・`question_set_version` は 'legacy'。15問のリッカートは移行元に無いので入れない（7.3）
 *   ・タイムスタンプは **JST として読み**、UTCのISO8601にして入れる（7.3）
 *   ・「紹介者名」列は VLOOKUP の計算結果なので、値として書き出されている前提で読む（7.3）
 *   ・回答IDはシートの値をそのまま主キーにする。Googleフォームの「診断ID」と突き合わせるため
 *   ・**同じIDを二度入れない**（insert or ignore）。途中で失敗しても、そのまま流し直せる
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ───────── 引数 ─────────

const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const dir = arg('dir', '.');
const outPath = arg('out', 'migrate.sql');
const checkOnly = has('check');

/** ディレクトリの中から、名前に含まれる語でCSVを探す。 */
function findCsv(explicit, ...words) {
  if (explicit) return resolve(explicit);
  if (!existsSync(dir)) return null;
  const hit = readdirSync(dir).find((f) => f.endsWith('.csv') && words.some((w) => f.includes(w)));
  return hit ? resolve(join(dir, hit)) : null;
}

// ───────── CSV ─────────

/**
 * RFC4180 のCSVを読む。引用符の中の改行・カンマ・二重引用符に対応する。
 * BOM が付いていれば落とす（Googleスプレッドシートの書き出しは付くことがある）。
 */
export function parseCsv(text) {
  const src = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', quoted = false, i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { quoted = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** 1行目をヘッダーとして、行をオブジェクトの配列にする。 */
export function readTable(path) {
  const rows = parseCsv(readFileSync(path, 'utf8'));
  if (!rows.length) return { header: [], rows: [] };
  const header = rows[0].map((h) => h.trim());
  const body = rows.slice(1)
    .filter((r) => r.some((v) => String(v).trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
  return { header, rows: body };
}

// ───────── 値の変換 ─────────

/** SQLの文字列リテラル。null はそのまま NULL。 */
export function q(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

/**
 * スプレッドシートのタイムスタンプを **JSTとして読み**、UTCのISO8601にする（7.3）。
 * Googleの書き出しは「2026/07/29 14:03:21」または「2026-07-29 14:03:21」。
 * 判別できない値は null を返す（欠測として扱い、勝手に「いま」を入れない）。
 */
export function toUtc(value) {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (m) {
    const [, y, mo, d, h, mi, se] = m;
    const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${mi}:${(se ?? '00').padStart(2, '0')}+09:00`;
    const t = Date.parse(iso);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }
  const dayOnly = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(s);
  if (dayOnly) {
    const [, y, mo, d] = dayOnly;
    const t = Date.parse(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00+09:00`);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** 0〜1のスコア。空欄や数値でない値は null。 */
export function num(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 「、」や「,」で連結された1セルを配列にする（7.1：法人リードの「課題」）。 */
export function splitIssues(v) {
  const s = String(v ?? '').trim();
  if (!s) return [];
  return s.split(/[、,／/]/).map((x) => x.trim()).filter(Boolean);
}

/** UUID v4。回答IDが空の行に振る。 */
function uuid() {
  return crypto.randomUUID();
}

// ───────── 指標v2 → responses ほか ─────────

/** 二択9問の列と、その軸。並びは Apps Script の HEADERS と同じ。 */
const BIN_COLUMNS = [
  ['Q1_本音', 'h'], ['Q2_衝突', 'c'], ['Q3_重心', 'w'],
  ['Q4_本音', 'h'], ['Q5_衝突', 'c'], ['Q6_重心', 'w'],
  ['Q7_本音', 'h'], ['Q8_衝突', 'c'], ['Q9_重心', 'w'],
];

const RADAR_COLUMNS = [
  ['5軸_本音', 'radar_safety'], ['5軸_任せ方', 'radar_trust'], ['5軸_境界', 'radar_bound'],
  ['5軸_摩擦', 'radar_conflict'], ['5軸_間合い', 'radar_connect'],
];

const SURVEY_COLUMNS = [
  ['これは私だ', 'me'], ['他者当てはめ', 'others'], ['他者当てはめ_誰', 'others_who'],
  ['見せたい・話したい', 'share'], ['見せたい_誰', 'share_who'],
  ['深掘りしたい', 'dig'], ['滑った部分', 'miss'],
];

/** 3軸のカウントを9問の回答から数え直す。境界事例の分析に使う（F1-2 の axis_counts）。 */
function axisCounts(row) {
  const poles = { h: ['O', 'G'], c: ['B', 'K'], w: ['L', 'S'] };
  const out = {};
  for (const axis of ['h', 'c', 'w']) {
    let L = 0, R = 0;
    for (const [col, ax] of BIN_COLUMNS) {
      if (ax !== axis) continue;
      const v = row[col];
      if (v === poles[axis][0]) L++;
      else if (v === poles[axis][1]) R++;
    }
    out[axis] = { L, R, total: L + R };
  }
  return out;
}

export function buildResponses(rows) {
  const sql = [];
  const report = { total: rows.length, imported: 0, skipped: [], types: {}, dates: [], surveys: 0, hearings: 0, answers: 0 };

  for (const [i, row] of rows.entries()) {
    const createdAt = toUtc(row['タイムスタンプ']);
    const typeCode = (row['タイプコード'] ?? '').trim();
    if (!createdAt) { report.skipped.push(`${i + 2}行目：タイムスタンプを読めない（${row['タイムスタンプ']}）`); continue; }
    if (!/^[OG][BK][LS]$/.test(typeCode)) { report.skipped.push(`${i + 2}行目：タイプコードが不正（${typeCode}）`); continue; }

    const id = (row['回答ID'] ?? '').trim() || uuid();
    const radar = Object.fromEntries(RADAR_COLUMNS.map(([col, key]) => [key, num(row[col])]));

    sql.push(
      `INSERT OR IGNORE INTO responses (
  id, created_at, completed_at, question_set_version, mode, segment,
  ref_code, referrer_code, frame, type_code, type_name,
  axis_h, axis_c, axis_w, axis_counts,
  radar_safety, radar_trust, radar_bound, radar_conflict, radar_connect,
  admin_note
) VALUES (${q(id)}, ${q(createdAt)}, ${q(createdAt)}, 'legacy', ${q(row['モード'] || 'general')}, ${q(row['セグメント'] || 'general')},
  ${q(row['紹介元'])}, NULL, NULL, ${q(typeCode)}, ${q(row['タイプ名'])},
  ${q(row['判定_本音'])}, ${q(row['判定_衝突'])}, ${q(row['判定_重心'])}, ${q(JSON.stringify(axisCounts(row)))},
  ${radar.radar_safety ?? 'NULL'}, ${radar.radar_trust ?? 'NULL'}, ${radar.radar_bound ?? 'NULL'},
  ${radar.radar_conflict ?? 'NULL'}, ${radar.radar_connect ?? 'NULL'},
  ${q(row['備考'])});`
    );

    // 紹介元コードが紹介者マスタにあれば referrer_code を埋める。無ければ ref_code だけ残る。
    sql.push(
      `UPDATE responses SET referrer_code = ref_code WHERE id = ${q(id)} AND ref_code IS NOT NULL` +
      ` AND EXISTS (SELECT 1 FROM referrers WHERE code = responses.ref_code);`
    );

    // 9問の二択。15問のリッカートは移行元に無いので入れない（7.3）。
    BIN_COLUMNS.forEach(([col, axis], n) => {
      const v = (row[col] ?? '').trim();
      if (!v) return;
      sql.push(
        `INSERT OR IGNORE INTO response_answers (response_id, order_no, question_key, kind, axis, value)` +
        ` VALUES (${q(id)}, ${n + 1}, 'bin-${n + 1}', 'bin', ${q(axis)}, ${q(v)});`
      );
      report.answers++;
    });

    // 検証アンケート。1つでも入っていれば1行作る。
    const survey = Object.fromEntries(SURVEY_COLUMNS.map(([col, key]) => [key, row[col] || null]));
    if (Object.values(survey).some(Boolean)) {
      sql.push(
        `INSERT OR IGNORE INTO feedback_surveys (response_id, me, others, others_who, share, share_who, dig, miss, created_at)` +
        ` VALUES (${q(id)}, ${q(survey.me)}, ${q(survey.others)}, ${q(survey.others_who)}, ${q(survey.share)},` +
        ` ${q(survey.share_who)}, ${q(survey.dig)}, ${q(survey.miss)}, ${q(createdAt)});`
      );
      report.surveys++;
    }

    // 商談前ヒアリング。「自由記述」＝いま悩んでいること、「理想_解消後の毎日」＝解消後。
    const now = row['自由記述'] || '';
    const future = row['理想_解消後の毎日'] || '';
    if (now || future) {
      sql.push(
        `INSERT OR IGNORE INTO hearings (response_id, now_text, future_text, created_at, updated_at)` +
        ` VALUES (${q(id)}, ${q(now)}, ${q(future)}, ${q(createdAt)}, ${q(createdAt)});`
      );
      report.hearings++;
    }

    report.imported++;
    report.types[typeCode] = (report.types[typeCode] ?? 0) + 1;
    report.dates.push(createdAt);
  }
  return { sql, report };
}

// ───────── 紹介者マスタ → referrers ─────────

export function buildReferrers(rows) {
  const sql = [];
  const report = { total: rows.length, imported: 0, skipped: [] };
  for (const [i, row] of rows.entries()) {
    const code = (row['コード'] ?? '').trim();
    const name = (row['紹介者名'] ?? '').trim();
    if (!code) { report.skipped.push(`${i + 2}行目：コードが空`); continue; }
    if (!name) { report.skipped.push(`${i + 2}行目：紹介者名が空（${code}）`); continue; }
    sql.push(
      `INSERT OR IGNORE INTO referrers (code, name, note, active, created_at)` +
      ` VALUES (${q(code)}, ${q(name)}, ${q(row['メモ'] || row['備考'] || null)}, 1, ${q(toUtc(row['登録日']) ?? new Date().toISOString())});`
    );
    report.imported++;
  }
  return { sql, report };
}

// ───────── 法人リード → corp_leads ─────────

export function buildCorpLeads(rows) {
  const sql = [];
  const report = { total: rows.length, imported: 0, skipped: [] };
  for (const [i, row] of rows.entries()) {
    const createdAt = toUtc(row['タイムスタンプ']);
    const email = (row['メールアドレス'] ?? '').trim();
    if (!createdAt) { report.skipped.push(`${i + 2}行目：タイムスタンプを読めない`); continue; }
    if (!email) { report.skipped.push(`${i + 2}行目：メールアドレスが空`); continue; }
    const id = (row['リードID'] ?? '').trim() || uuid();
    sql.push(
      `INSERT OR IGNORE INTO corp_leads (id, created_at, email, issues, detail, ref_code, page, status, admin_note)` +
      ` VALUES (${q(id)}, ${q(createdAt)}, ${q(email)}, ${q(JSON.stringify(splitIssues(row['課題'])))},` +
      ` ${q(row['自由記述'])}, ${q(row['紹介元'])}, ${q(row['流入ページ'])},` +
      ` ${q(row['対応状況'] || '未対応')}, ${q(row['メモ'])});`
    );
    report.imported++;
  }
  return { sql, report };
}

// ───────── Googleフォーム回答 → session_applications ─────────

/** フォームの列名。CreateSessionForm.gs の setTitle と揃える。 */
const FORM = {
  at: 'タイムスタンプ',
  name: 'お名前',
  email: 'メールアドレス',
  type: '診断結果のタイプ',
  concern: 'いま、人間関係で気になっていること（任意）',
  slots: '希望の時間帯（任意・複数選択可）',
  question: 'ご質問・伝えておきたいこと（任意）',
  responseId: '診断ID（任意）',
};

/** 「突撃隊長（OBL）」のような表示名からタイプコードを取り出す。 */
export function typeCodeOf(label) {
  const m = /([OG][BK][LS])/.exec(String(label ?? ''));
  return m ? m[1] : null;
}

export function buildApplications(rows, typeByResponseId = new Map()) {
  const sql = [];
  const report = { total: rows.length, imported: 0, linked: 0, unlinked: 0, skipped: [] };
  for (const [i, row] of rows.entries()) {
    const createdAt = toUtc(row[FORM.at]);
    const name = (row[FORM.name] ?? '').trim();
    const email = (row[FORM.email] ?? '').trim();
    if (!createdAt) { report.skipped.push(`${i + 2}行目：タイムスタンプを読めない`); continue; }
    if (!name || !email) { report.skipped.push(`${i + 2}行目：氏名かメールが空`); continue; }

    const responseId = (row[FORM.responseId] ?? '').trim() || null;
    // タイプは、紐づく回答があればそちらを正とする。フォームの自己申告より確かなため。
    const typeCode = (responseId && typeByResponseId.get(responseId)) || typeCodeOf(row[FORM.type]);
    const slots = splitIssues(row[FORM.slots]);

    sql.push(
      `INSERT OR IGNORE INTO session_applications (
  id, created_at, apply_visit_id, response_id, type_code, name, email,
  concern, preferred_slots, question, source, status
) VALUES (${q(uuid())}, ${q(createdAt)}, NULL,` +
      // 回答が実在するときだけ紐づける。消えたIDを書くと外部キーで落ちる。
      ` (SELECT id FROM responses WHERE id = ${q(responseId)}), ${q(typeCode)}, ${q(name)}, ${q(email)},` +
      ` ${q(row[FORM.concern])}, ${q(JSON.stringify(slots))}, ${q(row[FORM.question])},` +
      ` 'google-form-import', '未対応');`
    );
    report.imported++;
    if (responseId) report.linked++; else report.unlinked++;
  }
  return { sql, report };
}

// ───────── 実行 ─────────

function line(label, value) {
  console.log(`  ${label}：${value}`);
}

function reportBlock(title, report, extra = () => {}) {
  console.log(`\n【${title}】`);
  line('シートの行数', report.total);
  line('取り込む行数', report.imported);
  extra(report);
  if (report.skipped.length) {
    console.log(`  取り込まない行 ${report.skipped.length} 件：`);
    for (const s of report.skipped.slice(0, 20)) console.log(`    ・${s}`);
    if (report.skipped.length > 20) console.log(`    …ほか ${report.skipped.length - 20} 件`);
  }
}

function main() {
  const files = {
    responses: findCsv(arg('responses'), '指標v2', 'shihyo'),
    referrers: findCsv(arg('referrers'), '紹介者マスタ', 'referrer'),
    corpLeads: findCsv(arg('corp-leads'), '法人リード', 'corp'),
    applications: findCsv(arg('applications'), '申込', 'フォーム', 'form'),
  };

  console.log('=== 移行元 ===');
  for (const [key, path] of Object.entries(files)) {
    line(key, path ? path : '（見つからないので飛ばす）');
  }

  const out = [
    '-- ナチュール診断：スプレッドシートからの移行（アプリ化要件定義.md 第7章）',
    `-- 生成 ${new Date().toISOString()}`,
    '-- 二度流しても増えないように、すべて INSERT OR IGNORE にしてある。',
    '',
    'PRAGMA foreign_keys = ON;',
    '',
  ];

  // 紹介者マスタを先に入れる。responses の referrer_code の解決に要るため。
  if (files.referrers) {
    const { rows } = readTable(files.referrers);
    const { sql, report } = buildReferrers(rows);
    out.push('-- ───── 紹介者マスタ → referrers ─────', ...sql, '');
    reportBlock('紹介者マスタ', report);
  }

  const typeByResponseId = new Map();
  if (files.responses) {
    const { rows } = readTable(files.responses);
    const { sql, report } = buildResponses(rows);
    for (const row of rows) {
      const id = (row['回答ID'] ?? '').trim();
      if (id) typeByResponseId.set(id, (row['タイプコード'] ?? '').trim());
    }
    out.push('-- ───── 指標v2 → responses / response_answers / feedback_surveys / hearings ─────', ...sql, '');
    reportBlock('指標v2', report, (r) => {
      line('設問別回答（9問×件数）', r.answers);
      line('検証アンケート', r.surveys);
      line('商談前ヒアリング', r.hearings);
      const dates = r.dates.slice().sort();
      line('日付の範囲（UTC）', dates.length ? `${dates[0]} 〜 ${dates[dates.length - 1]}` : '—');
      console.log('  タイプ別の分布：');
      for (const [code, n] of Object.entries(r.types).sort()) console.log(`    ${code}  ${n}`);
      // 保存期間3年（6.2・7.3）。過ぎている行があれば投入前に扱いを決める。
      const limit = new Date(Date.now() - 3 * 365 * 86_400_000).toISOString();
      const old = r.dates.filter((d) => d < limit).length;
      if (old) console.log(`  ⚠ 回答日から3年を過ぎている行が ${old} 件あります。投入前に扱いを決めてください（6.2）。`);
    });
  }

  if (files.corpLeads) {
    const { rows } = readTable(files.corpLeads);
    const { sql, report } = buildCorpLeads(rows);
    out.push('-- ───── 法人リード → corp_leads ─────', ...sql, '');
    reportBlock('法人リード', report);
  }

  if (files.applications) {
    const { rows } = readTable(files.applications);
    const { sql, report } = buildApplications(rows, typeByResponseId);
    out.push('-- ───── Googleフォーム回答 → session_applications ─────', ...sql, '');
    reportBlock('体験セッション申込（Googleフォーム）', report, (r) => {
      line('回答に紐づく', r.linked);
      line('未紐づけ（Adminで手当て）', r.unlinked);
    });
  }

  if (checkOnly) {
    console.log('\n--check なので SQL は書き出していません。');
    return;
  }
  writeFileSync(outPath, out.join('\n') + '\n', 'utf8');
  console.log(`\n=== 書き出し ===\n  ${resolve(outPath)}（${out.length} 行）`);
  console.log('\n次の手順：');
  console.log('  1. 中身に目を通す');
  console.log(`  2. npx wrangler d1 execute nature-shindan --local  --file=${outPath}`);
  console.log('  3. Admin の一覧で件数とタイプ分布を照合する（7.2）');
  console.log(`  4. 問題なければ --remote で本番へ`);
  console.log('\n移行後：Googleフォームの受付を締め切り（確認事項3＝a）、スプレッドシートは読み取り専用で残す（7.2）。');
}

// 直接実行されたときだけ動かす（試験からは関数だけを読む）。
if (import.meta.url === `file://${process.argv[1]}`) main();
