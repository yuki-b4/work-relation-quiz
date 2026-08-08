/**
 * 観測台帳をつくるスクリプト（0→1の獲得エンジンの器）。
 *
 * 作るシート（4枚）
 *   - 観測台帳            … 声をかける候補のプール（目標100件）。外から観測できる変数だけで並べる
 *   - 接触ログ            … 1接触＝1行。接触反応・価格実験・断り理由をここに残す
 *   - 週次サマリー        … 管理変数（週の接触件数）と歩留まりの自動集計
 *   - マスタ_選択肢と配点 … プルダウンの選択肢と、優先スコアの配点表
 *
 * 設計の芯（0to1マーケティング戦略.md §3.2・§3.6.3・§7.3／法人中心価値とファネル.md §3.1.3〜3.1.5）
 *   - **台帳には、外から観測できる変数しか置かない。** 決裁の独立性・原資・育成志向などの適合条件は、
 *     接触して初めて分かるので境界に使えない。判定は接触ログ側に置く。
 *   - **管理するのは成約数でなく週の接触件数。** 週次サマリーの「目標差」が唯一の禁則の見張り役になる。
 *   - **「営業と思われたか」を検知する。** 接触反応をA（営業の棚）／B（観測が効いた）／C（自分ごと化成立）で残し、
 *     歩留まりが落ちたときに入り方の問題か依頼の問題かを切り分ける。
 *
 * 使い方（1回だけ）
 *   1. 事業ロードマップブックを開き、拡張機能 ▶ Apps Script
 *   2. このファイルの中身を全部コピペして保存
 *   3. 関数 createObservationLedger を選んで実行（初回は承認が必要）
 *
 * 安全設計
 *   - **既にあるシートには一切触らない。** 同名シートがあればスキップする（実データを消さないため、
 *     UpdateRoadmapSheets.gs のような「作り直し」はしない）。
 *   - 既存の `ターゲット10社リスト` も残る。あちらは紹介起点の配点なので、観測起点の運用はこの台帳へ移す。
 */

var LG_TZ = 'Asia/Tokyo';
var LG_ROWS = 120;   // 観測台帳の行数（目標100件＋余白）
var LG_LOG_ROWS = 400; // 接触ログの行数
var LG_START = '2026/08/10'; // 週次サマリーのW1（月曜）

var LG = {
  navy: '#1F4E79',
  slate: '#2C3E50',
  blue: '#2E75B6',
  steel: '#5B7C99',
  green: '#375623',
  gold: '#BF8F00',
  white: '#FFFFFF',
  auto: '#EDF2F7',      // 自動計算列の地色
  head: '#F2F2F2',
  tintBlue: '#DAEEF3',
  tintGold: '#FFF2CC',
  tintGreen: '#E2EFDA',
  tintRed: '#FBE7E1',
  tintGray: '#EFEFEF',
  note: '#808080'
};

/* 選択肢と配点（マスタシートの初期値。運用中はシート側を編集する） */
var LG_TRADES = [
  ['珈琲屋・カフェ', 30], ['美容室・サロン', 25], ['小規模宿・ゲストハウス', 25],
  ['学習塾', 20], ['フィットネス・小規模ジム', 20], ['整骨院・接骨院', 15],
  ['歯科医院', 15], ['クリニック', 15], ['小規模介護・保育', 10],
  ['飲食（カフェ以外）', 20], ['その他', 5]
];
var LG_TRIGGERS = [
  ['求人を出し続けている', 30], ['急募・アットホームの文言', 20],
  ['新店・増床・増員', 15], ['代替わり・事業承継', 15], ['なし・不明', 0]
];
var LG_LISTS = {
  yesNo: ['はい', 'いいえ', '不明'],
  middle: ['なし', 'あり', '不明'],
  titles: ['店長', 'オーナー店長', 'オーナー', '院長', '施設長', '園長', '所長', '支配人', '女将', '室長', 'マネージャー', '不明'],
  sources: ['Indeed', '求人ボックス', 'タウンワーク', 'Googleマップ', '店頭の貼り紙', 'SNS', '紹介', 'その他'],
  channels: ['訪問', '手紙', '登壇', '保留'],
  status: ['未接触', '接触済', '診断実施', 'レポート申込', 'チーム受診中', '商談済', '契約', '見送り', '対象外'],
  logChannels: ['訪問', '手紙', '手紙の後追い', '登壇', '紹介', 'その他'],
  reactions: ['A 営業の棚', 'B 観測が効いた', 'C 自分ごと化成立'],
  priceBands: ['未提示', '5〜9名 月10万', '10〜19名 月15万', '20〜30名 月20万'],
  priceReactions: ['即決', '持ち帰り', '高いと言われた', '保留', '断り'],
  declines: ['比較対象がコンサル', 'AIで足りている', '時期が合わない', '価格', '必要性を感じない', '担当者が違う', 'その他'],
  check: ['○']
};

function createObservationLedger() {
  var ss = SpreadsheetApp.getActive();
  var done = [];
  done.push(lgCreate_(ss, 'マスタ_選択肢と配点', lgBuildMaster_));
  done.push(lgCreate_(ss, '観測台帳', lgBuildLedger_));
  done.push(lgCreate_(ss, '接触ログ', lgBuildLog_));
  done.push(lgCreate_(ss, '週次サマリー', lgBuildWeekly_));
  ss.toast(done.join(' / '), '観測台帳', 20);
  Logger.log(done.join('\n'));
}

/** 同名シートが無いときだけ作る（実データを消さない） */
function lgCreate_(ss, name, builder) {
  if (ss.getSheetByName(name)) {
    return name + ' は既にあるので作りません';
  }
  var sheet = ss.insertSheet(name, ss.getNumSheets());
  builder(sheet);
  return name + ' を作成';
}

/* ============================================================
 * マスタ_選択肢と配点
 * ============================================================ */

function lgBuildMaster_(sheet) {
  sheet.getRange(1, 1).setValue('観測台帳｜選択肢と配点（この表を編集すると台帳の判定とスコアに反映されます）')
    .setFontSize(12).setFontWeight('bold').setFontColor(LG.white).setBackground(LG.slate);

  var blocks = [
    { col: 1, title: '業種（チャネルとしての到達しやすさ）', head: ['選択肢', '配点'], rows: LG_TRADES },
    { col: 4, title: 'トリガー（今この瞬間の痛み）', head: ['選択肢', '配点'], rows: LG_TRIGGERS }
  ];
  blocks.forEach(function (b) {
    sheet.getRange(2, b.col, 1, 2).merge().setValue(b.title)
      .setBackground(LG.navy).setFontColor(LG.white).setFontWeight('bold').setFontSize(9);
    sheet.getRange(3, b.col, 1, 2).setValues([b.head])
      .setBackground(LG.head).setFontWeight('bold').setFontSize(9);
    sheet.getRange(4, b.col, b.rows.length, 2).setValues(b.rows).setFontSize(9);
    sheet.getRange(4, b.col + 1, b.rows.length, 1).setHorizontalAlignment('center');
  });

  // 単票の選択肢リスト（G列以降に縦に置く）
  var lists = [
    ['単一拠点', LG_LISTS.yesNo],
    ['中間管理職', LG_LISTS.middle],
    ['時給・シフト中心', LG_LISTS.yesNo],
    ['責任者の呼び名', LG_LISTS.titles],
    ['出所', LG_LISTS.sources],
    ['予定チャネル', LG_LISTS.channels],
    ['ステータス', LG_LISTS.status],
    ['接触チャネル', LG_LISTS.logChannels],
    ['接触反応', LG_LISTS.reactions],
    ['提示価格帯', LG_LISTS.priceBands],
    ['提示への反応', LG_LISTS.priceReactions],
    ['断り理由', LG_LISTS.declines],
    ['チェック', LG_LISTS.check]
  ];
  lists.forEach(function (l, i) {
    var col = 7 + i;
    sheet.getRange(2, col).setValue(l[0])
      .setBackground(LG.navy).setFontColor(LG.white).setFontWeight('bold').setFontSize(9).setWrap(true);
    sheet.getRange(3, col, l[1].length, 1)
      .setValues(l[1].map(function (v) { return [v]; })).setFontSize(9);
  });

  var noteRow = 4 + Math.max(LG_TRADES.length, LG_TRIGGERS.length) + 2;
  [
    '■ 優先スコアの考え方（満点100点）',
    '　業種（最大30）＋ トリガー（最大30）＋ 求人の継続週数（8週以上20／4週以上10）＋ 境界判定（適合20／要確認10）＋ 時給・シフト中心なら5',
    '　A＝70点以上／B＝50〜69／C＝49以下。境界が「対象外」なら除外。',
    '',
    '■ なぜこの5つだけで採点するのか',
    '　どれも会う前に外から観測できるから。決裁の独立性・原資・育成志向は「適合条件」で、接触して初めて分かるので台帳には置かない。',
    '　（法人中心価値とファネル.md §3.1.5 の3層：境界＝リスト作成／適合条件＝商談前後の選別／認識＝商談で作る）',
    '',
    '■ 境界判定のルール',
    '　推定人数5〜30名 かつ 単一拠点＝はい かつ 中間管理職＝なし → 適合。人数が範囲外、単一拠点＝いいえ、中間管理職＝あり のいずれかで対象外。未入力があれば要確認。',
    '　時給・シフト中心は境界に使わず加点で扱う（提供形態がこちらに有利になる条件であって、悩みの形を決める条件ではないため）。'
  ].forEach(function (t, i) {
    sheet.getRange(noteRow + i, 1).setValue(t).setFontSize(9);
  });

  sheet.setColumnWidth(1, 200); sheet.setColumnWidth(2, 60);
  sheet.setColumnWidth(3, 24);
  sheet.setColumnWidth(4, 200); sheet.setColumnWidth(5, 60);
  sheet.setColumnWidth(6, 24);
  for (var c = 7; c <= 19; c++) { sheet.setColumnWidth(c, 120); }
  sheet.setFrozenRows(3);
  lgTrim_(sheet, noteRow + 12, 19);
}

/* ============================================================
 * 観測台帳
 * ============================================================ */

function lgBuildLedger_(sheet) {
  var HEAD = [
    'No.', '事業所名', '業種', 'エリア', '責任者の呼び名', '推定人数', '単一拠点', '中間管理職', '時給・シフト中心',
    '境界判定', 'トリガー', '掲載開始日', '継続週数', '観測メモ（一文目に使う具体）', '出所',
    'スコア', 'ランク', '予定チャネル', 'ステータス', '接触回数', '最終接触日', '直近の反応', '次アクション', '期限', '備考'
  ];
  var AUTO = [10, 13, 16, 17, 20, 21, 22]; // 自動計算列（1始まり）
  var TOP = 3;                              // ヘッダ行
  var FIRST = TOP + 1;                      // データ開始行

  sheet.getRange(1, 1).setValue('観測台帳（声をかける候補のプール）')
    .setFontSize(13).setFontWeight('bold').setFontColor(LG.white).setBackground(LG.slate);
  sheet.getRange(1, 14).setValue('※ ここに置くのは外から観測できる変数だけ。会って分かることは接触ログへ。')
    .setFontSize(9).setFontColor(LG.note);

  // KPI行（今週どこへ声をかけるかを、この行だけで決められるようにする）
  var last = FIRST + LG_ROWS - 1;
  var kpis = [
    [1, '在庫', '=COUNTA($B$' + FIRST + ':$B$' + last + ')&" 件 / 目標100件"'],
    [4, '適合', '=COUNTIF($J$' + FIRST + ':$J$' + last + ',"適合")&" 件"'],
    [6, 'Aランク', '=COUNTIF($Q$' + FIRST + ':$Q$' + last + ',"A")&" 件"'],
    [8, 'A×未接触', '=COUNTIFS($Q$' + FIRST + ':$Q$' + last + ',"A",$S$' + FIRST + ':$S$' + last + ',"未接触")&" 件"'],
    [11, '契約', '=COUNTIF($S$' + FIRST + ':$S$' + last + ',"契約")&" 件"']
  ];
  kpis.forEach(function (k) {
    sheet.getRange(2, k[0]).setValue(k[1])
      .setBackground(LG.navy).setFontColor(LG.white).setFontWeight('bold').setFontSize(9)
      .setHorizontalAlignment('center');
    sheet.getRange(2, k[0] + 1).setFormula(k[2])
      .setBackground(LG.tintGold).setFontWeight('bold').setFontSize(9);
  });
  sheet.getRange(2, 14).setValue('今週の声かけ先は「A×未接触」から取る。ここが尽きたら台帳を補充する（週10件）。')
    .setFontSize(9).setFontColor(LG.note);

  sheet.getRange(TOP, 1, 1, HEAD.length).setValues([HEAD])
    .setBackground(LG.slate).setFontColor(LG.white).setFontWeight('bold').setFontSize(9)
    .setWrap(true).setHorizontalAlignment('center');
  AUTO.forEach(function (c) {
    sheet.getRange(TOP, c).setBackground(LG.steel);
  });

  // 連番（固定値。接触ログはこのNo.で紐づく）
  var ids = [];
  for (var i = 0; i < LG_ROWS; i++) { ids.push([i + 1]); }
  sheet.getRange(FIRST, 1, LG_ROWS, 1).setValues(ids)
    .setHorizontalAlignment('center').setFontSize(9).setFontColor(LG.note);

  // 自動計算列
  var fJ = [], fM = [], fPQ = [], fTUV = [];
  for (var r = FIRST; r <= last; r++) {
    fJ.push(['=IF($B' + r + '="","",IF(OR($G' + r + '="いいえ",$H' + r + '="あり"),"対象外",' +
      'IF(OR($F' + r + '="",$G' + r + '="",$H' + r + '=""),"要確認",' +
      'IF(AND($F' + r + '>=5,$F' + r + '<=30),"適合","対象外"))))']);
    fM.push(['=IF($L' + r + '="","",ROUNDDOWN((TODAY()-$L' + r + ')/7))']);
    fPQ.push([
      '=IF($B' + r + '="","",IF($J' + r + '="対象外",0,' +
      'IFERROR(VLOOKUP($C' + r + ",'マスタ_選択肢と配点'!$A$4:$B$" + (3 + LG_TRADES.length) + ',2,FALSE),5)' +
      '+IFERROR(VLOOKUP($K' + r + ",'マスタ_選択肢と配点'!$D$4:$E$" + (3 + LG_TRIGGERS.length) + ',2,FALSE),0)' +
      '+IF($M' + r + '="",0,IF($M' + r + '>=8,20,IF($M' + r + '>=4,10,0)))' +
      '+IF($J' + r + '="適合",20,10)' +
      '+IF($I' + r + '="はい",5,0)))',
      '=IF($B' + r + '="","",IF($J' + r + '="対象外","除外",IF($P' + r + '>=70,"A",IF($P' + r + '>=50,"B","C"))))'
    ]);
    fTUV.push([
      '=IF($B' + r + '="","",COUNTIF(\'接触ログ\'!$B:$B,$A' + r + '))',
      '=IF(N($T' + r + ')=0,"",MAXIFS(\'接触ログ\'!$A:$A,\'接触ログ\'!$B:$B,$A' + r + '))',
      '=IF(N($T' + r + ')=0,"",IFERROR(LOOKUP(2,1/((\'接触ログ\'!$B$4:$B$' + (3 + LG_LOG_ROWS) + '=$A' + r + ')' +
        '*(\'接触ログ\'!$F$4:$F$' + (3 + LG_LOG_ROWS) + '<>"")),\'接触ログ\'!$F$4:$F$' + (3 + LG_LOG_ROWS) + '),""))'
    ]);
  }
  sheet.getRange(FIRST, 10, LG_ROWS, 1).setFormulas(fJ);
  sheet.getRange(FIRST, 13, LG_ROWS, 1).setFormulas(fM);
  sheet.getRange(FIRST, 16, LG_ROWS, 2).setFormulas(fPQ);
  sheet.getRange(FIRST, 20, LG_ROWS, 3).setFormulas(fTUV);

  AUTO.forEach(function (c) {
    sheet.getRange(FIRST, c, LG_ROWS, 1).setBackground(LG.auto).setFontSize(9)
      .setHorizontalAlignment('center');
  });
  sheet.getRange(FIRST, 21, LG_ROWS, 1).setNumberFormat('yyyy/mm/dd');
  sheet.getRange(FIRST, 22, LG_ROWS, 1).setHorizontalAlignment('left');
  sheet.getRange(FIRST, 12, LG_ROWS, 1).setNumberFormat('yyyy/mm/dd');
  sheet.getRange(FIRST, 24, LG_ROWS, 1).setNumberFormat('yyyy/mm/dd');
  sheet.getRange(FIRST, 2, LG_ROWS, 8).setFontSize(9);
  sheet.getRange(FIRST, 14, LG_ROWS, 2).setFontSize(9).setWrap(true);
  sheet.getRange(FIRST, 18, LG_ROWS, 2).setFontSize(9);
  sheet.getRange(FIRST, 23, LG_ROWS, 3).setFontSize(9).setWrap(true);

  // プルダウン（業種とトリガーはマスタの配点表を参照する）
  lgValidateFromMaster_(sheet, FIRST, 3, LG_ROWS, 'A', LG_TRADES.length);
  lgValidateFromMaster_(sheet, FIRST, 11, LG_ROWS, 'D', LG_TRIGGERS.length);
  lgValidateList_(sheet, FIRST, 5, LG_ROWS, LG_LISTS.titles);
  lgValidateList_(sheet, FIRST, 7, LG_ROWS, LG_LISTS.yesNo);
  lgValidateList_(sheet, FIRST, 8, LG_ROWS, LG_LISTS.middle);
  lgValidateList_(sheet, FIRST, 9, LG_ROWS, LG_LISTS.yesNo);
  lgValidateList_(sheet, FIRST, 15, LG_ROWS, LG_LISTS.sources);
  lgValidateList_(sheet, FIRST, 18, LG_ROWS, LG_LISTS.channels);
  lgValidateList_(sheet, FIRST, 19, LG_ROWS, LG_LISTS.status);

  // 色分け
  var rules = [
    lgRule_(sheet.getRange(FIRST, 17, LG_ROWS, 1), 'A', LG.tintGreen),
    lgRule_(sheet.getRange(FIRST, 17, LG_ROWS, 1), 'B', LG.tintGold),
    lgRule_(sheet.getRange(FIRST, 17, LG_ROWS, 1), '除外', LG.tintRed),
    lgRule_(sheet.getRange(FIRST, 10, LG_ROWS, 1), '適合', LG.tintGreen),
    lgRule_(sheet.getRange(FIRST, 10, LG_ROWS, 1), '対象外', LG.tintRed),
    lgRule_(sheet.getRange(FIRST, 19, LG_ROWS, 1), '契約', LG.tintGreen),
    lgRule_(sheet.getRange(FIRST, 19, LG_ROWS, 1), '未接触', LG.tintGray),
    lgRule_(sheet.getRange(FIRST, 22, LG_ROWS, 1), 'A 営業の棚', LG.tintRed),
    lgRule_(sheet.getRange(FIRST, 22, LG_ROWS, 1), 'C 自分ごと化成立', LG.tintGreen)
  ];
  sheet.setConditionalFormatRules(rules);

  var widths = [40, 210, 130, 100, 110, 70, 70, 80, 90, 80, 150, 90, 70, 300, 100, 60, 56, 80, 100, 60, 90, 130, 220, 90, 160];
  widths.forEach(function (w, i) { sheet.setColumnWidth(i + 1, w); });
  sheet.setRowHeight(1, 26);
  sheet.setRowHeight(2, 22);
  sheet.setRowHeight(TOP, 34);
  sheet.setFrozenRows(TOP);
  sheet.setFrozenColumns(2);
  sheet.getRange(TOP, 1, LG_ROWS + 1, HEAD.length)
    .setBorder(true, true, true, true, true, true, '#D9D9D9', SpreadsheetApp.BorderStyle.SOLID);
  lgTrim_(sheet, last, HEAD.length);
}

/* ============================================================
 * 接触ログ
 * ============================================================ */

function lgBuildLog_(sheet) {
  var HEAD = [
    '接触日', '台帳No.', '事業所名', 'チャネル', '接触の内容（誰に・何を渡したか）', '接触反応',
    '相手の言葉（そのまま）', '診断実施', 'レポート申込', 'チーム受診成立', '商談実施',
    '提示価格帯', '提示への反応', '断り理由', '契約', '初月継続', '紹介ask', '紹介発生', 'メモ'
  ];
  var TOP = 3;
  var FIRST = TOP + 1;
  var last = FIRST + LG_LOG_ROWS - 1;

  sheet.getRange(1, 1).setValue('接触ログ（1接触＝1行。価格実験と断り理由もここに残す）')
    .setFontSize(13).setFontWeight('bold').setFontColor(LG.white).setBackground(LG.slate);
  sheet.getRange(2, 1).setValue(
    '接触反応は「営業と思われたか」の検知器。A過多なら名乗りと入り方を、B過多なら依頼の大きさと出すタイミングを直す。断り理由は「高い」でなく“何と比べて高いと言ったか”を残す。')
    .setFontSize(9).setFontColor(LG.note);

  sheet.getRange(TOP, 1, 1, HEAD.length).setValues([HEAD])
    .setBackground(LG.slate).setFontColor(LG.white).setFontWeight('bold').setFontSize(9)
    .setWrap(true).setHorizontalAlignment('center');
  sheet.getRange(TOP, 3).setBackground(LG.steel);

  sheet.getRange(FIRST, 3).setFormula(
    '=ARRAYFORMULA(IF($B' + FIRST + ':$B="","",IFERROR(VLOOKUP($B' + FIRST + ':$B,観測台帳!$A:$B,2,FALSE),"※台帳に無いNo.")))');
  sheet.getRange(FIRST, 3, LG_LOG_ROWS, 1).setBackground(LG.auto);

  sheet.getRange(FIRST, 1, LG_LOG_ROWS, 1).setNumberFormat('yyyy/mm/dd');
  sheet.getRange(FIRST, 1, LG_LOG_ROWS, HEAD.length).setFontSize(9);
  sheet.getRange(FIRST, 5, LG_LOG_ROWS, 1).setWrap(true);
  sheet.getRange(FIRST, 7, LG_LOG_ROWS, 1).setWrap(true);
  sheet.getRange(FIRST, 19, LG_LOG_ROWS, 1).setWrap(true);

  lgValidateList_(sheet, FIRST, 4, LG_LOG_ROWS, LG_LISTS.logChannels);
  lgValidateList_(sheet, FIRST, 6, LG_LOG_ROWS, LG_LISTS.reactions);
  [8, 9, 10, 11, 15, 16, 17, 18].forEach(function (c) {
    lgValidateList_(sheet, FIRST, c, LG_LOG_ROWS, LG_LISTS.check);
    sheet.getRange(FIRST, c, LG_LOG_ROWS, 1).setHorizontalAlignment('center');
  });
  lgValidateList_(sheet, FIRST, 12, LG_LOG_ROWS, LG_LISTS.priceBands);
  lgValidateList_(sheet, FIRST, 13, LG_LOG_ROWS, LG_LISTS.priceReactions);
  lgValidateList_(sheet, FIRST, 14, LG_LOG_ROWS, LG_LISTS.declines);

  sheet.setConditionalFormatRules([
    lgRule_(sheet.getRange(FIRST, 6, LG_LOG_ROWS, 1), 'A 営業の棚', LG.tintRed),
    lgRule_(sheet.getRange(FIRST, 6, LG_LOG_ROWS, 1), 'C 自分ごと化成立', LG.tintGreen),
    lgRule_(sheet.getRange(FIRST, 14, LG_LOG_ROWS, 1), 'AIで足りている', LG.tintGold)
  ]);

  var widths = [90, 60, 190, 90, 260, 130, 260, 60, 80, 90, 70, 120, 100, 140, 56, 70, 70, 70, 220];
  widths.forEach(function (w, i) { sheet.setColumnWidth(i + 1, w); });
  sheet.setRowHeight(1, 26);
  sheet.setRowHeight(2, 30);
  sheet.setRowHeight(TOP, 34);
  sheet.setFrozenRows(TOP);
  sheet.setFrozenColumns(3);
  lgTrim_(sheet, last, HEAD.length);
}

/* ============================================================
 * 週次サマリー
 * ============================================================ */

function lgBuildWeekly_(sheet) {
  var HEAD = ['週', '開始', '終了', '訪問', '手紙', '登壇', '接触計', '目標', '差',
    'A 営業の棚', 'B 観測が効いた', 'C 自分ごと化', '診断', 'レポート申込', 'チーム受診', '商談', '契約', '累計接触'];
  var TOP = 3;
  var FIRST = TOP + 1;
  var WEEKS = 12;
  var last = FIRST + WEEKS - 1;

  sheet.getRange(1, 1).setValue('週次サマリー（管理変数＝週の接触件数）')
    .setFontSize(13).setFontWeight('bold').setFontColor(LG.white).setBackground(LG.slate);
  sheet.getRange(2, 1).setValue(
    '成約は歩留まり×入力の結果なので直接は操作できない。操作できるのは接触件数だけ。「差」がマイナスの週を作らないことが、この90日の唯一の禁則。')
    .setFontSize(9).setFontColor(LG.note);

  sheet.getRange(TOP, 1, 1, HEAD.length).setValues([HEAD])
    .setBackground(LG.slate).setFontColor(LG.white).setFontWeight('bold').setFontSize(9)
    .setWrap(true).setHorizontalAlignment('center');

  var start = new Date(LG_START);
  var rows = [], formulas = [];
  for (var i = 0; i < WEEKS; i++) {
    var from = new Date(start.getTime() + i * 7 * 24 * 3600 * 1000);
    var to = new Date(from.getTime() + 6 * 24 * 3600 * 1000);
    rows.push(['W' + (i + 1), from, to]);

    var r = FIRST + i;
    var cond = "'接触ログ'!$A:$A,\">=\"&$B" + r + ",'接触ログ'!$A:$A,\"<=\"&$C" + r;
    formulas.push([
      '=COUNTIFS(' + cond + ",'接触ログ'!$D:$D,\"訪問\")",
      '=COUNTIFS(' + cond + ",'接触ログ'!$D:$D,\"手紙*\")",  // 「手紙の後追い」も含める
      '=COUNTIFS(' + cond + ",'接触ログ'!$D:$D,\"登壇\")",
      '=COUNTIFS(' + cond + ')',                              // 内訳の合計でなく、その週の全接触を数える
      (i === 0 ? '0' : '10'),
      '=$G' + r + '-$H' + r,
      '=COUNTIFS(' + cond + ",'接触ログ'!$F:$F,\"A 営業の棚\")",
      '=COUNTIFS(' + cond + ",'接触ログ'!$F:$F,\"B 観測が効いた\")",
      '=COUNTIFS(' + cond + ",'接触ログ'!$F:$F,\"C 自分ごと化成立\")",
      '=COUNTIFS(' + cond + ",'接触ログ'!$H:$H,\"○\")",
      '=COUNTIFS(' + cond + ",'接触ログ'!$I:$I,\"○\")",
      '=COUNTIFS(' + cond + ",'接触ログ'!$J:$J,\"○\")",
      '=COUNTIFS(' + cond + ",'接触ログ'!$K:$K,\"○\")",
      '=COUNTIFS(' + cond + ",'接触ログ'!$O:$O,\"○\")",
      '=SUM($G$' + FIRST + ':$G' + r + ')'
    ]);
  }
  sheet.getRange(FIRST, 1, WEEKS, 3).setValues(rows);
  sheet.getRange(FIRST, 4, WEEKS, 15).setFormulas(formulas);
  sheet.getRange(FIRST, 2, WEEKS, 2).setNumberFormat('m/d');
  sheet.getRange(FIRST, 1, WEEKS, HEAD.length).setFontSize(9).setHorizontalAlignment('center');
  sheet.getRange(FIRST, 8, WEEKS, 1).setBackground(LG.tintGold);
  sheet.getRange(FIRST, 7, WEEKS, 1).setFontWeight('bold');

  // 累計と歩留まり
  var sumRow = last + 1;
  sheet.getRange(sumRow, 1).setValue('累計').setFontWeight('bold').setFontSize(9)
    .setBackground(LG.head).setHorizontalAlignment('center');
  var sums = [];
  for (var c = 4; c <= 17; c++) {
    sums.push('=SUM(' + lgA1_(c) + '$' + FIRST + ':' + lgA1_(c) + '$' + last + ')');
  }
  sheet.getRange(sumRow, 4, 1, sums.length).setFormulas([sums])
    .setFontWeight('bold').setFontSize(9).setBackground(LG.head).setHorizontalAlignment('center');

  var rateRow = sumRow + 2;
  sheet.getRange(rateRow, 1).setValue('歩留まり（仮説 → 実数）')
    .setFontWeight('bold').setFontSize(10).setFontColor(LG.white).setBackground(LG.navy);
  var rates = [
    ['接触 → 診断', '25%（訪問）/ 10%（手紙）', '=IFERROR($M$' + sumRow + '/$G$' + sumRow + ',"")'],
    ['診断 → レポート申込', '50%', '=IFERROR($N$' + sumRow + '/$M$' + sumRow + ',"")'],
    ['申込 → チーム受診', '80%', '=IFERROR($O$' + sumRow + '/$N$' + sumRow + ',"")'],
    ['チーム受診 → 商談', '80%', '=IFERROR($P$' + sumRow + '/$O$' + sumRow + ',"")'],
    ['商談 → 契約', '40%', '=IFERROR($Q$' + sumRow + '/$P$' + sumRow + ',"")'],
    ['接触反応 A（営業の棚）の比率', 'ー', '=IFERROR($J$' + sumRow + '/$G$' + sumRow + ',"")']
  ];
  sheet.getRange(rateRow + 1, 1, 1, 3).setValues([['項目', '仮説', '実数']])
    .setBackground(LG.head).setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center');
  for (var k = 0; k < rates.length; k++) {
    sheet.getRange(rateRow + 2 + k, 1).setValue(rates[k][0]).setFontSize(9);
    sheet.getRange(rateRow + 2 + k, 2).setValue(rates[k][1]).setFontSize(9).setHorizontalAlignment('center');
    sheet.getRange(rateRow + 2 + k, 3).setFormula(rates[k][2]).setFontSize(9)
      .setNumberFormat('0.0%').setHorizontalAlignment('center').setBackground(LG.auto);
  }
  var noteRow = rateRow + 2 + rates.length + 1;
  sheet.getRange(noteRow, 1).setValue(
    '※ 4週目末（W4）と8週目末（W8）に、この実数で仮説を引き直す。接触→診断が仮説の半分なら必要接触は2倍になるが、それでも週15件で1人で回る量に収まる。')
    .setFontSize(9).setFontColor(LG.note);

  sheet.setConditionalFormatRules([
    lgRuleLessThan_(sheet.getRange(FIRST, 9, WEEKS, 1), 0, LG.tintRed),
    lgRuleNumEq_(sheet.getRange(FIRST, 9, WEEKS, 1), 0, LG.tintGreen)
  ]);

  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 60);
  sheet.setColumnWidth(3, 60);
  for (var w = 4; w <= HEAD.length; w++) { sheet.setColumnWidth(w, 74); }
  sheet.setRowHeight(1, 26);
  sheet.setRowHeight(2, 30);
  sheet.setRowHeight(TOP, 34);
  sheet.setFrozenRows(TOP);
  lgTrim_(sheet, noteRow + 2, HEAD.length);
}

/* ============================================================
 * ヘルパ
 * ============================================================ */

function lgA1_(col) {
  var s = '';
  while (col > 0) {
    var m = (col - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    col = (col - m - 1) / 26;
  }
  return '$' + s;
}

/** マスタの配点表の1列目を選択肢にする */
function lgValidateFromMaster_(sheet, row, col, numRows, masterCol, count) {
  var master = SpreadsheetApp.getActive().getSheetByName('マスタ_選択肢と配点');
  var src = master.getRange(masterCol + '4:' + masterCol + (3 + count));
  var rule = SpreadsheetApp.newDataValidation().requireValueInRange(src, true)
    .setAllowInvalid(true).build();
  sheet.getRange(row, col, numRows, 1).setDataValidation(rule);
}

function lgValidateList_(sheet, row, col, numRows, values) {
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true)
    .setAllowInvalid(true).build();
  sheet.getRange(row, col, numRows, 1).setDataValidation(rule);
}

function lgRule_(range, text, color) {
  return SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(text).setBackground(color).setRanges([range]).build();
}

function lgRuleLessThan_(range, num, color) {
  return SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(num).setBackground(color).setRanges([range]).build();
}

function lgRuleNumEq_(range, num, color) {
  return SpreadsheetApp.newConditionalFormatRule()
    .whenNumberEqualTo(num).setBackground(color).setRanges([range]).build();
}

function lgTrim_(sheet, keepRows, keepCols) {
  var maxRows = sheet.getMaxRows();
  if (maxRows > keepRows) { sheet.deleteRows(keepRows + 1, maxRows - keepRows); }
  var maxCols = sheet.getMaxColumns();
  if (maxCols > keepCols) { sheet.deleteColumns(keepCols + 1, maxCols - keepCols); }
}
