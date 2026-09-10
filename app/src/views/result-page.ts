/**
 * 結果画面の器（シェル）。
 *
 * 要件：アプリ化要件定義.md F4-2（3つの鍵の一致）。
 *
 * なぜシェルなのか：
 *   タブ照合値は sessionStorage にあり、/result への普通の遷移ではサーバに届かない
 *   （ブラウザが送るのはCookieだけ）。URLに載せると共有できてしまい F4-3 が壊れる。
 *   そこで、
 *     1. GET /result は Cookie だけを先に見て、駄目なら即 410（速い経路）
 *     2. 通れば中身の無いシェルを返す
 *     3. シェルのJSが sessionStorage を読んで POST /api/result/view し、
 *        3点一致で結果のHTMLを受け取って描く
 *   /result は noindex なので、SSRしないことによるSEOの損はない（F6-3）。
 */
import { declareSection } from './declare.ts';
import { page } from './layout.ts';

const SHELL_SCRIPT = `
(function () {
  var KEY = 'natur.tab';
  var mount = document.getElementById('resultMount');
  function closed() { location.replace('/result/closed'); }

  var token = null;
  try { token = sessionStorage.getItem(KEY); } catch (e) { token = null; }
  // タブを閉じると sessionStorage は消える。照合値が無い＝このタブでは見られない（F4-2）。
  if (!token) { closed(); return; }

  fetch('/api/result/view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabToken: token })
  }).then(function (r) {
    if (!r.ok) { closed(); return null; }
    return r.json();
  }).then(function (data) {
    if (!data || !data.ok) return;
    mount.innerHTML = data.html;
    // 軸の点を左端から所定の位置へ動かす。prototype.html の requestAnimationFrame と同じ見え方にする。
    requestAnimationFrame(function () {
      var dots = mount.querySelectorAll('.axis-dot[data-pos]');
      for (var i = 0; i < dots.length; i++) dots[i].style.left = dots[i].dataset.pos + '%';
    });
    document.body.dataset.ready = '1';
    // X共有のクリックを記録する（F5-5）。リンクの動作は妨げない。
    var share = document.getElementById('shareX');
    if (share) share.addEventListener('click', function () {
      fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabToken: token })
      }).catch(function () {});
    });
    // 読み解きガイドへ。その手前に宣言のフォークを1枚だけ挟む（施策a 段1・A-1）。
    // 一度宣言した人には二度目は出さない（data.declared）。
    wireDeclare(token, !!data.declared);

    var restart = document.getElementById('restartBtn');
    if (restart) restart.addEventListener('click', function () {
      // もう一度診断する：古い結果セッションを閉じてから最初に戻る（F4-1）
      fetch('/api/result/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'retake' })
      }).finally(function () {
        try { sessionStorage.removeItem(KEY); } catch (e) {}
        location.href = '/';
      });
    });
  }).catch(function () { closed(); });

  /**
   * 宣言のフォーク（施策a 段1・A-1）。結果画面の直後に1枚だけ挟む。
   * 記録に失敗しても読み解きガイドへは進ませる（宣言のために足止めしない）。
   */
  function wireDeclare(token, declared) {
    var openGuide = document.getElementById('openGuide');
    var panel = document.getElementById('declare');
    var result = document.getElementById('result');
    if (!openGuide) return;

    function toGuide() { location.href = '/guide'; }
    if (!panel || declared) {
      openGuide.addEventListener('click', toGuide);
      return;
    }

    var picked = { domain: null, target: null, deadline: null };
    var sending = false;

    function show(step) {
      var steps = panel.querySelectorAll('[data-step]');
      for (var i = 0; i < steps.length; i++) steps[i].hidden = steps[i].dataset.step !== step;
      document.getElementById('dcBack').hidden = step === 'domain';
      window.scrollTo(0, 0);
    }

    function send() {
      if (sending) return;
      sending = true;
      fetch('/api/declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabToken: token,
          domain: picked.domain,
          target: picked.target,
          deadline: picked.deadline
        })
      }).catch(function () {}).finally(toGuide);
    }

    openGuide.addEventListener('click', function () {
      result.classList.remove('active');
      panel.classList.add('active');
      show('domain');
    });

    panel.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-k]');
      if (!b) return;
      var kind = b.dataset.k, value = b.dataset.v;
      if (kind === 'domain') {
        picked.domain = value; picked.target = null; picked.deadline = null;
        // ③まだ分からない：相手を特定できないので、ここで記録してガイドへ（A-3）
        if (value === 'unknown') { send(); return; }
        show('target-' + value);
      } else if (kind === 'target') {
        picked.target = value;
        show('deadline');
      } else if (kind === 'deadline') {
        picked.deadline = value;
        send();
      }
    });

    document.getElementById('dcBack').addEventListener('click', function () {
      if (picked.target) { picked.target = null; show('target-' + picked.domain); }
      else { picked.domain = null; show('domain'); }
    });
    // 飛ばせるようにしておく。全員が宣言済みになると、宣言の有無で申込率を比べられない。
    document.getElementById('dcSkip').addEventListener('click', toGuide);
  }
})();
`;

export function resultShell(): string {
  return page(
    { title: '診断結果 | ナチュール診断', noindex: true, script: SHELL_SCRIPT },
    '<div class="app">' +
      '<header class="app-header">ナチュール診断</header>' +
      '<section class="screen active" id="result"><div id="resultMount"></div></section>' +
      // 宣言のフォーク（A-1）。結果カードの「読み解きガイドを開く」から、この節へ切り替わる。
      declareSection() +
    '</div>'
  );
}
