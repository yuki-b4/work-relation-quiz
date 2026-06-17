/**
 * 職場の人間関係タイプ診断 — 回答収集用 Web App
 *
 * 2フェーズで記録する：
 *  - action:'create' … 診断完了時に、回答IDつきの行を先に追加（アンケート未回答でも取りこぼさない）
 *  - action:'update' … アンケート回答時に、回答IDをキーに同じ行のアンケート列だけを埋める
 * モード：feedback（8名・検証3問）／lead（紹介者・メール＋自由記述）
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
  'メールアドレス', '自由記述', '回答ID'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
    ensureHeader(sheet);

    if (data.action === 'update') {
      handleUpdate(sheet, data);
    } else {
      handleCreate(sheet, data);
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// 診断完了時：1行追加
function handleCreate(sheet, data) {
  var a = data.answers || [];
  var axes = data.axes || {};
  var values = {
    'タイムスタンプ': new Date(),
    'モード': data.mode || '',
    '紹介元': data.ref || '',
    'Q1_本音': a[0] || '', 'Q2_衝突': a[1] || '', 'Q3_重心': a[2] || '',
    'Q4_本音': a[3] || '', 'Q5_衝突': a[4] || '', 'Q6_重心': a[5] || '',
    'Q7_本音': a[6] || '', 'Q8_衝突': a[7] || '', 'Q9_重心': a[8] || '',
    '判定_本音': axes.h || '', '判定_衝突': axes.c || '', '判定_重心': axes.w || '',
    'タイプコード': data.code || '', 'タイプ名': data.name || '',
    '当てはまり': data.fit || '', '言い当てられた感': data.insight || '', 'すすめたい': data.recommend || '',
    'メールアドレス': data.email || '', '自由記述': data.relationship || '',
    '回答ID': data.id || ''
  };
  sheet.appendRow(HEADERS.map(function (h) { return values.hasOwnProperty(h) ? values[h] : ''; }));
}

// アンケート回答時：回答IDで行を探し、アンケート列だけ更新
function handleUpdate(sheet, data) {
  var rownum = findRowById(sheet, data.id);
  if (rownum < 0) {
    // 診断行が見つからない場合はデータ消失を防ぐため新規追加
    handleCreate(sheet, data);
    return;
  }
  var updates = {
    '当てはまり': data.fit, '言い当てられた感': data.insight, 'すすめたい': data.recommend,
    'メールアドレス': data.email, '自由記述': data.relationship
  };
  Object.keys(updates).forEach(function (name) {
    var v = updates[name];
    if (v !== undefined && v !== null && v !== '') {
      sheet.getRange(rownum, HEADERS.indexOf(name) + 1).setValue(v);
    }
  });
}

// 回答IDから行番号を探す（無ければ -1）
function findRowById(sheet, id) {
  if (!id) return -1;
  var idCol = HEADERS.indexOf('回答ID') + 1;
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, idCol, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }
  return -1;
}

// 1行目を正しいヘッダーに揃える（列が足りなければ追加し、無い／古い場合は上書き）
function ensureHeader(sheet) {
  var width = HEADERS.length;
  if (sheet.getMaxColumns() < width) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
  }
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
