/**
 * 体験セッション申込フォーム（Googleフォーム）の生成スクリプト
 *
 * `体験セッション申込フォーム.md` の仕様どおりのフォームを1発で作る。
 * 使い方：このファイルを Apps Script に貼り、createSessionForm() を一度だけ実行する。
 * 実行ログに「公開URL」「編集URL」「プレフィル用URL」が出るので控える。
 *  - 公開URL … prototype.html の SESSION_FORM_URL に貼る
 *  - プレフィル用URL … 中の entry.〇〇〇〇 が診断IDの受け口。回答ログとの紐づけに使う
 *
 * 文言の正は `体験セッション申込フォーム.md`。直すときは同mdを先に更新する。
 */

// 回答を書き込むスプレッドシート（Code.gs と同じ「回答ログ」）。空にすると連携しない。
var FORM_DEST_SHEET_ID = '1J9sfu2F3uJtpriORSkz7v-5uNQHD6mR4j3UZ22H1Q7M';

var TYPE_CHOICES = [
  '突撃隊長', '正論ハンマー', 'お祭り隊長', '自由人コメンテーター',
  '沈黙の大黒柱', '縁の下の職人', '根回しの仕掛け人', 'がんばり屋の調整役',
  'わからない・覚えていない'
];

function createSessionForm() {
  var form = FormApp.create('体験セッション（30〜45分・無料）お申し込み');

  form.setDescription(
    '読み解きガイドを最後まで読んでくださり、ありがとうございます。\n\n' +
    'このセッションでは、あなたの診断結果をもとに、いま何が起きているのか、次に何をしたら良いのかを一緒に読み解きます。\n\n' +
    'オンラインで30〜45分。費用はかかりません。\n' +
    'セッションの最後に、その先の進め方のご案内にも少しだけお時間をいただきます。\n\n' +
    '入力は2分ほどで終わります。答えにくい項目は、空のままで大丈夫です。'
  );
  form.setCollectEmail(false);       // Googleログインを必須にしない（質問で聞く）
  form.setProgressBar(false);
  form.setAllowResponseEdits(false);
  form.setConfirmationMessage(
    'お申し込みありがとうございます。\n' +
    '2営業日以内に、日程のご連絡を差し上げます。\n' +
    '迷惑メールフォルダに入ることがあるので、あわせてご確認ください。'
  );

  form.addTextItem()
    .setTitle('お名前')
    .setHelpText('ニックネームでも構いません。当日お呼びする名前を教えてください。')
    .setRequired(true);

  form.addTextItem()
    .setTitle('メールアドレス')
    .setHelpText('日程のご連絡に使います。')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());

  form.addListItem()
    .setTitle('診断結果のタイプ')
    .setHelpText('読み解きガイドの表紙、または診断結果の画面に出ているタイプです。')
    .setChoiceValues(TYPE_CHOICES)
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('いま、人間関係で気になっていること（任意）')
    .setHelpText('ひと言でも大丈夫です。書いていただけると、当日の読み解きが早く、深くなります。');

  form.addCheckboxItem()
    .setTitle('希望の時間帯（任意・複数選択可）')
    .setHelpText('候補をいくつか選んでいただけると、日程の調整が早く済みます。')
    .setChoiceValues(['平日の午前', '平日の午後', '平日の夜（19時以降）', '土日の午前', '土日の午後', '土日の夜'])
    .showOtherOption(true);

  form.addParagraphTextItem()
    .setTitle('ご質問・伝えておきたいこと（任意）');

  var idItem = form.addTextItem()
    .setTitle('診断ID（任意）')
    .setHelpText('自動で入力される場合があります。空のままで大丈夫です。');

  if (FORM_DEST_SHEET_ID) {
    form.setDestination(FormApp.DestinationType.SPREADSHEET, FORM_DEST_SHEET_ID);
  }

  // 診断IDの受け口（entry.〇〇〇〇）を取り出すためのプレフィルURL
  var prefill = form.createResponse()
    .withItemResponse(idItem.asTextItem().createResponse('__ID__'))
    .toPrefilledUrl();

  var out = [
    '公開URL（SESSION_FORM_URL に貼る）: ' + form.getPublishedUrl(),
    '編集URL: ' + form.getEditUrl(),
    'プレフィル用URL（entry.〇〇〇〇 が診断IDの受け口）: ' + prefill
  ].join('\n');
  Logger.log(out);
  return out;
}
