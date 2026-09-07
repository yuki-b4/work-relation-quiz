/**
 * 移行スクリプト（tools/migrate-sheets.mjs）の試験。
 *
 *   node tools/migrate-test.mjs
 *
 * 見どころは3つ。どれも間違えると、移行したあとで気づけない。
 *   ・タイムスタンプを **JSTとして読む**（7.3）。UTCとして読むと全件9時間ずれる
 *   ・引用符の中の改行・カンマ・シングルクォートを壊さずSQLに載せる
 *   ・「診断ID」がある申込だけが回答に紐づく（7.1）
 */
import {
  parseCsv, toUtc, num, splitIssues, q, typeCodeOf,
  buildResponses, buildReferrers, buildCorpLeads, buildApplications,
} from './migrate-sheets.mjs';

let pass = 0;
const fails = [];
const check = (label, cond) => { if (cond) pass++; else fails.push(label); };
const eq = (label, a, b) =>
  check(`${label}（期待 ${JSON.stringify(b)}、実際 ${JSON.stringify(a)}）`, JSON.stringify(a) === JSON.stringify(b));

// ───────── CSVの読み取り ─────────
{
  eq('素の行', parseCsv('a,b\n1,2\n'), [['a', 'b'], ['1', '2']]);
  eq('引用符の中のカンマ', parseCsv('a,b\n"x,y",2\n'), [['a', 'b'], ['x,y', '2']]);
  eq('引用符の中の改行', parseCsv('a\n"1\n2"\n'), [['a'], ['1\n2']]);
  eq('二重引用符', parseCsv('a\n"say ""hi"""\n'), [['a'], ['say "hi"']]);
  eq('BOM付き', parseCsv('﻿a,b\n1,2\n'), [['a', 'b'], ['1', '2']]);
  eq('CRLF', parseCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
  eq('末尾に改行が無い', parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
}

// ───────── 値の変換（7.3） ─────────
{
  eq('スラッシュ区切りをJSTとして読む', toUtc('2026/07/29 14:03:21'), '2026-07-29T05:03:21.000Z');
  eq('ハイフン区切りも同じ', toUtc('2026-07-29 14:03:21'), '2026-07-29T05:03:21.000Z');
  eq('秒が無くても読む', toUtc('2026/07/29 14:03'), '2026-07-29T05:03:00.000Z');
  eq('1桁の月日', toUtc('2026/7/9 9:05'), '2026-07-09T00:05:00.000Z');
  eq('日付だけならJSTの0時', toUtc('2026/07/29'), '2026-07-28T15:00:00.000Z');
  eq('空は null', toUtc(''), null);
  eq('読めない値は null（いまの時刻で埋めない）', toUtc('たぶん7月ごろ'), null);

  eq('小数を読む', num('0.667'), 0.667);
  eq('空は null', num(''), null);
  eq('数値でなければ null', num('—'), null);

  eq('「、」で分解', splitIssues('人が辞める、店長が育たない'), ['人が辞める', '店長が育たない']);
  eq('「,」でも分解', splitIssues('A,B'), ['A', 'B']);
  eq('空は空配列', splitIssues(''), []);
  eq('前後の空白を落とす', splitIssues(' A 、 B '), ['A', 'B']);

  eq('SQLのエスケープ', q("O'Brien"), "'O''Brien'");
  eq('空は NULL', q(''), 'NULL');
  eq('undefined も NULL', q(undefined), 'NULL');

  eq('表示名からタイプコード', typeCodeOf('突撃隊長（OBL）'), 'OBL');
  eq('コードだけでも読む', typeCodeOf('GKS'), 'GKS');
  eq('無ければ null', typeCodeOf('わからない'), null);
}

// ───────── 指標v2 → responses ─────────
{
  const row = {
    'タイムスタンプ': '2026/07/29 14:03:21', 'モード': 'feedback', '紹介元': 'TKtp46k',
    'Q1_本音': 'O', 'Q2_衝突': 'B', 'Q3_重心': 'L',
    'Q4_本音': 'O', 'Q5_衝突': 'K', 'Q6_重心': 'L',
    'Q7_本音': 'G', 'Q8_衝突': 'B', 'Q9_重心': 'L',
    '判定_本音': 'O', '判定_衝突': 'B', '判定_重心': 'L',
    'タイプコード': 'OBL', 'タイプ名': '突撃隊長',
    '5軸_本音': '0.67', '5軸_任せ方': '0.33', '5軸_境界': '0.5', '5軸_摩擦': '0.75', '5軸_間合い': '0.25',
    'これは私だ': 'とても当てはまる', '深掘りしたい': 'はい',
    '自由記述': "任せられない。O'Brienさんとの関係",
    '理想_解消後の毎日': '落ち着いて過ごせる', 'セグメント': 'referral', '備考': '要フォロー',
  };
  const { sql, report } = buildResponses([row]);
  const all = sql.join('\n');

  eq('1件取り込む', report.imported, 1);
  eq('タイプ別の分布', report.types, { OBL: 1 });
  check('question_set_version は legacy（7.3）', all.includes("'legacy'"));
  check('タイムスタンプはUTCで入る', all.includes("'2026-07-29T05:03:21.000Z'"));
  check('モードとセグメントはそのまま残す（7.3）', all.includes("'feedback'") && all.includes("'referral'"));
  check('紹介元コードを残す', all.includes("'TKtp46k'"));
  check('紹介者マスタにあるコードだけ referrer_code に解決する', all.includes('EXISTS (SELECT 1 FROM referrers'));
  eq('9問ぶんの設問別回答', report.answers, 9);
  check('二択の識別子は bin-1〜bin-9', all.includes("'bin-1'") && all.includes("'bin-9'"));
  check('リッカートは入れない（移行元に無い。7.3）', !all.includes("'lik-"));
  check('3軸のカウントを数え直す', all.includes('"h":{"L":2,"R":1,"total":3}'));
  eq('検証アンケートを1件作る', report.surveys, 1);
  eq('ヒアリングを1件作る', report.hearings, 1);
  check("シングルクォートを壊さない", all.includes("O''Brien"));
  check('二度流しても増えない', all.includes('INSERT OR IGNORE INTO responses'));
  check('備考はメモへ移す', all.includes("'要フォロー'"));

  const bad = buildResponses([
    { ...row, 'タイムスタンプ': '' },
    { ...row, 'タイプコード': 'XXX' },
  ]);
  eq('タイムスタンプが読めない行は取り込まない', bad.report.imported, 0);
  eq('理由を並べる', bad.report.skipped.length, 2);
}

// ───────── 紹介者マスタ ─────────
{
  const { sql, report } = buildReferrers([
    { 'コード': 'TKtp46k', '紹介者名': '田中', 'メモ': '初回' },
    { 'コード': '', '紹介者名': '空コード' },
  ]);
  eq('コードのある行だけ', report.imported, 1);
  eq('落とした行を報告する', report.skipped.length, 1);
  check('コードと名前が入る', sql.join('').includes("'TKtp46k'") && sql.join('').includes("'田中'"));
  check('既定で有効', sql.join('').includes(', 1, '));
}

// ───────── 法人リード（7.1：「、」連結を配列へ） ─────────
{
  const { sql, report } = buildCorpLeads([{
    'タイムスタンプ': '2026/08/01 10:00:00', 'メールアドレス': 'corp@example.com',
    '課題': '人が辞める、店長が育たない', '自由記述': '店長が3人続けて辞めた',
    '紹介元': 'corp-lp', '流入ページ': 'lp-corporate', 'リードID': 'lead-1', '対応状況': '連絡済', 'メモ': '返信待ち',
  }]);
  eq('1件取り込む', report.imported, 1);
  const all = sql.join('');
  check('課題がJSON配列になる', all.includes('["人が辞める","店長が育たない"]'));
  check('シートのリードIDを主キーにする', all.includes("'lead-1'"));
  check('対応状況を引き継ぐ', all.includes("'連絡済'"));
}

// ───────── Googleフォーム → 申込（7.1） ─────────
{
  const rows = [
    {
      'タイムスタンプ': '2026/08/10 09:30:00', 'お名前': '山田太郎', 'メールアドレス': 'taro@example.com',
      '診断結果のタイプ': '突撃隊長（OBL）', 'いま、人間関係で気になっていること（任意）': '任せ方',
      '希望の時間帯（任意・複数選択可）': '平日の夜（19時以降）、土日の午前',
      'ご質問・伝えておきたいこと（任意）': '', '診断ID（任意）': 'resp-1',
    },
    {
      'タイムスタンプ': '2026/08/11 09:30:00', 'お名前': '佐藤花子', 'メールアドレス': 'hanako@example.com',
      '診断結果のタイプ': 'がんばり屋の調整役（GKS）', '診断ID（任意）': '',
    },
  ];
  const { sql, report } = buildApplications(rows, new Map([['resp-1', 'OBL']]));
  eq('2件とも取り込む', report.imported, 2);
  eq('診断IDがある1件は紐づける', report.linked, 1);
  eq('無い1件は未紐づけ（Adminで手当て。F2-4）', report.unlinked, 1);
  const all = sql.join('\n');
  check('取り込み元が分かる', all.includes("'google-form-import'"));
  check('実在する回答にだけ紐づける', all.includes('SELECT id FROM responses WHERE id ='));
  check('希望の時間帯がJSON配列になる', all.includes('["平日の夜（19時以降）","土日の午前"]'));
  check('タイプは回答側を正とする', all.includes("'OBL'"));
  check('回答が無ければフォームの申告を使う', all.includes("'GKS'"));

  const skipped = buildApplications([{ 'タイムスタンプ': '2026/08/10 09:30:00', 'お名前': '', 'メールアドレス': '' }]);
  eq('氏名もメールも無い行は取り込まない', skipped.report.imported, 0);
}

if (fails.length) {
  console.log(`\n移行スクリプトの試験：失敗 ${fails.length} 件`);
  for (const f of fails) console.log('  NG:', f);
  process.exit(1);
}
console.log(`移行スクリプトの試験: ${pass} 件通過`);
console.log('  → JSTの読み取り・CSVの解釈・紐づけは仕様どおり');
