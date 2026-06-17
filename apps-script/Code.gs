/**
 * 職場の人間関係タイプ診断 — 回答収集用 Web App
 *
 * prototype.html から送られてくる回答を、回答ログ用スプレッドシートに1行ずつ追記する。
 *  - feedback モード（8名・検証）：検証用フィードバック3問
 *  - lead モード（紹介者）：深掘り診断の申込（メール＋自由記述）。ref に紹介元。
 * デプロイ手順は同じフォルダの README.md を参照。
 */

// 回答を書き込むスプレッドシートID（「職場の人間関係タイプ診断_回答ログ」）
var SHEET_ID = '1J9sfu2F3uJtpriORSkz7v-5uNQHD6mR4j3UZ22H1Q7M';

var HEADERS = [
  'タイムスタンプ', 'モード', '紹介元',
  'Q1_本音', 'Q2_衝突', 'Q3_重心',
  'Q4_本音', 'Q5_衝突', 'Q6_重心',
  'Q7_本音', 'Q8_衝突', 'Q9_重心',
  '判定_本音', '判定_衝突', '判定_重心',
  'タイプコード', 'タイプ名',
  '当てはまり', '言い当てられた感', 'すすめたい',
  'メールアドレス', '自由記述'
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
    ensureHeader(sheet);

    var a = data.answers || [];
    var axes = data.axes || {};
    var row = [
      new Date(), data.mode || '', data.ref || '',
      a[0] || '', a[1] || '', a[2] || '', a[3] || '', a[4] || '',
      a[5] || '', a[6] || '', a[7] || '', a[8] || '',
      axes.h || '', axes.c || '', axes.w || '',
      data.code || '', data.name || '',
      data.fit || '', data.insight || '', data.recommend || '',
      data.email || '', data.relationship || ''
    ];
    sheet.appendRow(row);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// 1行目を正しいヘッダーに揃える（無い／古い場合は上書き）
function ensureHeader(sheet) {
  var width = HEADERS.length;
  var current = sheet.getRange(1, 1, 1, width).getValues()[0];
  var matches = current.every(function (v, i) { return v === HEADERS[i]; });
  if (!matches) {
    sheet.getRange(1, 1, 1, width).setValues([HEADERS]);
  }
}

// デプロイ確認用：ブラウザでURLを開くと稼働状況が表示される
function doGet() {
  return json({ ok: true, message: '職場の人間関係タイプ診断 回答収集エンドポイントは稼働中です。' });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
