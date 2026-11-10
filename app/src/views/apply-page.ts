/**
 * 体験セッション申込フォーム。
 *
 * 要件：アプリ化要件定義.md F4-5（入口ごとの申込ページ・認可なし・到達IDで紐づけ）。
 * 文面の正：このファイル（既定）と `entries` の上書き列（入口ごと）。任意の設問は設問マスタ
 * （`questions`。入口ごとに `entry_questions` で選ぶ。2026-11-10）。
 * 旧 Googleフォーム版の仕様書（体験セッション申込フォーム.md）は内製化の完了に伴い削除した。
 *
 * 入口は2つの形で開かれる。
 *   ・`/apply/{typeCode}` … 診断 → 読み解きガイド終章から。タイプはURLで確定する
 *   ・`/apply/s/{slug}`   … セミナーなど。タイプはURLに無いので、Cookieで解決するか設問で聞く
 *
 * **ナチュール診断の名前とロゴは、ガイド経由（`/apply/{typeCode}`）にだけ出す**（2026-11-09）。
 * `/apply/s/{slug}` は、診断を使わないセミナー（副業・転職など）も含めた、主催するセミナー全般の
 * 申込ページとして使う。診断から来た人には名前とロゴが「同じサービスの続き」という目印になるが、
 * セミナーから来た人には知らない名前で、別のサービスに飛ばされたように見える。
 * 外すのはヘッダー（ロゴと診断名）・タブの題名とアイコン・受付終了の画面の診断への誘導。
 *
 * このページだけがワンタイムの外に出る。URLを知っていれば誰でも開けるので、
 *   ・**診断結果の本文は一切出さない**。出してよいのはタイプ名だけ
 *   ・入力済みのヒアリングも出さない（その人のものだと確定できないため）
 *   ・honeypot ＋ レート制限を必ず入れる
 */
import type { TypeCode } from '../content/types.ts';
import { ANSWER_MAX, type FormQuestion } from '../lib/questions.ts';
import { page, siteHeader } from './layout.ts';
import { esc } from './result.ts';

/**
 * 体験セッションの予約カレンダー（Googleカレンダーの予約スケジュール）。
 *
 * **入力画面の「日程の選択」の枠に置き、送信より先に選んでもらう**（2026-10-19）。
 * 以前は送信の後に同じ画面で出していた。いまは「日程を選択しました」に
 * チェックが入るまで、申込ボタンを押せない（下のスクリプト）。
 *   ・この順番だと、予約だけして申込フォームを出さない人が生まれうる。その予約は
 *     こちらに記録が残らないので、Googleカレンダー側で気づいて拾う
 *   ・チェックは自己申告で、予約したかどうかは確かめられない（下の段落）
 *
 * **予約された日時をこちらの画面に取り込むことはできない。** 予約UIは calendar.google.com の
 * iframe の中で完結し、別オリジンなので中身を読めず、予約完了を知らせる仕組みも公開されていない。
 * 突き合わせは、申込の氏名・メールとGoogleカレンダーの予約で行う。
 *
 * **開いた時点で Google と通信する。** 送信前に選んでもらうので、送信まで遅らせられない。
 * `loading="lazy"` で、枠が画面に近づくまでは読み込まない。
 *
 * **入口ごとに変えられない。** セミナーでセッションの長さを変えるなら、予約枠も
 * 分ける必要がある（`entries` に予約URLの列を足す）。いまは1本で足りている。
 */
const BOOKING_URL =
  'https://calendar.google.com/calendar/appointments/schedules/' +
  'AcZssZ3yRjdmK7tTy3DsAQsNzPIZA8f6vHBB5CBEdIUm3xmM995noeSvd1yG5iZ65P5d1KUOKlud1yJ0?gv=true';

/**
 * 日程確定のメールを送るアドレス。申込の完了画面に出す（2026-11-10）。
 * 送り元を変えたらここも変える。受け取る側は、このアドレスを頼りに迷惑メールの中を探す。
 */
const SENDER_EMAIL = 'mikata.relational@gmail.com';

/**
 * 希望の時間帯の選択肢。**画面にはもう出さない**（2026-09-14）。
 *
 * 同じ画面で Google の予約カレンダーから日程を選ぶので、フォームで候補を聞くと同じことを2回させる。
 * 残してあるのは2つの理由から。
 *   ・移行データ（旧Googleフォーム）の `preferred_slots` にこの言葉が入っていて、Adminが表示する
 *   ・キャッシュに残った古い画面から `slots` が飛んできても、既知の値だけ受ける（index.ts）
 */
export const SLOTS = [
  '平日の午前', '平日の午後', '平日の夜（19時以降）',
  '土日の午前', '土日の午後', '土日の夜', 'その他',
] as const;

/**
 * 見出しの帯。入口が上書きしていなければこれ（`entries.eyebrow`。2026-11-10）。
 *
 * **長さは60分で固定**（2026-09-18）。予約カレンダー側の枠と揃える必要があるので、
 * ここを変えるなら Google の予約スケジュールの枠も同時に変えること。
 * 入口で帯を書き換えるときも、長さを書くなら枠と揃える。
 *
 * 以前は長さの表記（`entries.session_label`）だけを入口ごとに変えられ、「体験セッション」と
 * 「無料」は固定だった。診断を使わないセミナーでは呼び方（体験会など）も費用も回で違うので、
 * 帯の文言ごと書き換えられるようにした。
 */
export const DEFAULT_EYEBROW = '体験セッション（60分・無料）';

/**
 * 冒頭の説明の既定。
 *
 * **前置きの本文は2026-09-18に削除した。** 長さ・費用は見出し帯（体験セッション
 * （60分・無料））が、入力の手間は各項目のヒントが伝えているので、同じことを
 * 長い前置きで繰り返していた。
 *
 * 残すのはガイド経由のお礼だけ。**他の入口には出さない。**
 * セミナーで来た人は読み解きガイドを読んでいない。
 */
function defaultIntro(thanksForGuide: boolean): string {
  return thanksForGuide ? '読み解きガイドを最後まで読んでくださり、ありがとうございます。' : '';
}

/** 申込ページが使う入口の情報。NULL は「上書きしていない」の意味（migrations/0007・0008）。 */
export type ApplyEntry = {
  slug: string;
  headline: string | null;
  intro: string | null;
  eyebrow: string | null;
};

export type ApplyOptions = {
  /** 分かっているタイプ。null なら送らない（Cookieで解決できなかった人。設問でも聞かない）。 */
  code: TypeCode | null;
  /** 到達ID。送信時にサーバが response_id へ解決する。 */
  visitId: string | null;
  /** 入口。null はガイド経由（`/apply/{typeCode}`）。 */
  entry: ApplyEntry | null;
  /**
   * 出す設問を出す順に（`lib/questions.ts` の formQuestions）。入口ごとに選んだ設問 → 固定の設問。
   * ガイド経由は `guide` の入口の設問（人間関係の設問）。
   */
  questions: FormQuestion[];
};

/**
 * 入力の不足を示すスタイル。**この画面だけ**に足す。
 * アプリのCSSは prototype.html からの機械抽出（content/styles.ts）なので、そちらは手で触らない。
 *
 * 赤はブランドの coral（タイプの極を表す色）とは別系統にする。同じ色だと
 * 「タイプの色」と「エラー」が混ざって見える。
 *
 * **入力欄の下の補足（.qhint）は、入力欄と同じ幅いっぱいまで詰めて折る**（2026-10-03）。
 * 抽出したCSSは .qhint に text-wrap:balance を掛けている（診断画面の中央揃えの短い設問用）。
 * この画面の補足は左揃えなので、balance だと行の長さが均されて右に大きな空きが出る。
 * このページの <style> は抽出CSSより前に置かれるので、`.app` を足して優先度で勝たせる。
 */
const STYLE = `
:root{--apply-err:#B3261E}
.field input.is-invalid,
.field textarea.is-invalid,
.field select.is-invalid,
.field input.is-invalid:focus,
.field textarea.is-invalid:focus,
.field select.is-invalid:focus{border-color:var(--apply-err)}
.vq.is-invalid .vq-opt{border-color:var(--apply-err)}
.field-err{color:var(--apply-err); font-size:12.5px; font-weight:700; line-height:1.6; margin-top:6px; text-align:left}
.app .qhint{text-wrap:wrap}
.field .field-title{display:block; font-size:14px; color:var(--muted); margin-bottom:7px; font-weight:500}
.app .done-mail{word-break:keep-all; overflow-wrap:anywhere}
.app .mail-from{overflow-wrap:anywhere}
`;

const SCRIPT = `
(function () {
  var f = document.getElementById('applyForm');
  var note = document.getElementById('applyNote');
  var btn = document.getElementById('applySubmit');
  var booked = document.getElementById('booked');
  var sending = false;

  // 「日程を選択しました」にチェックが入るまで、申込ボタンを押せない（2026-10-19）。
  // 読み込み時にも合わせる。戻る操作でチェックが残ったまま開き直されることがある。
  function syncButton() { if (!sending) btn.disabled = !booked.checked; }
  booked.addEventListener('change', syncButton);
  syncButton();

  // フォームは novalidate なので、required だけではブラウザが止めてくれない。
  // **足りないところは一度に全部出す。** 1つ直すたびに送信し直させない。

  /** 直前の指摘を全部消してから付け直す。直した項目が赤のまま残らないようにする。 */
  function clearErrors() {
    note.textContent = '';
    var marked = f.querySelectorAll('.is-invalid');
    for (var i = 0; i < marked.length; i++) marked[i].classList.remove('is-invalid');
    var msgs = f.querySelectorAll('.field-err');
    for (var j = 0; j < msgs.length; j++) msgs[j].parentNode.removeChild(msgs[j]);
    var flagged = f.querySelectorAll('[aria-invalid]');
    for (var k = 0; k < flagged.length; k++) flagged[k].removeAttribute('aria-invalid');
  }

  /** 指摘を1件出す。文言は**その入力欄の直下**に置く（ヒントより前）。 */
  function mark(el, msg) {
    var p = document.createElement('p');
    p.className = 'field-err';
    p.textContent = msg;
    if (el.type === 'checkbox') {
      // 同意はラベルの中にあるので、囲みの .vq を赤くして、その末尾に文言を置く
      var box = el.closest('.vq');
      box.classList.add('is-invalid');
      box.appendChild(p);
    } else {
      el.classList.add('is-invalid');
      el.parentNode.insertBefore(p, el.nextSibling);
    }
    el.setAttribute('aria-invalid', 'true');
  }

  /** 足りないところを全部返す。 */
  function problems() {
    var out = [];
    var name = f.querySelector('#name');
    var email = f.querySelector('#email');
    var agree = f.querySelector('#agree');
    if (!name.value.trim()) out.push([name, 'お名前を入力してください。']);
    if (!email.value.trim()) out.push([email, 'メールアドレスを入力してください。']);
    else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email.value.trim())) {
      out.push([email, 'メールアドレスの形式をご確認ください（例：you@example.com）。']);
    }
    if (!agree.checked) out.push([agree, 'プライバシーポリシーへの同意が必要です。']);
    return out;
  }

  // 直したら、その場で赤を消す。送信し直すまで残ると、直ったのかが分からない。
  function onFix(e) {
    var el = e.target;
    var box = el.type === 'checkbox' ? el.closest('.vq') : el;
    if (!box || !box.classList.contains('is-invalid')) return;
    box.classList.remove('is-invalid');
    el.removeAttribute('aria-invalid');
    var msg = (el.type === 'checkbox' ? box : box.parentNode).querySelector('.field-err');
    if (msg) msg.parentNode.removeChild(msg);
  }
  f.addEventListener('input', onFix, true);
  f.addEventListener('change', onFix, true);

  f.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending || !booked.checked) return;
    clearErrors();
    var bad = problems();
    if (bad.length) {
      for (var i = 0; i < bad.length; i++) mark(bad[i][0], bad[i][1]);
      // ボタンの真下にも出す。指摘が画面の外にあると、押しても何も起きないように見える。
      note.textContent = bad.length === 1
        ? '入力に不足があります。上の赤い項目をご確認ください。'
        : '入力に不足が' + bad.length + '件あります。上の赤い項目をご確認ください。';
      bad[0][0].focus({ preventScroll: true });
      bad[0][0].scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    var fd = new FormData(f);
    // 設問への回答は、設問のIDをキーにして送る。設問文はサーバがマスタから引き直すので送らない。
    var answers = {};
    var boxes = f.querySelectorAll('textarea[data-qid]');
    for (var q = 0; q < boxes.length; q++) answers[boxes[q].getAttribute('data-qid')] = boxes[q].value;
    sending = true;
    btn.disabled = true;
    btn.classList.add('is-loading');
    note.textContent = '';
    fetch('/api/session-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        typeCode: fd.get('typeCode') || null,
        entry: fd.get('entry') || null,
        v: fd.get('v') || null,
        name: fd.get('name'),
        email: fd.get('email'),
        answers: answers,
        website: fd.get('website')
      })
    }).then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) {
        if (res.s === 429) throw new Error('送信が続いています。しばらく待ってからお試しください。');
        if (!res.d || !res.d.ok) throw new Error((res.d && res.d.message) || '送信に失敗しました。入力内容をご確認ください。');
        document.getElementById('applyForm').hidden = true;
        document.getElementById('applyDone').hidden = false;
        window.scrollTo(0, 0);
      })
      .catch(function (err) {
        sending = false;
        syncButton();
        btn.classList.remove('is-loading');
        note.textContent = err.message || '送信に失敗しました。通信環境を確認して、もう一度お試しください。';
      });
  });
})();
`;

function field(id: string, label: string, hint: string, input: string): string {
  return (
    `<div class="field"><label for="${esc(id)}">${esc(label)}</label>${input}` +
    (hint ? `<p class="qhint" style="text-align:left; margin-top:6px">${esc(hint)}</p>` : '') +
    '</div>'
  );
}

/**
 * ヘッダーを出さない画面（セミナー経由の申込・受付終了）の上の余白。
 * ヘッダーの高さ（スマホ60px・PC80px）をそのまま空けると間延びするので、半分ほどにする。
 */
const BARE_TOP = 'margin-top:clamp(28px,4vw,56px)';

/**
 * 段落ごとに <p> にする。入口の文面は Admin の textarea から来るので、改行を活かす。
 * **空なら何も出さない**（空の <p> を置くと、そのぶん余白だけが空く）。
 */
function paragraphs(text: string): string {
  if (!text.trim()) return '';
  return text
    .split(/\n{2,}/)
    .map((p) => `<p class="frame-why">${p.split('\n').map(esc).join('<br>')}</p>`)
    .join('');
}

export function applyPage(opts: ApplyOptions): string {
  const { code, visitId, entry } = opts;
  const isGuide = entry === null;
  const eyebrow = entry?.eyebrow || DEFAULT_EYEBROW;
  const headline = entry?.headline || 'お申し込み';
  const intro = entry?.intro || defaultIntro(isGuide);

  // タイプは画面では聞かない（2026-10-19。以前はセミナー入口で Cookie から引けなかった人に
  // 8タイプのプルダウンを出していた）。分かっているときだけ hidden で送り、
  // 分からない人の申込は Admin の手動紐づけ（F2-4）で補う。
  const typeField = code ? `<input type="hidden" name="typeCode" value="${esc(code)}">` : '';

  // 設問はすべて任意で、すべて複数行（2026-11-10）。注釈は設問ごとに持つ（questions.hint）。
  // **場面・相手・期限はここでは聞かない**（2026-09-12）。宣言はフォーク（A-1）の1か所で取り、
  // 宣言が無い人には体験セッションの場で聞く（集客戦略マップ.md §4.2 の1段目）。
  const questionFields = opts.questions
    .map((q) =>
      field(`ans-${q.id}`, `${q.label}（任意）`, q.hint ?? '',
        `<textarea id="ans-${esc(q.id)}" data-qid="${esc(q.id)}" maxlength="${ANSWER_MAX}"></textarea>`)
    )
    .join('');

  const body =
    '<div class="app">' +
      // セミナー経由はヘッダーごと出さない（冒頭のコメント）。ロゴは `/` へのリンクでもあるので、
      // 残すと診断への出口にもなる。
      (isGuide ? siteHeader() + '<section class="screen active">' : `<section class="screen active" style="${BARE_TOP}">`) +
        `<div class="eyebrow">${esc(eyebrow)}</div>` +
        `<h1 class="hero" style="font-size:clamp(21px,4.6vw,28px)">${esc(headline)}</h1>` +
        // **タイプ名は出さない**（2026-09-18）。この画面のタイプは、URL か、
        // セミナー入口では結果セッションCookieから引いている。Cookieから当てた名前を
        // 名指しで出すと「なぜ知っているのか」と受け取られ、申し込む手前で不信感になる。
        // **こちら側は type_code を記録して使う。出さないのは画面だけ。**
        // 結果の本文を出さないのは従来どおり（F4-5）。

        paragraphs(intro) +

        '<form id="applyForm" novalidate>' +
          typeField +
          `<input type="hidden" name="v" value="${esc(visitId ?? '')}">` +
          // 入口は申告でしかないので、サーバ側で実在を確かめる。
          // 到達IDがガイド終章のものなら、申告より到達を優先する（routes 側）。
          `<input type="hidden" name="entry" value="${esc(entry?.slug ?? '')}">` +
          // honeypot：人には見えない。埋まっていたらボットとして捨てる（F4-5）
          '<div style="position:absolute; left:-9999px" aria-hidden="true">' +
            '<label for="website">ウェブサイト</label>' +
            '<input id="website" name="website" type="text" tabindex="-1" autocomplete="off">' +
          '</div>' +

          field('name', 'お名前（必須）', 'ニックネームでも構いません。当日お呼びする名前を教えてください。',
            '<input id="name" name="name" type="text" required maxlength="100" autocomplete="name">') +
          field('email', 'メールアドレス（必須）', '日程のご連絡に使います。',
            '<input id="email" name="email" type="email" required maxlength="200" autocomplete="email">') +
          // 任意の設問。入口ごとに選んだ設問 → 固定の設問（ご質問・伝えておきたいこと）の順。
          // 送るときは name を使わず data-qid で集める（SCRIPT）。お名前・メールと混ざらないように。
          questionFields +

          // 日程は送信より先に、この枠で選んでもらう（2026-10-19）。見出しは他の項目と同じ大きさ。
          // 予約UIは Google の中で完結し、選ばれた日時はこちらで受け取れないので、
          // 選んだことは下のチェックで申告してもらう（入るまで申込ボタンを押せない）。
          '<div role="group" aria-labelledby="bookTitle">' +
            '<div class="field">' +
              '<p class="field-title" id="bookTitle">日程の選択</p>' +
              `<iframe id="bookFrame" src="${esc(BOOKING_URL)}" title="体験セッションの日程を選ぶ"` +
              ' style="border:0; width:100%; max-width:100%; height:620px; background:var(--surface);' +
              ' border-radius:14px" loading="lazy"></iframe>' +
              // 枠の中で開けない環境向けの逃げ道（アプリ内ブラウザなど）
              `<p class="qhint" style="text-align:left; margin-top:6px">カレンダーが開かないときは<a href="${esc(BOOKING_URL)}"` +
              ' target="_blank" rel="noopener" style="color:var(--trust)">こちらから日程を選べます</a>。</p>' +
            '</div>' +
            '<div class="vq">' +
              '<label class="vq-opt">' +
                '<input id="booked" type="checkbox" name="booked">' +
                '<span>日程を選択しました</span>' +
              '</label>' +
            '</div>' +
          '</div>' +

          // .vq-opt は .field の中に置かないこと。
          // .field label{display:block} と .field input{width:100%} が .vq-opt を上書きして、
          // チェックボックスが全幅になり、ラベルと縦積みになる（prototype.html も .vq の下に置いている）。
          '<div class="vq">' +
            '<label class="vq-opt">' +
              '<input id="agree" type="checkbox" name="agree" required>' +
              '<span><a href="/privacy" target="_blank" rel="noopener">プライバシーポリシー</a>に同意します（必須）</span>' +
            '</label>' +
          '</div>' +

          // 希望の時間帯は聞かない（2026-09-14）。上の予約カレンダーで選ぶので、
          // ここで候補を聞くと同じことを2回させることになる。
          // ボタンは「日程を選択しました」にチェックが入るまで押せない（SCRIPT）。

          // 主役のボタンは藍（2026-10-06）。タイプの極の色（coral／teal）は使わない
          '<button class="btn btn-wide" id="applySubmit" type="submit" disabled>この内容で申し込む</button>' +
          '<p class="proto-note" id="applyNote"></p>' +
        '</form>' +

        '<div id="applyDone" hidden>' +
          '<div class="bk-band">お申し込みありがとうございました。</div>' +
          '<p class="lead">選んでいただいた日時に、お会いできるのを楽しみにしています。</p>' +
          // 日程を選んだかは自己申告で、こちらでは選ばれた日時を受け取れない。
          // 申込のあとに、こちらから日程確定のメールを送る（文言は2026-11-10にユーザーの指示で変えた。
          // 以前は「申し込みいただいて2営業日以内にご連絡を差し上げます。」）。
          // **送り元のアドレスを書く**のは、受け取る側が迷惑メールの中から見つけやすくするため。
          // 文節の切れ目（<wbr>）でだけ折る（.done-mail）。既定の折り方だと「か｜ら」「日程確｜定」のように
          // 語の途中で折れる。アドレスは狭い画面で収まらないときだけ途中で折る（.mail-from）。
          `<p class="lead done-mail" style="margin-top:14px"><span class="mail-from">${esc(SENDER_EMAIL)}</span> から、<wbr>` +
          '日程確定の<wbr>メールを<wbr>2営業日以内に<wbr>お送りします。<br>' +
          '迷惑メール<wbr>フォルダに<wbr>入ることが<wbr>あるので、<wbr>併せて<wbr>ご確認ください。</p>' +
        '</div>' +
      '</section>' +
    '</div>';

  return page(
    {
      // セミナー経由は見出しをそのまま使う。帯は入口ごとに書き換えられる（体験会など）ので、
      // 題名で「体験セッション」と決め打ちしない。
      title: isGuide ? '体験セッションのお申し込み | ナチュール診断' : headline,
      noindex: true,
      icons: isGuide,
      head: `<style>${STYLE}</style>`,
      script: SCRIPT,
    },
    body
  );
}

/**
 * 受付を締めた入口（entries.active = 0）。入口の行は残っているので 410 で返す。
 *
 * 開くのは `/apply/s/{slug}` だけなので、申込ページのセミナー経由と同じく診断の名前とロゴを出さない。
 * **診断への誘導も置かない**（2026-11-09。以前は「診断を受ける」のボタンがあった）。
 * 診断を使わないセミナーの参加者には、行き違いの先が知らないサービスになる。
 */
export function applyClosedPage(): string {
  return page(
    { title: '受付を終了しました', noindex: true, icons: false },
    '<div class="app">' +
      `<section class="screen active" style="${BARE_TOP}">` +
        // 呼び方は入口ごとに違う（帯を書き換えられる）ので、「体験セッション」と決め打ちしない（2026-11-10）
        '<h1 class="hero" style="font-size:clamp(22px,5vw,30px)">お申し込みの受付は終了しました</h1>' +
        '<p class="lead">お申し込みいただける期間が過ぎています。ご案内の行き違いでしたら、申し訳ありません。</p>' +
      '</section>' +
    '</div>'
  );
}
