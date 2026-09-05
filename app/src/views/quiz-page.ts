/**
 * トップと設問（イントロ → フレーム → 設問24問）。
 *
 * 要件：アプリ化要件定義.md F3-1（画面導線・設問・表示挙動は現行踏襲）／F6-2（index対象）。
 *
 * prototype.html と同じく、3つの画面を1枚の文書に入れて表示を切り替える。
 * 設問の途中でページを読み込み直さないので、回答が消える機会が増えない（F3-4）。
 * 診断が終わったら回答を送り、返ってきたタブ照合値を sessionStorage に入れてから
 * /result へ進む（F4-2）。
 */
import { INTRO_MARKUP, FRAME_MARKUP, QUIZ_MARKUP } from '../content/screens.ts';
import { ITEMS, LIKERT } from '../content/quiz.ts';
import { page } from './layout.ts';

const TITLE = '人間関係タイプ診断（無料・登録不要） | ナチュール診断';
const DESCRIPTION =
  'ナチュール診断は、24の質問から「自然体のあなた」の人間関係の関わり方を8タイプで映し出す無料の診断です。登録は不要で、約2分。自分の強みとつい出るクセがわかります。';

/** 設問の駆動。prototype.html の renderQ / pick / toTop / show を移したもの。 */
function clientScript(): string {
  return `
(function () {
  var ITEMS = ${JSON.stringify(ITEMS)};
  var LIKERT = ${JSON.stringify(LIKERT)};
  var KEY = 'natur.tab';
  var $ = function (id) { return document.getElementById(id); };
  var idx = 0;
  var answers = new Array(ITEMS.length).fill(null);
  var sending = false;

  function toTop() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }
  function show(id) {
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
    $(id).classList.add('active');
    toTop();
  }
  function renderQ() {
    var q = ITEMS[idx];
    var pct = Math.round((idx / ITEMS.length) * 100);
    $('qcount').textContent = (idx + 1) + ' / ' + ITEMS.length;
    $('qpct').textContent = pct + '%';
    $('barfill').style.width = pct + '%';
    $('qtext').textContent = q.text;
    var c = $('choices');
    c.innerHTML = '';
    if (q.kind === 'bin') {
      [['A', q.a], ['B', q.b]].forEach(function (pair) {
        var b = document.createElement('button');
        b.className = 'choice';
        b.type = 'button';
        var mk = document.createElement('span');
        mk.className = 'mk';
        mk.textContent = pair[0];
        var tx = document.createElement('span');
        tx.textContent = pair[1].t;
        b.appendChild(mk); b.appendChild(tx);
        b.onclick = function () { pick(pair[1].p); };
        c.appendChild(b);
      });
      $('qhint').innerHTML = 'どちらがより自分に近いかで直感的に。<br>迷ったら第一印象で大丈夫です。';
    } else {
      var scale = document.createElement('div');
      scale.className = 'scale';
      var dots = document.createElement('div');
      dots.className = 'scale-dots';
      dots.setAttribute('role', 'radiogroup');
      LIKERT.slice().reverse().forEach(function (opt) {
        var b = document.createElement('button');
        b.className = 'dot dot-' + opt.v;
        b.type = 'button';
        b.setAttribute('aria-label', opt.t);
        b.title = opt.t;
        b.onclick = function () { pick(opt.v); };
        dots.appendChild(b);
      });
      scale.appendChild(dots);
      scale.insertAdjacentHTML('beforeend',
        '<div class="scale-legend"><span>当てはまらない</span><span>当てはまる</span></div>');
      c.appendChild(scale);
      $('qhint').innerHTML = 'ふだんの自分を思い浮かべて、<br>どれくらい当てはまるか直感で。';
    }
    $('backBtn').hidden = idx === 0;
    toTop();
  }
  function pick(val) {
    answers[idx] = val;
    if (idx < ITEMS.length - 1) { idx++; renderQ(); }
    else { $('barfill').style.width = '100%'; finish(); }
  }
  function params() {
    var p = new URLSearchParams(location.search);
    return {
      ref: p.get('ref') || undefined,
      src: p.get('src') || undefined,
      utmSource: p.get('utm_source') || undefined,
      utmMedium: p.get('utm_medium') || undefined,
      utmCampaign: p.get('utm_campaign') || undefined
    };
  }
  var requestId = null;
  function finish() {
    if (sending) return;
    sending = true;
    $('qhint').textContent = '結果を用意しています...';
    // 冪等キー。通信が切れて再送しても、回答が2件にならない（F1-3）。
    if (!requestId) requestId = (crypto.randomUUID ? crypto.randomUUID()
      : 'r-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10));
    var body = params();
    body.requestId = requestId;
    body.answers = answers;
    body.frame = '自然体';
    body.entryUrl = location.href;
    body.referrerUrl = document.referrer || undefined;
    fetch('/api/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('submit failed');
      return r.json();
    }).then(function (d) {
      if (!d || !d.ok) throw new Error('submit failed');
      // タブ照合値。タブを閉じると消えるので、結果はこのタブでしか開けない（F4-2）。
      try { sessionStorage.setItem(KEY, d.tabToken); } catch (e) {}
      location.href = '/result';
    }).catch(function () {
      sending = false;
      $('qhint').textContent = '送信に失敗しました。通信環境を確認して、もう一度ボタンを押してください。';
      renderQ();
    });
  }

  $('backBtn').onclick = function () { if (idx > 0) { idx--; renderQ(); } };
  $('startBtn').onclick = function () { show('frame'); };
  $('frameStart').onclick = function () {
    $('qframe').textContent = '力を抜いた「普段のあなた」で答えてください';
    idx = 0; answers.fill(null);
    renderQ(); show('quiz');
  };
  renderQ();
})();
`;
}

export function topPage(origin: string): string {
  const canonical = origin + '/';
  const ogp =
    `<meta property="og:type" content="website">` +
    `<meta property="og:site_name" content="ナチュール診断">` +
    `<meta property="og:title" content="${TITLE}">` +
    `<meta property="og:description" content="${DESCRIPTION}">` +
    `<meta property="og:url" content="${canonical}">` +
    `<meta property="og:locale" content="ja_JP">` +
    `<meta name="twitter:card" content="summary_large_image">`;

  // 「ナチュール診断とは」への一問一答。スニペットとAI要約に引用されやすい形にする（F7-3）。
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'ナチュール診断',
    alternateName: ['なちゅーる診断', 'ナチュール しんだん'],
    url: canonical,
    description: DESCRIPTION,
    inLanguage: 'ja',
  });

  return page(
    {
      title: TITLE,
      description: DESCRIPTION,
      canonical,
      head: ogp + `<script type="application/ld+json">${jsonLd}</script>`,
      script: clientScript(),
    },
    '<div class="app">' +
      '<header class="app-header">ナチュール診断</header>' +
      INTRO_MARKUP + FRAME_MARKUP + QUIZ_MARKUP +
    '</div>'
  );
}
