/**
 * 事業ロードマップブックの2シートを、2026-08改定の戦略に合わせて書き換えるスクリプト。
 *
 * 対象シート
 *   - 0_全体サマリー
 *   - 法人_12ヶ月ロードマップ
 *   - 90日WBS_アクション
 *
 * 内容のソース
 *   - 法人中心価値とファネル.md（中心価値・価格・商品定義・ファネル）
 *   - 0to1マーケティング戦略.md（主エンジン・無料ラダー・管理変数・90日の運用）
 *
 * 使い方（スプレッドシートにバインドして1回実行する）
 *   1. 事業ロードマップブックを開き、拡張機能 ▶ Apps Script を選ぶ
 *   2. このファイルの中身を全部コピペして保存する
 *   3. 関数 updateRoadmapSheets を選んで実行する（初回は承認が必要）
 *
 * 安全設計
 *   - 既存シートは削除しない。`<シート名>_旧YYYYMMDD` にリネームして非表示にするだけなので、
 *     いつでも中身を見に行ける。気に入らなければ新シートを消して旧シートを再表示すれば元に戻る。
 *   - 書き換えるのは上記3シートのみ。個人_12ヶ月ロードマップ等には触れない。
 */

var TZ = 'Asia/Tokyo';

// 既存ブックの配色をそのまま引き継ぐ
var C = {
  navy: '#1F4E79',
  blue: '#2E75B6',
  slate: '#2C3E50',
  steel: '#5B7C99',
  gray: '#595959',
  green: '#375623',
  orange: '#A04000',
  gold: '#BF8F00',
  barBlue: '#2E75B6',
  barLightBlue: '#9DC3E6',
  barGray: '#A6A6A6',
  barGreen: '#70AD47',
  barIndigo: '#8FAADC',
  barGold: '#FFD966',
  barOrange: '#C55A11',
  cellGrid: '#FAFAFA',
  tintBlue: '#DAEEF3',
  tintSky: '#DDEBF7',
  tintGreen: '#E2EFDA',
  tintGold: '#FFF2CC',
  tintOrange: '#FCE4D6',
  tintGrayLight: '#EDEDED',
  tintGray: '#E2E2E2',
  offWhite: '#F2F2F2',
  white: '#FFFFFF'
};

function updateRoadmapSheets() {
  var ss = SpreadsheetApp.getActive();
  var done = [];
  done.push(rebuildSheet_(ss, '0_全体サマリー', buildSummary_));
  done.push(rebuildSheet_(ss, '法人_12ヶ月ロードマップ', buildB2bRoadmap_));
  done.push(rebuildSheet_(ss, '90日WBS_アクション', buildNinetyDayWbs_));
  SpreadsheetApp.getActive().toast(done.join(' / '), '書き換え完了', 15);
  Logger.log(done.join('\n'));
}

/** 旧シートを退避してから、同じ位置に同じ名前で作り直す */
function rebuildSheet_(ss, name, builder) {
  var old = ss.getSheetByName(name);
  var position = old ? old.getIndex() - 1 : ss.getNumSheets();
  var note = '';

  if (old) {
    var stamp = Utilities.formatDate(new Date(), TZ, 'yyyyMMdd');
    var backup = name + '_旧' + stamp;
    var n = 2;
    while (ss.getSheetByName(backup)) {
      backup = name + '_旧' + stamp + '_' + n;
      n++;
    }
    old.setName(backup);
    note = '（旧版は ' + backup + ' に退避）';
  }

  var sheet = ss.insertSheet(name, position);
  builder(sheet);
  if (old) {
    old.hideSheet();
  }
  return name + ' を書き換え' + note;
}

/* ============================================================
 * 0. 0_全体サマリー
 * ============================================================ */

function buildSummary_(sheet) {
  var LAST = 14; // N列まで使う（B〜N＝13列。A列は余白）
  var r = 1;

  // --- ヘッダ ---
  put_(sheet, r, 2, '事業全体サマリー（Funnel 1：法人起点・個人波及型）／ 2026-08改定', LAST)
    .setBackground(C.slate).setFontColor(C.white).setFontSize(15).setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setRowHeight(r, 32);
  r++;

  // --- ① ミッション / 北極星 ---
  r = section_(sheet, r, '① ミッション / 北極星', C.slate, LAST);
  r = kv_(sheet, r, '北極星', '職場とプライベート双方の人間関係の質を底上げする。自由な働き方の労働者を増やす。', LAST);
  r = kv_(sheet, r, '戦略の軸', 'Funnel 1（法人起点・個人波及型）で実績を作り、最終的に Funnel 3（ツインエンジン型）へ移行する。', LAST);
  r = kv_(sheet, r, '共通の入口', '無料診断（9問・8タイプ）。法人・個人どちらもこの診断が唯一の共通入口。', LAST);
  r = kv_(sheet, r, '現フェーズ', '0→1（法人③現場責任者の最初の10社）。当面の関門は最初の3社で、ここが価格のアンカーになる。', LAST);

  // --- ② 最初の3ヶ月の方針 ---
  r = section_(sheet, r, '② 最初の3ヶ月の方針（最重要）', C.gold, LAST);
  r = kv_(sheet, r, '売上より3社',
    'M1〜M3は売上でなくアンカー3社を作る期間。最初の3社が価格のアンカーを決めるので値引きせず、代わりに初月のリスクを引き受ける（続けないと決めたら請求しない）。', LAST);
  r = kv_(sheet, r, '管理変数',
    '成約数でなく週の接触件数（訪問4件＋手紙6通）。主エンジンは求人を出し続けている事業所への直接接触で、紹介はサブ。実測の成果を持つ顧客が10社そろうまでパイプラインに数えない。', LAST);
  r = kv_(sheet, r, '個人は維持のみ',
    '②紹介（アプリ内ガイド → 体験セッション）の稼働を保つだけ。①一般のライブには着手しない。B2Cの本格化は法人が10社に届いてから。', LAST);
  r = kv_(sheet, r, '無料と有料の線引き',
    '知ることと一回きりの測定は無料。続く測定・やらせる装置・できているの判定から有料。AIが知識の値段を下げたので、配るのは知識でなく測定（チームの実データ）と実行体験。', LAST);

  // --- ③ 中心価値と商品体系 ---
  r = section_(sheet, r, '③ 2つの中心価値と商品体系', C.navy, LAST);

  var cols = [[2, 2], [3, 5], [6, 9], [10, LAST]]; // 対象 / 中心価値 / 入口 / 本体
  var headRow = r;
  ['対象', '中心価値（約束）', '入口（無償）', '本体（有償）'].forEach(function (t, i) {
    put_(sheet, headRow, cols[i][0], t, cols[i][1])
      .setBackground(C.slate).setFontColor(C.white).setFontSize(10).setFontWeight('bold')
      .setHorizontalAlignment('center');
  });
  sheet.setRowHeight(headRow, 24);
  r++;

  var products = [
    ['法人(B2B)', '辞めない店をつくる（定着）。動かすレバーは責任者の関わり方で、最高単価もそこに乗せる。',
     '無料診断 → チーム力学レポート → 解説商談 → 1週間後フォロー（一手の確認）',
     '定着の伴走（年契約・月10万／15万／20万円）／チーム読み解きWS＋自走キット（年50万円）', C.tintBlue],
    ['個人(B2C)', 'プライベートの大切な存在を深く理解してあげられるようになる。',
     '無料診断 →（②紹介）アプリ内ガイド全4章 ／（①一般）3days LIVE・未実装 → 体験セッション',
     '個別コーチングセッション（1on1・高単価）', C.tintOrange]
  ];
  products.forEach(function (p) {
    for (var i = 0; i < 4; i++) {
      put_(sheet, r, cols[i][0], p[i], cols[i][1])
        .setBackground(p[4]).setFontSize(9).setWrap(true).setFontWeight(i === 0 ? 'bold' : 'normal');
    }
    sheet.setRowHeight(r, 46);
    r++;
  });

  // --- ④ 月商目標 ---
  r = section_(sheet, r, '④ 月商目標 ＋ 内訳（2026-08改定価格ベース。M1＝2026年8月）', C.green, LAST);

  var monthHead = ['区分', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'];
  sheet.getRange(r, 2, 1, monthHead.length).setValues([monthHead])
    .setBackground(C.slate).setFontColor(C.white).setFontSize(9).setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setRowHeight(r, 22);
  r++;

  var moneyRows = [
    ['月商目標（合計）', [0, 0, 15, 45, 60, 75, 100, 115, 140, 170, 195, 210], C.tintGold, true, '万'],
    ['└ 法人 月商', [0, 0, 15, 45, 60, 75, 90, 105, 120, 150, 165, 180], C.tintBlue, false, '万'],
    ['└ 法人 契約累計', [0, 1, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13], C.tintBlue, false, '社'],
    ['└ 法人 課金社数', [0, 0, 1, 3, 4, 5, 6, 7, 8, 10, 11, 12], C.tintBlue, false, '社'],
    ['└ 個人 月商（参考）', [0, 0, 0, 0, 0, 0, 10, 10, 20, 20, 30, 30], C.tintOrange, false, '万']
  ];
  moneyRows.forEach(function (row) {
    var cells = [row[0]].concat(row[1].map(function (v) {
      return row[4] === '万' ? (v === 0 ? '¥0' : '¥' + v + '万') : v + '社';
    }));
    sheet.getRange(r, 2, 1, cells.length).setValues([cells])
      .setBackground(row[2]).setFontSize(9).setFontWeight(row[3] ? 'bold' : 'normal')
      .setHorizontalAlignment('center');
    sheet.getRange(r, 2).setHorizontalAlignment('left').setFontWeight('bold');
    sheet.setRowHeight(r, 20);
    r++;
  });

  [
    '※ 法人の月商＝課金社数 × 平均月15万円（規模帯 5〜9名 月10万／10〜19名 月15万／20〜30名 月20万）。課金社数は前月までの契約累計（初月は継続判断が終わるまで計上しない）。初年度は解約ゼロと置いているので、継続率の実測が出た時点で引き直す。チームWS単独（年50万円）は含まない。',
    '※ 旧「月利目標（固定）」（M3 ¥20万 → M12 ¥45万）は、ワークショップ中心だった旧価格前提の数字なので廃止し、改定後の価格で月商として引き直した。経費は交通費・郵送費・ツール代が中心で、粗利率は高い。',
    '※ 個人は②紹介経由の個別コーチングのみの参考値。単価が未確定なので、確定した時点で引き直す。個人_12ヶ月ロードマップは有償ガイド販売を前提にした旧版のままなので、別途の引き直しが要る。'
  ].forEach(function (t) {
    put_(sheet, r, 2, t, LAST).setFontSize(8).setFontColor('#808080').setWrap(true);
    sheet.setRowHeight(r, 26);
    r++;
  });

  // --- ⑤ 設計原則 ---
  r = section_(sheet, r, '⑤ 設計原則・留意点', C.slate, LAST);
  [
    '・ 診断は唯一の共通入口。法人・個人どちらから来ても同じ診断を受ける。',
    '・ 法人受診者がB2Cの入口になる。結果画面の「大切な人にも」導線が波及の起点。',
    '・ 法人は「約束」と「レバー」を分ける。約束＝辞めない店をつくる（定着）、レバー＝責任者の関わり方。約束を直接売ると相見積もりになるが、レバーには代替がない。',
    '・ 定着は機序のレベルで約束する。「離職率が◯%下がる」でなく「辞める理由そのものを減らす」。効果は四半期サーベイと離職率の実数で一緒に見る。',
    '・ セグメントは観測可能な構造条件で切る（単一拠点／5〜30名／中間管理職なし＋トリガー）。業種フォーカスはチャネルであってセグメントではない。',
    '・ 0→1の主エンジンは紹介でなくトリガー観測型の直接接触。顧客0のとき顧客からの紹介は0で、紹介は入力量を自分で決められない。紹介は実測10社の後に主力へ昇格させる。',
    '・ 配るのは知識でなく測定と実行体験。AIが解いたのは「知らない→知っている」の段だけで、「知っているがやらない」「やっているができない」は残る。',
    '・ 自分ごと化は相手の固有情報で起こす（観測の一文 → 本人の回答 → チームの実データ → 本人の1週間）。初回接触では売らない。',
    '・ 価格は相場でなく「人にかけている金」（パート1人分の人件費・年間の採用予算）と比べる。コンサル・研修・性格診断とは名乗らない。',
    '・ チームレポートのM3自動化が年5,000万円の前提条件。手動のままだと約4,800万円で頭打ちになる。'
  ].forEach(function (t) {
    put_(sheet, r, 2, t, LAST).setFontSize(10).setWrap(true);
    sheet.setRowHeight(r, 24);
    r++;
  });

  // --- ⑥ 年5,000万円までの距離 ---
  r = section_(sheet, r, '⑥ 年5,000万円までの距離（12ヶ月の先）', C.navy, LAST);
  [
    ['1人の提供上限', '月3.17時間／社（月次90分＋週次の返答＋オンデマンド＋半期更新）÷ 提供可能86時間／月 ＝ 約27社'],
    ['到達式', '28社 × 平均月15万円 × 12ヶ月 ＝ 5,040万円（＋チームWS単独 年300万円）'],
    ['前提条件', 'チームレポートのM3自動化。手動のままだと25社・約4,800万円で頭打ち'],
    ['本当の制約', '単価でなく継続率。平均24ヶ月続けば、28社の維持に必要な新規は年14社（月1.2社）で足りる'],
    ['12ヶ月時点の位置', '契約13社・月商180万円（年商換算2,160万円）。残りは継続率と自動化で埋める']
  ].forEach(function (kv) {
    r = kv_(sheet, r, kv[0], kv[1], LAST);
  });

  var lastRow = r;

  // --- 全体の書式 ---
  sheet.getRange(1, 1, lastRow, LAST).setFontFamily('Arial').setVerticalAlignment('middle');
  sheet.setColumnWidth(1, 24);
  sheet.setColumnWidth(2, 150);
  for (var c = 3; c <= LAST; c++) {
    sheet.setColumnWidth(c, 66);
  }
  trimSheet_(sheet, lastRow + 2, LAST);
}

/** 値を書いて、必要なら右端まで結合して返す */
function put_(sheet, row, col, value, mergeTo) {
  var span = (mergeTo && mergeTo > col) ? mergeTo - col + 1 : 1;
  var range = sheet.getRange(row, col, 1, span);
  sheet.getRange(row, col).setValue(value);
  if (span > 1) {
    range.merge();
  }
  return range;
}

/** 見出し行 */
function section_(sheet, row, text, color, lastCol) {
  put_(sheet, row, 2, text, lastCol)
    .setBackground(color).setFontColor(C.white).setFontSize(11).setFontWeight('bold');
  sheet.setRowHeight(row, 24);
  return row + 1;
}

/** ラベル（B列）＋ 本文（C列〜右端） */
function kv_(sheet, row, label, value, lastCol) {
  put_(sheet, row, 2, label)
    .setBackground(C.offWhite).setFontSize(10).setFontWeight('bold').setWrap(true);
  put_(sheet, row, 3, value, lastCol)
    .setFontSize(10).setWrap(true);
  sheet.setRowHeight(row, 34);
  return row + 1;
}

/* ============================================================
 * 1. 法人_12ヶ月ロードマップ
 * ============================================================ */

function buildB2bRoadmap_(sheet) {
  var title = '法人（B2B）12ヶ月 事業ロードマップ（2026-08改定・0→1起点）';
  var subtitle = '約束：辞めない店をつくる（定着）　／　レバー：責任者の関わり方　／　商品：定着の伴走（年契約・月10万／15万／20万円）＋チームWS単独（年50万円）　／　0→1の主エンジン：トリガー観測型の直接接触（週7〜8件の接触が管理変数）';

  var header = ['月', 'フェーズ', '今月の主眼', '主要タスク', 'KPI / 完了の定義', '月商 目安（伴走）', ''];

  // [月, 実月, フェーズ, 主眼, 主要タスク, KPI, 月商]
  var rows = [
    ['M1', '2026年8月', '0→1', '接触の器を作り、毎週の獲得を回し始める',
     '観測台帳を100件作る（求人を出し続けている事業所を求人媒体・Googleマップから）。声かけ・手紙・1週間後フォロー・事例化合意の文面一式を作る。結果画面のレポート申込フック（③のみ表示）を実装。週7〜8件の接触を開始する。',
     '台帳100件 / 接触40件 / 文面一式の完成 / 歩留まりの初期実数', '¥0'],
    ['M2', '2026年9月', '0→1', '商談を回し、初契約を取る',
     '接触を継続（週7〜8件）。診断 → チーム受診 → レポート解説商談の一本を実際に通す。キックオフ90分の進行設計を作る。4週較正で歩留まりを全段引き直す。',
     '累計接触80件 / 商談5〜8件 / 初契約1社（初月は請求しない）/ 較正1回目', '¥0'],
    ['M3', '2026年10月', '0→1', 'アンカー3社を作り、価格を確かめる',
     '契約を3社まで積む。初月で価値を渡し切る（キックオフでトリセツを全員分作り切る）。価格実験の記録を10件ためる。事例化の合意を取る。',
     '契約累計3社 / 課金1社 / 価格記録10件 / 断り理由の分布', '¥15万'],
    ['M4', '2026年11月', '反復', '型の再現性を確かめる',
     '週次チェックインと月次レビューを実運用に乗せる。接触量は落とさない（週7〜8件）。訪問・手紙・業種別の歩留まりを比べ、入力の配分を変える。',
     '契約累計4社 / 課金3社 / 週次チェックイン稼働 / チャネル別歩留まりの確定', '¥45万'],
    ['M5', '2026年12月', '反復', '3ヶ月の成果を初めて検証する',
     '最初の顧客で3ヶ月成果の3点セット（上がってくる情報の変化・指名した1人・全員分のトリセツ）を確認する。数字をそのまま事例素材にする。登壇・組合へ2件打診。',
     '3ヶ月成果の確認1社 / 事例素材1件 / 契約累計5社', '¥60万'],
    ['M6', '2027年1月', '反復', '事例で歩留まりを上げる',
     '実測の数字を持って接触の一文目と商談の入りを更新する。紹介askを2つの瞬間（初月の継続判断の直後・3ヶ月成果の確認直後）でルーチン化する。',
     '契約累計6社 / 紹介ask実施率100% / 事例2件', '¥75万'],
    ['M7', '2027年2月', '10社', '獲得の再現を確定させる',
     '接触→契約の歩留まりを運用値として固定する。半期レポート更新の1回目を実施。チームレポートのM3自動化に着手する。',
     '契約累計7社 / 半期更新1社 / 自動化の設計完了', '¥90万'],
    ['M8', '2027年3月', '10社', '提供の型を、人に渡せる形にする',
     'キックオフと月次レビューの進行を手順書化する（属人性の解体の第一歩）。チームワークショップの単独販売を1件。',
     '契約累計8社 / 手順書v1 / WS単独1件', '¥105万'],
    ['M9', '2027年4月', '10社', '0→1を完了させる（10社）',
     '契約10社に到達する。継続率と解約理由を初めて集計する。紹介を主エンジンへ昇格させるかを、実測で判断する。',
     '契約累計10社 / 課金8社 / 継続率の初集計', '¥120万'],
    ['M10', '2027年5月', '積み上げ', '紹介と事例を主線に切り替える',
     '事例3件を公開できる形にする。紹介経由をパイプラインに算入し始める。接触量を週5〜6件へ再配分し、空いた時間を提供に回す。',
     '契約累計11社 / 紹介経由の商談1件 / 事例3件', '¥150万'],
    ['M11', '2027年6月', '積み上げ', '自動化で提供の上限を上げる',
     'チームレポートのM3自動化を稼働させ、半期更新を1件30分にする。1社あたりの実工数を測り直す。',
     '自動化の稼働 / 契約累計12社 / 工数の実測値', '¥165万'],
    ['M12', '2027年7月', '積み上げ', '28社への設計を確定する',
     '年次更新の1件目をクローズする。継続24ヶ月を前提に、必要な新規（月1.2社）を再計算する。次年の獲得計画と、共通言語・GEOの種まきを開始する。',
     '年次更新1社 / 契約累計13社 / 次年計画の確定', '¥180万']
  ];

  var notes = [
    '※ 月商は「定着の伴走」のみの目安。規模帯別（5〜9名 月10万／10〜19名 月15万／20〜30名 月20万）の平均を月15万円として計算し、初月は継続判断が終わるまで売上に数えない（保守側で計上）。チームWS単独（年50万円）とスポットは含まない。',
    '※ 0_全体サマリーの「月利目標（固定）」は、ワークショップ中心だった旧価格前提の数字なので本シートとは接続していない。改定後の価格（法人中心価値とファネル.md §2.7）で再設定が必要。',
    '※ 管理変数は成約数でなく週の接触件数（訪問4件＋手紙6通）。成約は歩留まり×入力の結果であって、直接は操作できない（0to1マーケティング戦略.md §3.4・§7.1）。',
    '※ 出典：法人中心価値とファネル.md（中心価値・価格・商品定義）／0to1マーケティング戦略.md（獲得の主エンジン・90日の運用）。'
  ];

  // --- 値の書き込み ---
  sheet.getRange(1, 1).setValue(title);
  sheet.getRange(2, 1).setValue(subtitle);
  sheet.getRange(3, 1, 1, header.length).setValues([header]);

  var body = rows.map(function (r) {
    return [r[0] + '\n' + r[1], r[2], r[3], r[4], r[5], r[6], ''];
  });
  sheet.getRange(4, 1, body.length, header.length).setValues(body);

  var noteStart = 4 + body.length + 1;
  notes.forEach(function (t, i) {
    sheet.getRange(noteStart + i, 1).setValue(t);
  });

  // --- 書式 ---
  var lastRow = noteStart + notes.length - 1;
  sheet.getRange(1, 1, lastRow, 7).setFontFamily('Arial').setVerticalAlignment('middle');

  sheet.getRange(1, 1, 1, 7).merge()
    .setBackground(C.navy).setFontColor(C.white).setFontSize(14).setFontWeight('bold');
  sheet.getRange(2, 1, 1, 7).merge()
    .setBackground(C.blue).setFontColor(C.white).setFontSize(10).setFontWeight('bold').setWrap(true);
  sheet.getRange(3, 1, 1, 7)
    .setBackground(C.slate).setFontColor(C.white).setFontSize(10).setFontWeight('bold').setWrap(true)
    .setHorizontalAlignment('center');
  sheet.getRange(3, 6, 1, 2).merge();

  var phaseColor = {
    '0→1': C.tintBlue,
    '反復': C.tintGold,
    '10社': C.tintGreen,
    '積み上げ': C.tintOrange
  };

  for (var i = 0; i < body.length; i++) {
    var r = 4 + i;
    sheet.getRange(r, 1)
      .setBackground(C.navy).setFontColor(C.white).setFontSize(10).setFontWeight('bold')
      .setHorizontalAlignment('center').setWrap(true);
    sheet.getRange(r, 2)
      .setBackground(phaseColor[rows[i][2]] || C.offWhite).setFontSize(9).setFontWeight('bold')
      .setHorizontalAlignment('center').setWrap(true);
    sheet.getRange(r, 3).setBackground(C.offWhite).setFontSize(9).setWrap(true);
    sheet.getRange(r, 4, 1, 2).setBackground(C.white).setFontSize(9).setWrap(true);
    sheet.getRange(r, 6, 1, 2).merge()
      .setBackground(C.tintGold).setFontSize(10).setFontWeight('bold')
      .setHorizontalAlignment('center');
    sheet.setRowHeight(r, 64);
  }

  for (var j = 0; j < notes.length; j++) {
    sheet.getRange(noteStart + j, 1, 1, 7).merge().setFontSize(9).setWrap(true);
    sheet.setRowHeight(noteStart + j, 30);
  }

  sheet.getRange(3, 1, 1 + body.length, 7)
    .setBorder(true, true, true, true, true, true, '#BFBFBF', SpreadsheetApp.BorderStyle.SOLID);

  var widths = [56, 70, 150, 350, 230, 120, 60];
  widths.forEach(function (w, idx) { sheet.setColumnWidth(idx + 1, w); });
  sheet.setRowHeight(1, 32);
  sheet.setRowHeight(2, 44);
  sheet.setRowHeight(3, 30);
  sheet.setFrozenRows(3);
  trimSheet_(sheet, lastRow + 2, 8);
}

/* ============================================================
 * 2. 90日WBS_アクション
 * ============================================================ */

function buildNinetyDayWbs_(sheet) {
  var WEEKS = ['W1\n8/10', 'W2\n8/17', 'W3\n8/24', 'W4\n8/31', 'W5\n9/7', 'W6\n9/14',
               'W7\n9/21', 'W8\n9/28', 'W9\n10/5', 'W10\n10/12', 'W11\n10/19', 'W12\n10/26'];

  var title = '90日 事業開発WBS（0→1：アンカー3社をつくる）／ 主エンジンはトリガー観測型の直接接触';
  var months = [
    ['1ヶ月目（M1：器を作り、接触を開始する）', C.navy],
    ['2ヶ月目（M2：商談を回し、初契約を取る）', C.blue],
    ['3ヶ月目（M3：アンカー3社と、歩留まりの較正）', C.green]
  ];

  // トラックごとの配色（A列の色・B列の地色・バーの色）
  var TRACK = {
    '準備':      { head: C.gray,   tint: C.tintGray,      bar: C.barGray },
    '獲得':      { head: C.navy,   tint: C.tintBlue,      bar: C.barBlue },
    '商談・契約': { head: C.blue,   tint: C.tintSky,       bar: C.barLightBlue },
    '提供':      { head: C.green,  tint: C.tintGreen,     bar: C.barGreen },
    '実装':      { head: C.steel,  tint: C.tintGrayLight, bar: C.barIndigo },
    '計測':      { head: C.gold,   tint: C.tintGold,      bar: C.barGold },
    '個人(B2C)': { head: C.orange, tint: C.tintOrange,    bar: C.barOrange }
  };

  // [トラック, アクション, 担当, [[開始W, 終了W], ...], マイルストーンか]
  var tasks = [
    ['準備', '観測台帳を作る（求人を出し続けている事業所を100件）', '自分', [[1, 2]], false],
    ['準備', '台帳の週次補充（10件/週）と優先順位の並べ直し', '自分', [[3, 12]], false],
    ['準備', '文面一式（声かけ・手紙・1週間後フォロー）を作る', '自分', [[1, 2]], false],
    ['準備', '事例化合意のひな形を作る', '自分', [[2, 2]], false],
    ['準備', '商談台本の更新（AI反論の返し・自分ごと化の原則）', '自分', [[2, 3]], false],
    ['準備', 'キックオフ90分の進行設計', '自分', [[3, 4]], false],
    ['準備', '月次レビュー90分の進行台本', '自分', [[5, 6]], false],

    ['獲得', '訪問（客として行き、名乗り、3分の診断を依頼）4件/週', '自分', [[2, 12]], false],
    ['獲得', '手紙6通/週（一文目に観測事実）＋1〜2週後の後追い', '自分', [[2, 12]], false],
    ['獲得', '登壇・組合への打診（その場で全員がQR診断）', '自分', [[4, 5], [8, 9]], false],
    ['獲得', '接触反応（A営業の棚／B観測が効いた／C自分ごと化）の記録', '自分', [[2, 12]], false],

    ['商談・契約', '診断 → チーム力学レポート申込のフォロー', '自分', [[3, 12]], false],
    ['商談・契約', 'チーム受診の運用（team_ ref 発行・受診率80%）', '自分', [[4, 12]], false],
    ['商談・契約', 'レポート解説商談（地図 → 当てにいく → 打ち手）', '自分', [[4, 12]], false],
    ['商談・契約', '1週間後フォロー送信（宿題の確認・無料ラダーの終端）', '自分', [[5, 12]], false],
    ['商談・契約', '◆ 60日：初契約1社（年契約・初月は請求しない）', '自分', [[8, 8]], true],
    ['商談・契約', '◆ 90日：アンカー3社（課金2ヶ月目に入った状態）', '自分', [[12, 12]], true],

    ['提供', 'キックオフ90分（その場で全員分のトリセツを作り切る）', '自分', [[7, 12]], false],
    ['提供', '週次チェックイン（3問・1分）の運用開始', '自分', [[8, 12]], false],
    ['提供', '初月の継続判断と、1回目の月次レビュー', '自分', [[11, 12]], false],

    ['実装', '結果画面のレポート申込フック（③のみ表示）', '自分', [[1, 3]], false],
    ['実装', '週次チェックインのフォームと蓄積先（apps-script）', '自分', [[5, 6]], false],
    ['実装', 'トリセツ・見取り図・関わりの記録を集約する共有シートの型', '自分', [[6, 7]], false],
    ['実装', 'チームレポートのM3自動化に着手', '自分', [[10, 12]], false],

    ['計測', '◆ 30日：器の完成（台帳100件・接触40件・文面一式）', '自分', [[4, 4]], true],
    ['計測', '4週較正（全段の歩留まりを実数で引き直す）', '自分', [[5, 5]], false],
    ['計測', '8週較正／価格実験10件（提示・反応・断り理由）の集計', '自分', [[9, 9]], false],
    ['計測', '◆ 歩留まり基準の確定と、10社までのパイプライン計画', '自分', [[12, 12]], true],

    ['個人(B2C)', '②紹介の稼働維持（アプリ内ガイド → 体験セッション）', '自分', [[1, 12]], false]
  ];

  var note = '方針：90日の管理変数は成約数でなく週の接触件数（訪問4件＋手紙6通）。提供や商談の都合で接触ブロックを削らないことが、この運用の唯一の禁則。無料で配るのは知識でなく測定（診断・チーム力学レポート）と実行体験（1週間後フォロー）で、続く測定・やらせる装置・できているの判定から有料にする。詳細は 0to1マーケティング戦略.md。';

  var totalCols = 3 + WEEKS.length; // A〜O
  var firstDataRow = 4;

  // --- 値の書き込み ---
  sheet.getRange(1, 1).setValue(title);
  sheet.getRange(2, 4).setValue(months[0][0]);
  sheet.getRange(2, 8).setValue(months[1][0]);
  sheet.getRange(2, 12).setValue(months[2][0]);
  sheet.getRange(3, 1, 1, 3).setValues([['トラック', 'アクション', '担当/状態']]);
  sheet.getRange(3, 4, 1, WEEKS.length).setValues([WEEKS]);

  var values = tasks.map(function (t) { return [t[0], t[1], t[2]]; });
  sheet.getRange(firstDataRow, 1, values.length, 3).setValues(values);

  var noteRow = firstDataRow + values.length + 1;
  sheet.getRange(noteRow, 1).setValue(note);

  // --- 書式 ---
  sheet.getRange(1, 1, noteRow, totalCols).setFontFamily('Arial').setVerticalAlignment('middle');

  sheet.getRange(1, 1, 1, totalCols).merge()
    .setBackground(C.slate).setFontColor(C.white).setFontSize(13).setFontWeight('bold');

  [[4, months[0][1]], [8, months[1][1]], [12, months[2][1]]].forEach(function (m) {
    sheet.getRange(2, m[0], 1, 4).merge()
      .setBackground(m[1]).setFontColor(C.white).setFontSize(9).setFontWeight('bold')
      .setHorizontalAlignment('center').setWrap(true);
  });

  sheet.getRange(3, 1, 1, 3)
    .setBackground(C.slate).setFontColor(C.white).setFontSize(9).setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange(3, 4, 1, WEEKS.length)
    .setBackground(C.steel).setFontColor(C.white).setFontSize(8).setFontWeight('bold')
    .setHorizontalAlignment('center').setWrap(true);

  for (var i = 0; i < tasks.length; i++) {
    var r = firstDataRow + i;
    var t = tasks[i];
    var style = TRACK[t[0]];

    sheet.getRange(r, 1)
      .setBackground(style.head).setFontColor(C.white).setFontSize(8).setFontWeight('bold')
      .setHorizontalAlignment('center');
    sheet.getRange(r, 2)
      .setBackground(t[4] ? C.tintGold : style.tint).setFontSize(9).setFontWeight(t[4] ? 'bold' : 'normal');
    sheet.getRange(r, 3)
      .setBackground(C.offWhite).setFontSize(8).setHorizontalAlignment('center');

    // 週の帯（まず全週を薄いグリッド色で塗り、その上にバーを重ねる）
    sheet.getRange(r, 4, 1, WEEKS.length).setBackground(C.cellGrid);

    t[3].forEach(function (span) {
      var from = span[0];
      var to = span[1];
      var range = sheet.getRange(r, 3 + from, 1, to - from + 1);
      if (t[4]) {
        range.setBackground(C.gold).setValue('◆')
          .setFontColor(C.white).setFontSize(11).setFontWeight('bold')
          .setHorizontalAlignment('center');
      } else {
        range.setBackground(style.bar);
      }
    });

    sheet.setRowHeight(r, 24);
  }

  sheet.getRange(noteRow, 1, 1, totalCols).merge().setFontSize(9).setWrap(true);
  sheet.setRowHeight(noteRow, 46);

  sheet.getRange(3, 1, 1 + tasks.length, totalCols)
    .setBorder(true, true, true, true, true, true, '#D9D9D9', SpreadsheetApp.BorderStyle.SOLID);

  sheet.setColumnWidth(1, 78);
  sheet.setColumnWidth(2, 340);
  sheet.setColumnWidth(3, 58);
  for (var c = 4; c <= totalCols; c++) {
    sheet.setColumnWidth(c, 52);
  }
  sheet.setRowHeight(1, 30);
  sheet.setRowHeight(2, 26);
  sheet.setRowHeight(3, 30);
  sheet.setFrozenRows(3);
  sheet.setFrozenColumns(3);
  trimSheet_(sheet, noteRow + 2, totalCols);
}

/** 余った行と列を削って見た目を締める */
function trimSheet_(sheet, keepRows, keepCols) {
  var maxRows = sheet.getMaxRows();
  if (maxRows > keepRows) {
    sheet.deleteRows(keepRows + 1, maxRows - keepRows);
  }
  var maxCols = sheet.getMaxColumns();
  if (maxCols > keepCols) {
    sheet.deleteColumns(keepCols + 1, maxCols - keepCols);
  }
}
