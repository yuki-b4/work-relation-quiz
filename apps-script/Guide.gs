/**
 * 3日間読み解きガイドの自動配信エンジン（guide-3day-spec.md §9）
 *
 * 仕組み：
 *  - 申込（doPost で guide:true）→ Day1 を即時送信し guide_day1_at を記録
 *  - 日次トリガー（毎朝8時）→ Day1 から1日経過で Day2、2日経過で Day3 を送信
 *  - 配信停止：doGet ?action=unsub&token=…（フッターのリンクから）
 *  - 文面は「ガイド文面」シートが正（seedGuideSheet で初期投入。以後はシートを直接編集）
 *  - 送信者名・各リンクは「ガイド設定」シート
 *
 * 初回セットアップ：setupGuideDelivery() を一度だけ実行
 *  （ログ列の追加＋シート作成＋文面シード＋朝8時トリガー登録まで全部やる）
 * テスト送信：sendGuideTest('あなたのメール', 'OBL') で3通まとめて届く
 */

var GUIDE_SHEET_NAME = 'ガイド文面';
var GUIDE_CONFIG_SHEET_NAME = 'ガイド設定';

// メールの組み立て順。BODY はタイプ別本文、他は共通ガワ。ブロック間は区切り線で連結する。
var GUIDE_LAYOUT = {
  1: ['opening', 'BODY', 'education', 'closing', 'footer'],
  2: ['opening', 'BODY', 'education', 'footer'],
  3: ['opening', 'BODY', 'education', 'cta', 'footer']
};
var GUIDE_BLOCK_SEP = '\n\n===============\n\n';

// 「ガイド設定」シートの既定キー（value を実際の値に書き換えてから公開する）
var GUIDE_CONFIG_KEYS = [
  ['sender_name',      '〔要確定〕', '送信者名。Day1冒頭の名乗り・メールの差出人名になる'],
  ['sender_contact',   '〔要確定〕', '氏名または名称・連絡先（フッターの送信者表示。特定電子メール法対応）'],
  ['sender_signature', '〔要確定〕', 'Day3末尾の署名（送信者名・連絡先）'],
  ['quiz_url',         '〔要確定〕', '診断URL（Day3「この診断をそのまま送ってみてください」のリンク）'],
  ['survey_url',       '〔要確定〕', 'アンケートフォームのURL（Day3のCTA）'],
  ['webapp_url',       '〔要確定〕', 'このWebアプリのデプロイURL（配信停止リンクの生成に使う）']
];

// ================= 初回セットアップ =================

// これを一度実行すれば配信の準備が整う（何度実行しても安全）
function setupGuideDelivery() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var log = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  ensureHeader(log); // guide_day1_at 等の列を追加
  var seeded = seedGuideSheet();
  var trigger = ensureGuideTrigger();
  return 'セットアップ完了：' + seeded + ' / ' + trigger +
    ' / 残タスク：「ガイド設定」シートの〔要確定〕を実際の値に書き換えてください';
}

// 「ガイド文面」「ガイド設定」シートを作成し、空なら GuideContent.gs のシードを投入する。
// 既にデータがある場合は一切上書きしない（運用中のシート編集を守る）。
function seedGuideSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var msgs = [];

  var sheet = ss.getSheetByName(GUIDE_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(GUIDE_SHEET_NAME);
  if (sheet.getLastRow() <= 1) {
    var rows = [['type_code', 'day', 'block', 'subject', 'body']];
    GUIDE_COMMON.forEach(function (b) {
      rows.push(['common', b.day, b.block, '', b.body]);
    });
    GUIDE_TYPES.forEach(function (t) {
      rows.push([t.code, t.day, 'body', t.subject, t.body]);
    });
    sheet.clearContents();
    sheet.getRange(1, 1, rows.length, 5).setValues(rows);
    msgs.push('「ガイド文面」に ' + (rows.length - 1) + ' 行を投入');
  } else {
    msgs.push('「ガイド文面」は既存データがあるためそのまま');
  }

  var cfg = ss.getSheetByName(GUIDE_CONFIG_SHEET_NAME);
  if (!cfg) cfg = ss.insertSheet(GUIDE_CONFIG_SHEET_NAME);
  if (cfg.getLastRow() === 0) {
    cfg.appendRow(['key', 'value', '説明']);
  }
  var existing = {};
  if (cfg.getLastRow() > 1) {
    cfg.getRange(2, 1, cfg.getLastRow() - 1, 1).getValues().forEach(function (r) { existing[r[0]] = true; });
  }
  var added = 0;
  GUIDE_CONFIG_KEYS.forEach(function (k) {
    if (!existing[k[0]]) { cfg.appendRow(k); added++; }
  });
  msgs.push('「ガイド設定」にキーを' + added + '件追加');
  return msgs.join('、');
}

// 毎朝8時の日次トリガーを登録する（既にあれば何もしない）
function ensureGuideTrigger() {
  var exists = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'sendGuideDailyBatch';
  });
  if (exists) return 'トリガーは登録済み';
  ScriptApp.newTrigger('sendGuideDailyBatch').timeBased().atHour(8).everyDays(1).create();
  return '毎朝8時のトリガーを登録';
}

// ================= 申込受付（Code.gs の doPost から呼ばれる） =================

// リード行をガイド配信に登録し、Day1 を即時送信する。
// 再送信ボタン連打などで二重に呼ばれても、送信済みならスキップする（冪等）。
function enrollGuideLead(sheet, rownum) {
  var get = function (col) { return sheet.getRange(rownum, HEADERS.indexOf(col) + 1); };
  var email = get('メールアドレス').getValue();
  var code = get('タイプコード').getValue();
  if (!email || !code) return;

  var tokenCell = get('ガイドトークン');
  var token = tokenCell.getValue();
  if (!token) {
    token = Utilities.getUuid();
    tokenCell.setValue(token);
  }
  if (get('guide_day1_at').getValue()) return; // 送信済み（冪等ガード）

  try {
    sendGuideMailForRow(sheet, rownum, 1);
  } catch (err) {
    // ログ記録は成功しているので申込自体は失敗させない。Day1未送信の行は日次バッチが翌朝リトライする。
    console.error('Day1即時送信に失敗: row=' + rownum + ' ' + err);
  }
}

// ================= 日次バッチ（時間主導トリガー） =================

function sendGuideDailyBatch() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return;
    ensureHeader(sheet);

    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
    var col = function (name) { return HEADERS.indexOf(name); };
    var today = new Date();

    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      if (!row[col('ガイドトークン')] || row[col('optout_at')]) continue;
      if (MailApp.getRemainingDailyQuota() < 2) {
        console.error('送信枠が尽きたため本日のバッチを中断（明日のトリガーで再開）');
        return;
      }
      var rownum = i + 2;
      var day1 = row[col('guide_day1_at')];
      try {
        if (!day1) {
          // 申込時のDay1送信が失敗していた行のリトライ
          sendGuideMailForRow(sheet, rownum, 1);
        } else if (!row[col('guide_day2_at')] && guideDaysBetween(day1, today) >= 1) {
          sendGuideMailForRow(sheet, rownum, 2);
        } else if (row[col('guide_day2_at')] && !row[col('guide_day3_at')] && guideDaysBetween(day1, today) >= 2) {
          sendGuideMailForRow(sheet, rownum, 3);
        }
      } catch (err) {
        console.error('ガイド送信に失敗: row=' + rownum + ' ' + err); // 1行の失敗で全体を止めない
      }
    }
  } finally {
    lock.releaseLock();
  }
}

// 暦日ベースの経過日数（8時のバッチで「翌日から」を正しく判定するため、時刻は切り捨てる）
function guideDaysBetween(from, to) {
  var a = new Date(from); a.setHours(0, 0, 0, 0);
  var b = new Date(to);   b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400000);
}

// ================= 送信本体 =================

// 指定行に指定日のガイドを送り、送信時刻を記録する。送信直前に再チェック（二重送信ガード）。
function sendGuideMailForRow(sheet, rownum, day) {
  var get = function (col) { return sheet.getRange(rownum, HEADERS.indexOf(col) + 1); };
  var atCell = get('guide_day' + day + '_at');
  if (atCell.getValue()) return;      // 二重送信ガード
  if (get('optout_at').getValue()) return;

  var email = get('メールアドレス').getValue();
  var code = String(get('タイプコード').getValue());
  var name = String(get('タイプ名').getValue());
  var token = String(get('ガイドトークン').getValue());
  if (!email || !code) return;

  var mail = buildGuideMail(day, code, name, token);
  var cfg = getGuideConfig();
  var opts = { to: email, subject: mail.subject, body: mail.body };
  if (cfg.sender_name && cfg.sender_name.indexOf('要確定') === -1) opts.name = cfg.sender_name;
  MailApp.sendMail(opts);
  atCell.setValue(new Date());
}

// 「ガイド文面」＋「ガイド設定」から1通を組み立てる
function buildGuideMail(day, typeCode, typeName, token) {
  var content = getGuideContent();
  var typeRow = content.types[typeCode + '_' + day];
  if (!typeRow) throw new Error('ガイド文面にタイプ行がない: ' + typeCode + ' Day' + day);

  var blocks = GUIDE_LAYOUT[day].map(function (b) {
    if (b === 'BODY') return typeRow.body;
    var c = content.common[(b === 'footer' ? 0 : day) + '_' + b];
    if (c === undefined) throw new Error('ガイド文面に共通行がない: day=' + day + ' block=' + b);
    return c;
  });

  var cfg = getGuideConfig();
  var unsubUrl = (cfg.webapp_url || '〔要確定〕') +
    ((cfg.webapp_url || '').indexOf('?') >= 0 ? '&' : '?') + 'action=unsub&token=' + token;
  var rep = {
    '〔タイプ名〕': typeName || typeCode,
    '〔送信者名（要確定）〕': cfg.sender_name || '〔要確定〕',
    '〔氏名または名称・連絡先（要確定）〕': cfg.sender_contact || '〔要確定〕',
    '〔送信者名・連絡先（要確定）〕': cfg.sender_signature || '〔要確定〕',
    '〔診断URL〕': cfg.quiz_url || '〔要確定〕',
    '〔アンケートURL〕': cfg.survey_url || '〔要確定〕',
    '〔配信停止URL〕': unsubUrl
  };
  var body = blocks.join(GUIDE_BLOCK_SEP);
  var subject = typeRow.subject;
  Object.keys(rep).forEach(function (k) {
    body = body.split(k).join(rep[k]);
    subject = subject.split(k).join(rep[k]);
  });
  return { subject: subject, body: body };
}

function getGuideContent() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(GUIDE_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) throw new Error('「ガイド文面」シートが未作成です。setupGuideDelivery() を実行してください');
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  var common = {}, types = {};
  values.forEach(function (r) {
    var code = String(r[0]).trim(), day = Number(r[1]), block = String(r[2]).trim();
    if (!code) return;
    if (code === 'common') common[day + '_' + block] = r[4];
    else types[code + '_' + day] = { subject: r[3], body: r[4] };
  });
  return { common: common, types: types };
}

function getGuideConfig() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(GUIDE_CONFIG_SHEET_NAME);
  var cfg = {};
  if (!sheet || sheet.getLastRow() < 2) return cfg;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(function (r) {
    if (r[0]) cfg[String(r[0]).trim()] = String(r[1]).trim();
  });
  return cfg;
}

// ================= 配信停止（Code.gs の doGet から呼ばれる） =================

function handleGuideUnsub(token) {
  var page = function (msg) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:sans-serif;max-width:32em;margin:3em auto;line-height:1.9">' + msg + '</div>'
    ).setTitle('配信停止');
  };
  if (!token) return page('無効なリンクです。');

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return page('無効なリンクです。');

  var tokenCol = HEADERS.indexOf('ガイドトークン') + 1;
  var tokens = sheet.getRange(2, tokenCol, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < tokens.length; i++) {
    if (String(tokens[i][0]) === token) {
      var cell = sheet.getRange(i + 2, HEADERS.indexOf('optout_at') + 1);
      if (!cell.getValue()) cell.setValue(new Date());
      return page('配信を停止しました。<br>ガイドをお読みいただき、ありがとうございました。');
    }
  }
  return page('無効なリンクです。');
}

// ================= テスト =================

// 自分のアドレスに3通まとめて送って文面を確認する（ログには何も記録しない）
// 例: sendGuideTest('you@example.com', 'OBL')
function sendGuideTest(email, typeCode) {
  var names = {};
  GUIDE_TYPES.forEach(function (t) { names[t.code] = true; });
  if (!names[typeCode]) throw new Error('タイプコードが不正です: ' + typeCode);
  var typeName = { OBL: '突撃隊長', OBS: '正論ハンマー', OKL: 'お祭り隊長', OKS: '自由人コメンテーター',
                   GBL: '沈黙の大黒柱', GBS: '縁の下の職人', GKL: '根回しの仕掛け人', GKS: 'がんばり屋の調整役' }[typeCode];
  [1, 2, 3].forEach(function (day) {
    var mail = buildGuideMail(day, typeCode, typeName, 'TEST-TOKEN');
    MailApp.sendMail({ to: email, subject: '【テスト】' + mail.subject, body: mail.body });
  });
  return typeCode + ' の3通を ' + email + ' に送信しました';
}
