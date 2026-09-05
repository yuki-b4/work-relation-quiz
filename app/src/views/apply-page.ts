/**
 * 体験セッション申込フォーム。
 *
 * 要件：アプリ化要件定義.md F4-5（タイプ別の共通ページ・認可なし・到達IDで紐づけ）。
 * 文面の正：体験セッション申込フォーム.md
 *
 * このページだけがワンタイムの外に出る。URLを知っていれば誰でも開けるので、
 *   ・**診断結果の本文は一切出さない**。出してよいのはタイプ名だけ
 *   ・入力済みのヒアリングも出さない（その人のものだと確定できないため）
 *   ・honeypot ＋ レート制限を必ず入れる
 * 設問3（タイプ）と設問7（診断ID）は置かない。タイプはURLから確定し、
 * 診断IDの役割は ?v=（到達ID）の hidden が引き継ぐ。
 */
import { TYPES, type TypeCode } from '../content/types.ts';
import { page } from './layout.ts';
import { esc } from './result.ts';

export const SLOTS = [
  '平日の午前', '平日の午後', '平日の夜（19時以降）',
  '土日の午前', '土日の午後', '土日の夜', 'その他',
] as const;

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
    btn.disabled = true;
    btn.classList.add('is-loading');
    note.textContent = '';
    fetch('/api/session-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        typeCode: fd.get('typeCode'),
        v: fd.get('v') || null,
        name: fd.get('name'),
        email: fd.get('email'),
        concern: fd.get('concern'),
        slots: slots,
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

export function applyPage(code: TypeCode, visitId: string | null): string {
  const t = TYPES[code];
  const field = (id: string, label: string, hint: string, input: string) =>
    `<div class="field"><label for="${id}">${esc(label)}</label>${input}` +
    (hint ? `<p class="qhint" style="text-align:left; margin-top:6px">${esc(hint)}</p>` : '') +
    '</div>';

  const body =
    '<div class="app">' +
      '<header class="app-header">ナチュール診断</header>' +
      '<section class="screen active">' +
        '<div class="eyebrow">体験セッション（30〜45分・無料）</div>' +
        '<h1 class="hero" style="font-size:clamp(21px,4.6vw,28px)">お申し込み</h1>' +
        // 出してよいのはタイプ名だけ。結果の本文は出さない（F4-5）。
        `<p class="lead">${esc(t.name)}のあなたへ</p>` +

        '<p class="frame-why">読み解きガイドを最後まで読んでくださり、ありがとうございます。<br><br>' +
        'このセッションでは、あなたの診断結果をもとに、いま何が起きているのか、次に何をしたら良いのかを一緒に読み解きます。<br><br>' +
        'オンラインで30〜45分。費用はかかりません。<br>セッションの最後に、その先の進め方のご案内にも少しだけお時間をいただきます。<br><br>' +
        '入力は2分ほどで終わります。答えにくい項目は、空のままで大丈夫です。</p>' +

        `<form id="applyForm" novalidate>` +
          `<input type="hidden" name="typeCode" value="${esc(code)}">` +
          `<input type="hidden" name="v" value="${esc(visitId ?? '')}">` +
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
