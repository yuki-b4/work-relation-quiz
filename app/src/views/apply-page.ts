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

export const SLOTS = [
  '平日の午前', '平日の午後', '平日の夜（19時以降）',
  '土日の午前', '土日の午後', '土日の夜', 'その他',
] as const;

/** セッションの長さの表記。入口が上書きしていなければこれ。 */
const DEFAULT_SESSION_LABEL = '30〜45分';

/**
 * 冒頭の説明。ガイド経由だけ、最後まで読んだことへのお礼から入る。
 * **入口が上書きしていないときに、ガイドのお礼を他の入口へ出さないこと。**
 * セミナーで来た人は読み解きガイドを読んでいない。
 */
function defaultIntro(sessionLabel: string, thanksForGuide: boolean): string {
  return (
    (thanksForGuide ? '読み解きガイドを最後まで読んでくださり、ありがとうございます。\n\n' : '') +
    'このセッションでは、あなたの診断結果をもとに、いま何が起きているのか、次に何をしたら良いのかを一緒に読み解きます。\n\n' +
    `オンラインで${sessionLabel}。費用はかかりません。\n` +
    'セッションの最後に、その先の進め方のご案内にも少しだけお時間をいただきます。\n\n' +
    '入力は2分ほどで終わります。答えにくい項目は、空のままで大丈夫です。'
  );
}

/** 申込ページが使う入口の情報。NULL は「上書きしていない」の意味（migrations/0004）。 */
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

const SCRIPT = `
(function () {
  var f = document.getElementById('applyForm');
  var note = document.getElementById('applyNote');
  var btn = document.getElementById('applySubmit');
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    if (btn.disabled) return;
    var fd = new FormData(f);
    var slots = fd.getAll('slots');
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
        slots: slots,
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

/** 段落ごとに <p> にする。入口の文面は Admin の textarea から来るので、改行を活かす。 */
function paragraphs(text: string): string {
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
  const intro = entry?.intro || defaultIntro(sessionLabel, isGuide);
  const t = code ? TYPES[code] : null;

  // タイプが分からない人にだけ聞く。分かっている人に聞き直さない（F4-5の設計方針）。
  const typeField = t
    ? `<input type="hidden" name="typeCode" value="${esc(code!)}">`
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
        // 出してよいのはタイプ名だけ。結果の本文は出さない（F4-5）。
        (t ? `<p class="lead">${esc(t.name)}のあなたへ</p>` : '') +

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
          field('concern', 'いま、人間関係で気になっていること（任意）',
            'ひと言でも大丈夫です。書いていただけると、当日の読み解きが早く、深くなります。',
            '<textarea id="concern" name="concern" maxlength="4000"></textarea>') +

          customFields +

          // .vq-opt は .field の中に置かないこと。
          // .field label{display:block} と .field input{width:100%} が .vq-opt を上書きして、
          // チェックボックスが全幅になり、ラベルと縦積みになる（prototype.html も .vq の下に置いている）。
          '<div class="vq">' +
            '<p class="vq-q">希望の時間帯（任意・複数選べます）</p>' +
            '<div class="vq-opts" role="group">' +
              SLOTS.map((s) =>
                `<label class="vq-opt"><input type="checkbox" name="slots" value="${esc(s)}"><span>${esc(s)}</span></label>`
              ).join('') +
            '</div>' +
            '<p class="qhint" style="text-align:left; margin-top:6px">候補をいくつか選んでいただけると、日程の調整が早く済みます。</p>' +
          '</div>' +

          field('question', 'ご質問・伝えておきたいこと（任意）', '',
            '<textarea id="question" name="question" maxlength="4000"></textarea>') +

          '<div class="vq">' +
            '<label class="vq-opt">' +
              '<input type="checkbox" name="agree" required>' +
              '<span><a href="/privacy" target="_blank" rel="noopener">プライバシーポリシー</a>に同意します（必須）</span>' +
            '</label>' +
          '</div>' +

          '<button class="btn btn-wide btn-accent" id="applySubmit" type="submit">この内容で申し込む</button>' +
          '<p class="proto-note" id="applyNote"></p>' +
        '</form>' +

        '<div id="applyDone" hidden>' +
          '<div class="bk-band">お申し込みありがとうございます。</div>' +
          '<p class="lead">2営業日以内に、日程のご連絡を差し上げます。<br>' +
          '迷惑メールフォルダに入ることがあるので、あわせてご確認ください。</p>' +
        '</div>' +
      '</section>' +
    '</div>';

  return page(
    {
      title: '体験セッションのお申し込み | ナチュール診断',
      noindex: true,
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
