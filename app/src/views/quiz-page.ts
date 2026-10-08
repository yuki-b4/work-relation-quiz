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
import { ITEMS, ITEM_HTML, LIKERT } from '../content/quiz.ts';
import { TYPES, TYPE_CODES, TYPE_NAME_HTML } from '../content/types.ts';
import { page, siteFooter, topHeader, OGP_PATH } from './layout.ts';
import { esc } from './result.ts';

const TITLE = '人間関係タイプ診断（無料・登録不要） | ナチュール診断';
const DESCRIPTION =
  'ナチュール診断は、24の質問から「自然体のあなた」の特性が人間関係にどう出るかを8タイプで映し出す無料の診断です。登録は不要で、約2分。自分の強みとつい出るクセがわかります。';

/** 設問の駆動。prototype.html の renderQ / pick / toTop / show を移したもの。 */
function clientScript(): string {
  return `
(function () {
  var ITEMS = ${JSON.stringify(ITEMS)};
  // 設問文と選択肢の文節区切り（<wbr> 入り）。文面は ITEMS と同じで、折る位置だけを持たせたもの
  var ITEM_HTML = ${JSON.stringify(ITEM_HTML)};
  var LIKERT = ${JSON.stringify(LIKERT)};
  var KEY = 'natur.tab';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
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
  // 1問あたり約5秒（24問で約2分）として、残りの時間を分で出す。最後まで「約1分」は残す。
  function leftText(i) { return 'あと約' + Math.max(1, Math.round((ITEMS.length - i) * 5 / 60)) + '分'; }
  function renderQ() {
    var q = ITEMS[idx];
    var pct = Math.round((idx / ITEMS.length) * 100);
    $('qcount').textContent = (idx + 1) + ' / ' + ITEMS.length;
    $('qno').textContent = 'Q' + (idx + 1);
    $('qleft').textContent = leftText(idx);
    $('barfill').style.width = pct + '%';
    $('qbar').setAttribute('aria-valuenow', String(idx));
    $('qtext').innerHTML = ITEM_HTML[idx].text;
    var c = $('choices');
    c.innerHTML = '';
    if (q.kind === 'bin') {
      [['A', q.a], ['B', q.b]].forEach(function (pair) {
        var b = document.createElement('button');
        // ひとつ戻ったときは、選んでいた答えに印を付けておく
        b.className = 'choice' + (answers[idx] === pair[1].p ? ' is-on' : '');
        b.type = 'button';
        var mk = document.createElement('span');
        mk.className = 'mk';
        mk.textContent = pair[0];
        var tx = document.createElement('span');
        tx.innerHTML = ITEM_HTML[idx][pair[0] === 'A' ? 'a' : 'b'];
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
      dots.setAttribute('aria-label', 'どれくらい当てはまるか');
      // 4つ全部に言葉を付ける。「とても／そう思う」のように、程度の語のあとで改行する
      LIKERT.slice().reverse().forEach(function (opt) {
        var on = answers[idx] === opt.v;
        var b = document.createElement('button');
        b.className = 'dot dot-' + opt.v + (on ? ' is-on' : '');
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        var ring = document.createElement('span');
        ring.className = 'dot-ring';
        var label = document.createElement('span');
        label.className = 'dot-label';
        label.innerHTML = esc(opt.t).replace(/^(まったく|あまり|やや|とても)/, '$1<br>');
        b.appendChild(ring); b.appendChild(label);
        b.onclick = function () { pick(opt.v); };
        dots.appendChild(b);
      });
      scale.appendChild(dots);
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
  // ヘッダー（PC）とトップ下の帯にも、同じ「はじめる」ボタンがある
  var starts = document.querySelectorAll('[data-start]');
  for (var i = 0; i < starts.length; i++) starts[i].onclick = function () { show('frame'); };
  $('frameStart').onclick = function () {
    $('qframe').innerHTML = '力を抜いた<wbr>「いつものあなた」で<wbr>答えてください';
    idx = 0; answers.fill(null);
    renderQ(); show('quiz');
  };
  renderQ();
})();
`;
}

/**
 * トップの「8つのタイプ」。prototype.html は TYPES からJSで描くが、こちらはサーバで描いて本文に含める
 * （検索とAI要約に、タイプ名が本文として届くように）。器の形は prototype.html と同じ。
 */
const TOP_TYPES_SLOT = '<div class="type-grid" id="topTypes"></div>';
function topTypes(): string {
  return (
    '<div class="type-grid" id="topTypes">' +
    TYPE_CODES.map((code) => {
      const t = TYPES[code];
      return (
        `<a class="type-tile${t.pole === 'guard' ? ' is-guard' : ''}" href="/types/${code}">` +
        `<span class="tt-code">${esc(code)}</span><span class="tt-name">${TYPE_NAME_HTML[code]}</span>` +
        `<span class="tt-catch">${esc(t.catch)}</span></a>`
      );
    }).join('') +
    '</div>'
  );
}
const INTRO = (() => {
  if (!INTRO_MARKUP.includes(TOP_TYPES_SLOT)) {
    throw new Error('トップの8タイプの器が見つかりません。prototype.html を確認してください');
  }
  return INTRO_MARKUP.replace(TOP_TYPES_SLOT, topTypes());
})();

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
      ogImage: `${origin}${OGP_PATH}`,
      head: ogp + `<script type="application/ld+json">${jsonLd}</script>`,
      script: clientScript(),
    },
    '<div class="app">' +
      topHeader() +
      INTRO + FRAME_MARKUP + QUIZ_MARKUP +
      siteFooter() +
    '</div>'
  );
}
