/**
 * 読み解きガイド（全4章）。
 *
 * 要件：アプリ化要件定義.md F3-1（本の体裁・章送り・章立てを踏襲）／
 *       F4-5（ガイド本文は結果セッションで認可。申込フォームだけ外に出す）。
 *
 * 章のHTMLは prototype.html の bkChapters() を実行して作った生成物（content/guide-chapters.ts）。
 * 器（章送りの土台・終章の申込ブロック・自己紹介）も prototype.html からそのまま写している。
 *
 * 結果画面と同じく、Cookie を先に見て、タブ照合値は /api/guide/view で突き合わせる（F4-2）。
 */
import { GUIDE_MARKUP } from '../content/screens.ts';
import { page } from './layout.ts';

const SHELL_SCRIPT = `
(function () {
  var KEY = 'natur.tab';
  var $ = function (id) { return document.getElementById(id); };
  function closed() { location.replace('/result/closed'); }

  var token = null;
  try { token = sessionStorage.getItem(KEY); } catch (e) {}
  if (!token) { closed(); return; }

  var chapters = [], idx = 0, seen = 0, typeCode = null;

  function toTop() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }

  function renderRail() {
    var rail = $('bkRail');
    rail.innerHTML = '';
    chapters.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.num;
      b.title = c.label;
      b.setAttribute('aria-label', c.label);
      b.className = 'bk-dot' + (i === idx ? ' is-on' : (i <= seen ? ' is-read' : ''));
      b.onclick = function () { go(i); };
      rail.appendChild(b);
    });
  }

  function go(i) {
    if (!chapters.length) return;
    idx = Math.max(0, Math.min(chapters.length - 1, i));
    if (idx > seen) seen = idx;
    var c = chapters[idx], last = idx === chapters.length - 1;
    $('bkHdR').textContent = c.head;
    $('bkProse').innerHTML = c.open + '<div class="bk-body">' + c.html + '</div>';
    $('bkFolio').textContent = (idx + 1) + ' / ' + chapters.length;
    $('guideEnd').hidden = !last;
    $('bkNext').hidden = last;
    $('bkPrev').hidden = idx === 0;
    if (!last) $('bkNextT').textContent = chapters[idx + 1].label;
    renderRail();
    // 到達を記録する（F4-5）。終章に着いた回数と時刻はAdminで見る。
    reportProgress(idx);
    var pg = $('bkPage');
    pg.classList.remove('is-turn'); void pg.offsetWidth; pg.classList.add('is-turn');
    toTop();
  }

  var reported = -1;
  function reportProgress(chapter) {
    if (chapter <= reported) return;
    reported = chapter;
    fetch('/api/guide/progress', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabToken: token, chapter: chapter })
    }).catch(function () {});
  }

  // 終章の申込ボタン。押した時点で到達を記録し、返ってきたURLを別タブで開く（F4-5）。
  function wireApply(btnId) {
    var btn = $(btnId);
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (btn.dataset.busy) return;
      btn.dataset.busy = '1';
      fetch('/api/apply-visits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabToken: token, cta: btnId === 'sessionApply' ? 'epilogue-1' : 'epilogue-2' })
      }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          delete btn.dataset.busy;
          if (d && d.ok && d.url) window.open(d.url, '_blank', 'noopener');
          else location.href = '/apply/' + (typeCode || '');
        })
        .catch(function () { delete btn.dataset.busy; location.href = '/apply/' + (typeCode || ''); });
    });
  }

  // 商談前ヒアリング。送信ボタンは持たせず、入力が変わるたびに書き足す（F4-5）。
  var lastSent = '';
  function saveHearing() {
    var now = $('hearNow').value.trim(), future = $('hearFuture').value.trim();
    var sig = now + '\\u0000' + future;
    if (sig === lastSent || (!now && !future)) return;
    lastSent = sig;
    fetch('/api/hearing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabToken: token, now: now, future: future })
    }).then(function (r) {
      $('hearNote').textContent = r.ok ? 'ここまでの内容をお預かりしました。' : '';
      if (!r.ok) lastSent = '';
    }).catch(function () {
      lastSent = '';
      $('hearNote').textContent = '送信に失敗しました。通信環境を確認してください。';
    });
  }

  fetch('/api/guide/view', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabToken: token })
  }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.ok) { closed(); return; }
      chapters = d.chapters;
      typeCode = d.typeCode;
      var bk = $('guide');
      bk.style.setProperty('--accent', d.guard ? 'var(--teal)' : 'var(--coral)');
      bk.style.setProperty('--accent-soft', d.guard ? 'var(--teal-soft)' : 'var(--coral-soft)');
      bk.style.setProperty('--accent-ink', d.guard ? 'var(--teal-ink)' : 'var(--coral-ink)');
      bk.style.setProperty('--accent-deep', d.guard ? '#0E5040' : '#7A2E1A');
      $('hearingBlock').hidden = false;
      ['hearNow', 'hearFuture'].forEach(function (id) {
        $(id).addEventListener('change', saveHearing);
      });
      wireApply('sessionApply');
      wireApply('sessionApply2');
      go(0);
      document.body.dataset.ready = '1';
    }).catch(function () { closed(); });

  $('bkNext').onclick = function () { go(idx + 1); };
  $('bkPrev').onclick = function () { go(idx - 1); };
  $('bkRestart').onclick = function () { go(0); };
  $('bkBack').onclick = function () { location.href = '/result'; };
  $('bkBackBottom').onclick = function () { location.href = '/result'; };
})();
`;

/**
 * prototype.html では show('guide') が active を付けて表示していた。
 * こちらは最初からガイドの画面なので、器に active を足しておく。
 * .screen は active が無いと display:none なので、忘れると何も出ない。
 */
const GUIDE_SECTION = (() => {
  const from = 'class="screen book" id="guide"';
  if (!GUIDE_MARKUP.includes(from)) {
    throw new Error('ガイドの器の形が変わっています。extract-content.mjs を確認してください');
  }
  return GUIDE_MARKUP.replace(from, 'class="screen book active" id="guide"');
})();

export function guideShell(): string {
  return page(
    { title: '読み解きガイド | ナチュール診断', noindex: true, script: SHELL_SCRIPT },
    `<div class="app">${GUIDE_SECTION}</div>`
  );
}
