/**
 * 職場の人間関係タイプ診断 — 回答収集用 Web App
 *
 * 2フェーズで記録する：
 *  - action:'create' … 診断完了時に、回答IDつきの行を先に追加（アンケート未回答でも取りこぼさない）
 *  - action:'update' … アンケート回答時に、回答IDをキーに同じ行のアンケート列だけを埋める
 * モード：feedback（8名・検証アンケート5問）／lead（紹介者・メール＋自由記述）
 * デプロイ手順は同じフォルダの README.md を参照。
 */

// 回答を書き込むスプレッドシートID（「職場の人間関係タイプ診断_回答ログ」）
var SHEET_ID = '1J9sfu2F3uJtpriORSkz7v-5uNQHD6mR4j3UZ22H1Q7M';

// 記録先シート（タブ）名。存在しなければ自動作成する。
// 指標v2＝精度でなくエンゲージメント／拡散を測る新アンケート用（旧 20260619~ とは別管理）
var SHEET_NAME = '指標v2';

var HEADERS = [
  'タイムスタンプ', 'モード', '紹介元',
  'Q1_本音', 'Q2_衝突', 'Q3_重心',
  'Q4_本音', 'Q5_衝突', 'Q6_重心',
  'Q7_本音', 'Q8_衝突', 'Q9_重心',
  '判定_本音', '判定_衝突', '判定_重心',
  'タイプコード', 'タイプ名',
  // 5軸スコア（0〜1。0=左の極／1=右の極／0.5=中央）。タイプ名の右に配置。フロントの radar から記録。
  '5軸_本音', '5軸_任せ方', '5軸_境界', '5軸_摩擦', '5軸_間合い',
  'これは私だ', '他者当てはめ', '他者当てはめ_誰', '見せたい・話したい', '見せたい_誰', '深掘りしたい', '滑った部分',
  'メールアドレス', '自由記述', '回答ID',
  // 「紹介者名」「備考」はスプレッドシート側で手入力する既存列。位置を保持して壊さないため明示する。
  // 「立場」は24問回答後に取得する任意項目（アドバイス精度向上のための情報）。末尾に追加。
  '紹介者名', '備考', '立場'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
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
  var radar = data.radar || {};
  var values = {
    'タイムスタンプ': new Date(),
    'モード': data.mode || '',
    '紹介元': data.ref || '',
    'Q1_本音': a[0] || '', 'Q2_衝突': a[1] || '', 'Q3_重心': a[2] || '',
    'Q4_本音': a[3] || '', 'Q5_衝突': a[4] || '', 'Q6_重心': a[5] || '',
    'Q7_本音': a[6] || '', 'Q8_衝突': a[7] || '', 'Q9_重心': a[8] || '',
    '判定_本音': axes.h || '', '判定_衝突': axes.c || '', '判定_重心': axes.w || '',
    'タイプコード': data.code || '', 'タイプ名': data.name || '',
    '5軸_本音': rscore(radar.safety), '5軸_任せ方': rscore(radar.trust), '5軸_境界': rscore(radar.bound),
    '5軸_摩擦': rscore(radar.conflict), '5軸_間合い': rscore(radar.connect),
    'これは私だ': data.me || '', '他者当てはめ': data.others || '', '他者当てはめ_誰': data.othersWho || '',
    '見せたい・話したい': data.share || '', '見せたい_誰': data.shareWho || '',
    '深掘りしたい': data.dig || '', '滑った部分': data.miss || '',
    'メールアドレス': data.email || '', '自由記述': data.relationship || '',
    '回答ID': data.id || '',
    // 紹介者名・備考は手入力列のため新規行では空のまま。立場はフロントから受け取って記録。
    '立場': data.position || ''
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
    'これは私だ': data.me, '他者当てはめ': data.others, '他者当てはめ_誰': data.othersWho,
    '見せたい・話したい': data.share, '見せたい_誰': data.shareWho,
    '深掘りしたい': data.dig, '滑った部分': data.miss,
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

// 既存シートにも、タイプ名の右へ5軸スコア列を物理挿入して桁ずれを防ぐ（doPostのロック内で1回だけ・冪等）。
// 既存データは挿入位置より右へ正しくシフトする。
function ensureRadarColumns(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return;
  var row1 = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (row1.indexOf('5軸_本音') !== -1) return; // 挿入済み
  var typeNameCol = row1.indexOf('タイプ名') + 1;
  if (typeNameCol === 0) return; // タイプ名が無い（新規/空シート）はここでは触らず、ensureHeaderが全体を整える
  var radarHeaders = ['5軸_本音', '5軸_任せ方', '5軸_境界', '5軸_摩擦', '5軸_間合い'];
  sheet.insertColumnsAfter(typeNameCol, radarHeaders.length);
  sheet.getRange(1, typeNameCol + 1, 1, radarHeaders.length).setValues([radarHeaders]);
}

// 0〜1のスコアを小数2桁に丸める。数値でなければ空文字。
function rscore(v) {
  return (typeof v === 'number') ? Math.round(v * 100) / 100 : '';
}

// 手動実行用：デプロイ後にこの関数を1回実行すると、送信を待たずにすぐ5軸列が挿入・整備される。
function setupRadarColumns() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return 'シートが見つかりません: ' + SHEET_NAME;
  ensureHeader(sheet);
  return '5軸列の整備が完了しました';
}

// 1行目を正しいヘッダーに揃える（列が足りなければ追加し、無い／古い場合は上書き）。先に5軸列の整備も行う。
function ensureHeader(sheet) {
  ensureRadarColumns(sheet);
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
