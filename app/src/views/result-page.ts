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
    // 読み解きガイドへ
    var openGuide = document.getElementById('openGuide');
    if (openGuide) openGuide.addEventListener('click', function () { location.href = '/guide'; });

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
})();
`;

export function resultShell(): string {
  return page(
    { title: '診断結果 | ナチュール診断', noindex: true, script: SHELL_SCRIPT },
    '<div class="app">' +
      '<header class="app-header">ナチュール診断</header>' +
      '<section class="screen active" id="result"><div id="resultMount"></div></section>' +
    '</div>'
  );
}
