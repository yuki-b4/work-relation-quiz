/**
 * 体験セッション申込フォーム。
 *
 * 要件：アプリ化要件定義.md F4-5（入口ごとの申込ページ・認可なし・到達IDで紐づけ）。
 * 文面の正：このファイル（既定）と `entries` の上書き列（入口ごと）。
 * 旧 Googleフォーム版の仕様書（体験セッション申込フォーム.md）は内製化の完了に伴い削除した。
 *
 * 入口は2つの形で開かれる。
 *   ・`/apply/{typeCode}` … 診断 → 読み解きガイド終章から。タイプはURLで確定する
 *   ・`/apply/s/{slug}`   … セミナーなど。タイプはURLに無いので、Cookieで解決するか設問で聞く
 *
 * このページだけがワンタイムの外に出る。URLを知っていれば誰でも開けるので、
 *   ・**診断結果の本文は一切出さない**。出してよいのはタイプ名だけ
 *   ・入力済みのヒアリングも出さない（その人のものだと確定できないため）
 *   ・honeypot ＋ レート制限を必ず入れる
 */
import { TYPES, type TypeCode } from '../content/types.ts';
import { page } from './layout.ts';
import { esc } from './result.ts';

/**
 * 体験セッションの予約カレンダー（Googleカレンダーの予約スケジュール）。
 *
 * **送信が終わってから、同じ画面で出す。** 順番に理由がある。
 *   ・予約が先だと、予約だけして申込フォームを出さない人が生まれる。**こちらに記録が何も残らない**
 *   ・送信を先にすれば、到達ID → 回答 → 宣言の紐づけと通知が確実に立つ（F4-5）
 *   ・遷移はしないので、本人の体感は「送信 → そのまま日程を選ぶ」の一続きになる
 *
 * **予約された日時をこちらの画面に取り込むことはできない。** 予約UIは calendar.google.com の
 * iframe の中で完結し、別オリジンなので中身を読めず、予約完了を知らせる仕組みも公開されていない。
 * 突き合わせは、申込の氏名・メールとGoogleカレンダーの予約で行う。
 *
 * **src は送信が成功するまで入れない**（下のスクリプト）。開いただけで Google に
 * 通信させないため。プライバシーポリシーへの同意は送信時に取っている。
 *
 * **入口ごとに変えられない。** セミナーでセッションの長さを変えるなら、予約枠も
 * 分ける必要がある（`entries` に予約URLの列を足す）。いまは1本で足りている。
 */
const BOOKING_URL =
  'https://calendar.google.com/calendar/appointments/schedules/' +
  'AcZssZ3yRjdmK7tTy3DsAQsNzPIZA8f6vHBB5CBEdIUm3xmM995noeSvd1yG5iZ65P5d1KUOKlud1yJ0?gv=true';

/**
 * 希望の時間帯の選択肢。**画面にはもう出さない**（2026-09-14）。
 *
 * 送信の直後に Google の予約カレンダーを出すので、フォームで候補を聞くと同じことを2回させる。
 * 残してあるのは2つの理由から。
 *   ・移行データ（旧Googleフォーム）の `preferred_slots` にこの言葉が入っていて、Adminが表示する
 *   ・キャッシュに残った古い画面から `slots` が飛んできても、既知の値だけ受ける（index.ts）
 */
export const SLOTS = [
  '平日の午前', '平日の午後', '平日の夜（19時以降）',
  '土日の午前', '土日の午後', '土日の夜', 'その他',
] as const;

/**
 * セッションの長さの表記。入口が上書きしていなければこれ。
 *
 * **60分で固定**（2026-09-18）。予約カレンダー側の枠と揃える必要があるので、
 * ここを変えるなら Google の予約スケジュールの枠も同時に変えること。
 */
const DEFAULT_SESSION_LABEL = '60分';

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

/** 申込ページが使う入口の情報。NULL は「上書きしていない」の意味（migrations/0007）。 */
export type ApplyEntry = {
  slug: string;
  headline: string | null;
  intro: string | null;
  sessionLabel: string | null;
  /** 事前入力の追加項目のラベル。順番がそのまま custom[] の並びになる。 */
  fields: string[];
};

export type ApplyOptions = {
  /** 分かっているタイプ。null なら設問で聞く（Cookieで解決できなかった人）。 */
  code: TypeCode | null;
  /** 到達ID。送信時にサーバが response_id へ解決する。 */
  visitId: string | null;
  /** 入口。null はガイド経由（`/apply/{typeCode}`）。 */
  entry: ApplyEntry | null;
};

/**
 * 入力の不足を示すスタイル。**この画面だけ**に足す。
 * アプリのCSSは prototype.html からの機械抽出（content/styles.ts）なので、そちらは手で触らない。
 *
 * 赤はブランドの coral（タイプの極を表す色）とは別系統にする。同じ色だと
 * 「タイプの色」と「エラー」が混ざって見える。
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
`;

const SCRIPT = `
(function () {
  var f = document.getElementById('applyForm');
  var note = document.getElementById('applyNote');
  var btn = document.getElementById('applySubmit');

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
    if (btn.disabled) return;
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
    // 追加項目は**並び順のまま**送る。ラベルはサーバが入口から引き直すので送らない。
    var custom = fd.getAll('custom');
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
        concern: fd.get('concern'),
        custom: custom,
        question: fd.get('question'),
        website: fd.get('website')
      })
    }).then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) {
        if (res.s === 429) throw new Error('送信が続いています。しばらく待ってからお試しください。');
        if (!res.d || !res.d.ok) throw new Error((res.d && res.d.message) || '送信に失敗しました。入力内容をご確認ください。');
        document.getElementById('applyForm').hidden = true;
        document.getElementById('applyDone').hidden = false;
        // 予約カレンダーは、送信が通ってから読み込む（開いただけで Google へ通信させない）
        var frame = document.getElementById('bookFrame');
        if (frame && !frame.src) frame.src = frame.dataset.src;
        window.scrollTo(0, 0);
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.classList.remove('is-loading');
        note.textContent = err.message || '送信に失敗しました。通信環境を確認して、もう一度お試しください。';
      });
  });
})();
`;

function field(id: string, label: string, hint: string, input: string): string {
  return (
    `<div class="field"><label for="${id}">${esc(label)}</label>${input}` +
    (hint ? `<p class="qhint" style="text-align:left; margin-top:6px">${esc(hint)}</p>` : '') +
    '</div>'
  );
}

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
  const sessionLabel = entry?.sessionLabel || DEFAULT_SESSION_LABEL;
  const headline = entry?.headline || 'お申し込み';
  const intro = entry?.intro || defaultIntro(isGuide);

  // タイプが分からない人にだけ聞く。分かっている人に聞き直さない（F4-5の設計方針）。
  const typeField = code
    ? `<input type="hidden" name="typeCode" value="${esc(code)}">`
    : '<div class="field"><label for="typeCode">診断結果のタイプ（任意）</label>' +
        '<select id="typeCode" name="typeCode">' +
          '<option value="">わからない・覚えていない</option>' +
          (Object.keys(TYPES) as TypeCode[])
            .map((k) => `<option value="${esc(k)}">${esc(TYPES[k].name)}</option>`)
            .join('') +
        '</select>' +
        '<p class="qhint" style="text-align:left; margin-top:6px">' +
        '診断結果の画面に出ていたタイプです。分からなければ、そのままで大丈夫です。</p>' +
      '</div>';

  const customFields = (entry?.fields ?? [])
    .map((label, i) =>
      field(`custom${i}`, `${label}（任意）`, '',
        `<input id="custom${i}" name="custom" type="text" maxlength="200">`)
    )
    .join('');

  const body =
    '<div class="app">' +
      '<header class="app-header">ナチュール診断</header>' +
      '<section class="screen active">' +
        `<div class="eyebrow">体験セッション（${esc(sessionLabel)}・無料）</div>` +
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
          // **場面・相手・期限はここでは聞かない**（2026-09-12）。宣言はフォーク（A-1）の1か所で取り、
          // 宣言が無い人には体験セッションの場で聞く（集客戦略マップ.md §4.2 の1段目）。
          // 同じことを2回聞かないぶん、フォームの摩擦も増やさない。
          field('concern', 'いま、人間関係で気になっていること（任意）',
            'ひと言でも大丈夫です。書いていただけると、当日の読み解きが早く、深くなります。',
            '<textarea id="concern" name="concern" maxlength="4000"></textarea>') +

          customFields +

          field('question', 'ご質問・伝えておきたいこと（任意）', '',
            '<textarea id="question" name="question" maxlength="4000"></textarea>') +

          // .vq-opt は .field の中に置かないこと。
          // .field label{display:block} と .field input{width:100%} が .vq-opt を上書きして、
          // チェックボックスが全幅になり、ラベルと縦積みになる（prototype.html も .vq の下に置いている）。
          '<div class="vq">' +
            '<label class="vq-opt">' +
              '<input id="agree" type="checkbox" name="agree" required>' +
              '<span><a href="/privacy" target="_blank" rel="noopener">プライバシーポリシー</a>に同意します（必須）</span>' +
            '</label>' +
          '</div>' +

          // 希望の時間帯は聞かない（2026-09-14）。送信後に Google の予約カレンダーを出すので、
          // ここで候補を聞くと同じことを2回させることになる。**代わりに、その順番を先に伝える。**
          // 送信して終わりだと思って離脱されると、日程が埋まらない。
          '<p class="qhint" style="text-align:left; margin-bottom:10px">' +
          '申込完了後に日程調整のリンクが表示されますので、希望される日程を選択してください。</p>' +

          '<button class="btn btn-wide btn-accent" id="applySubmit" type="submit">この内容で申し込む</button>' +
          '<p class="proto-note" id="applyNote"></p>' +
        '</form>' +

        '<div id="applyDone" hidden>' +
          '<div class="bk-band">お申し込みありがとうございました。</div>' +
          '<p class="lead">続けて、ご都合のよい日時をお選びください。</p>' +
          // 予約UIは Google の中で完結する。こちらでは選ばれた日時を受け取れないので、
          // 「選べなかった人」の逃げ道（メールでの調整）を必ず残しておく。
          `<iframe id="bookFrame" data-src="${esc(BOOKING_URL)}" title="体験セッションの日程を選ぶ"` +
          ' style="border:0; width:100%; max-width:100%; height:620px; background:var(--surface);' +
          ' border-radius:14px" loading="lazy"></iframe>' +
          `<p class="qhint" style="text-align:left">カレンダーが開かないときは<a href="${esc(BOOKING_URL)}"` +
          ' target="_blank" rel="noopener" style="color:var(--trust)">こちらから日程を選べます</a>。</p>' +
          '<p class="lead" style="margin-top:14px">日程が決まらない場合も、2営業日以内にご連絡を差し上げます。<br>' +
          '迷惑メールフォルダに入ることがあるので、あわせてご確認ください。</p>' +
        '</div>' +
      '</section>' +
    '</div>';

  return page(
    {
      title: '体験セッションのお申し込み | ナチュール診断',
      noindex: true,
      head: `<style>${STYLE}</style>`,
      script: SCRIPT,
    },
    body
  );
}

/** 受付を締めた入口（entries.active = 0）。入口の行は残っているので 410 で返す。 */
export function applyClosedPage(): string {
  return page(
    { title: '受付を終了しました | ナチュール診断', noindex: true },
    '<div class="app">' +
      '<header class="app-header">ナチュール診断</header>' +
      '<section class="screen active">' +
        '<h1 class="hero" style="font-size:clamp(22px,5vw,30px)">この体験セッションの受付は終了しました</h1>' +
        '<p class="lead">お申し込みいただける期間が過ぎています。ご案内の行き違いでしたら、申し訳ありません。</p>' +
        '<p class="lead">診断は引き続きお受けいただけます。結果の読み解きガイドからも、体験セッションへお申し込みいただけます。</p>' +
        '<a class="btn btn-wide" href="/" style="display:block; text-align:center; text-decoration:none">診断を受ける</a>' +
      '</section>' +
    '</div>'
  );
}
