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
import { TYPE_NOTE } from '../lib/declaration.ts';
import { declareSection, DECLARE_CSS } from './declare.ts';
import { page } from './layout.ts';

/**
 * 押していない人にフォークを出すきっかけ（2026-09-12）。**ここだけ見れば調整できる**ようにまとめる。
 *
 * ・`MIN_MS`    結果が出てから最低これだけは黙って読ませる。開いた直後に被せない
 * ・`READ_MS`   深層（カードの終盤）まで到達した人に出すまでの猶予
 * ・`IDLE_MS`   スクロールが止まったままの人に出すまで。迷って手が止まっている人を拾う
 *
 * 長すぎると誰にも届かず、短すぎると読書の邪魔になる。**実数が出るまでは動かさない**
 * （11月にガイド開封率で判定する。集客戦略マップ.md §8.3）。
 */
const AUTO = { MIN_MS: 10000, READ_MS: 1200, IDLE_MS: 45000 };

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
    // 読み解きガイドへ。その手前に宣言のフォークを挟む（施策a 段1・A-1）。
    // ボタンを押さない人には、読み終わり・手が止まったところで自分から出す。
    // 一度宣言した人には二度と出さない（data.declared）。
    wireDeclare(token, !!data.declared, !!data.guard);

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
   * 宣言のフォーク（施策a 段1・A-1）と、そのあとのブリッジ。
   *
   * 3クリックの最後にブリッジ（宣言の読み上げ → 約束 → 一手 → 限界 → ガイドの中身）を
   * 出してから読み解きガイドへ送る。
   * **記録に失敗してもブリッジは出す**（宣言のために足止めしない）。
   *
   * 出し方は2つ（cta／auto）。**auto は1回だけ**で、閉じられたら二度と出さない。
   */
  function wireDeclare(token, declared, guard) {
    var openGuide = document.getElementById('openGuide');
    var panel = document.getElementById('dcModal');
    if (!openGuide) return;

    function toGuide() { location.href = '/guide'; }
    if (!panel || declared || !panel.showModal) {
      // 宣言済み、または <dialog> が使えない環境。ボタンはそのままガイドへ通す
      openGuide.addEventListener('click', toGuide);
      return;
    }

    // タイプの極（open／guard）の色を引き継ぐ。結果カードは .card 側で色を決めているので、
    // ここで渡さないとフォークだけ既定色（coral）のままになる。
    panel.style.setProperty('--accent', guard ? 'var(--teal)' : 'var(--coral)');
    panel.style.setProperty('--accent-soft', guard ? 'var(--teal-soft)' : 'var(--coral-soft)');
    panel.style.setProperty('--accent-ink', guard ? 'var(--teal-ink)' : 'var(--coral-ink)');

    var picked = { domain: null, target: null, deadline: null };
    var sending = false;
    var autoDone = false;    // auto はもう出さない（一度出した／閉じられた）
    var prompted = false;    // 「出した」の記録は1回だけ送る
    var declaredNow = false; // この画面で宣言を終えたか（終えていればボタンは直接ガイドへ）

    function show(step) {
      var steps = panel.querySelectorAll('[data-step]');
      for (var i = 0; i < steps.length; i++) steps[i].hidden = steps[i].dataset.step !== step;
      // ブリッジは宣言のあとの画面なので、戻るも飛ばすも出さない
      document.getElementById('dcBack').hidden = step === 'domain' || step === 'bridge';
      document.getElementById('dcSkipWrap').hidden = step === 'bridge';
      panel.scrollTop = 0;   // 背面（結果）は動かさない
    }

    /** 宣言をそのまま文に入れて返す（自分ごと化は、こちらの言葉でなく本人の選択で起こす）。 */
    function showBridge() {
      // 悩みの理由は「場面：相手」の組で選ぶ（相手の名前が入った1本だけを見せる）。
      // 鍵の作り方は lib/declaration.ts の slotKey と揃えること
      var key = picked.domain === 'unknown' || !picked.target ? 'unknown' : picked.domain + ':' + picked.target;
      var cs = panel.querySelectorAll('[data-cause]');
      for (var i = 0; i < cs.length; i++) cs[i].hidden = cs[i].dataset.cause !== key;

      // 証拠：**結果カードのトリセツ1枚とタイプ名をそのまま借りる。**
      // 文面を二重に持たず、いま見たばかりの自分の結果で話を進める。
      var slot = document.getElementById('dcCard');
      var card = mount.querySelector('.ts-card');
      if (card && !slot.firstChild) slot.appendChild(card.cloneNode(true));
      var tname = mount.querySelector('.tname');
      if (tname) {
        document.getElementById('dcTypeNote').textContent =
          ${JSON.stringify(TYPE_NOTE)}.replace('{type}', tname.textContent);
      }
      // どちらか欠けたら、文だけが浮くのでまとめて畳む
      document.getElementById('dcDemo').hidden = !(slot.firstChild && tname);
      show('bridge');
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
      }).catch(function () {}).finally(function () { declaredNow = true; showBridge(); });
    }

    /**
     * フォークを開く。via は 'cta'（ボタン）か 'auto'（滞在で自動）。
     *
     * **閉じられても、ボタンからは開き直せる。** auto だけが一度きり。
     * 宣言まで終えた人は、ボタンを押したらそのままガイドへ通す。
     */
    function openFork(via) {
      autoDone = true;
      if (declaredNow) { toGuide(); return; }
      show('domain');
      panel.showModal();
      // 背面が動くと、モーダルの下で結果が流れていく。閉じるまで止める
      document.body.style.overflow = 'hidden';
      document.body.dataset.fork = via;
      if (prompted) return;
      prompted = true;
      // 「出した」ことを記録する。**宣言率だけでは、出していないのか無視されたのかが分からない**
      fetch('/api/declaration/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabToken: token, via: via })
      }).catch(function () {});
    }

    panel.addEventListener('close', function () { document.body.style.overflow = ''; });
    document.getElementById('dcClose').addEventListener('click', function () { panel.close(); });
    openGuide.addEventListener('click', function () { openFork('cta'); });

    // ── ボタンを押さない人に出す（auto） ──
    // ①深層（カードの終盤）まで読んだ ②スクロールが止まったまま、のどちらか。
    // **どちらも最低滞在を満たしてから**で、開いた直後に被せることはしない。
    // 早すぎるときは捨てずに、足りない分だけ待ち直す。
    var born = Date.now();
    var lastMove = born;
    var idleTimer = setInterval(function () {
      if (autoDone) { clearInterval(idleTimer); return; }
      if (Date.now() - lastMove >= ${AUTO.IDLE_MS}) auto();
    }, 5000);
    window.addEventListener('scroll', function () { lastMove = Date.now(); }, { passive: true });

    function auto() {
      if (autoDone) return;
      // 裏に回っているタブに出しても意味がない。戻ってきたときに改めて出す
      if (document.hidden) return;
      var left = ${AUTO.MIN_MS} - (Date.now() - born);
      if (left > 0) { setTimeout(auto, left); return; }
      openFork('auto');
    }

    var deep = mount.querySelector('.deep-section');
    if (deep && window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (!entries[i].isIntersecting) continue;
          io.disconnect();
          // 読み終えた直後に被せない。ひと呼吸おいてから
          setTimeout(auto, ${AUTO.READ_MS});
        }
      }, { threshold: 0.4 });
      io.observe(deep);
    }

    // 設問の選択。ボタンは3枚の設問に散っているので、器側で1つだけ受ける
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-k]');
      if (!b) return;
      var kind = b.dataset.k, value = b.dataset.v;
      if (kind === 'domain') {
        picked.domain = value; picked.target = null; picked.deadline = null;
        // ③まだ分からない：相手を特定できないので、ここで記録してブリッジへ（A-3）
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
    document.getElementById('dcGo').addEventListener('click', toGuide);
    // 飛ばせるようにしておく。全員が宣言済みになると、宣言の有無で申込率を比べられない。
    document.getElementById('dcSkip').addEventListener('click', toGuide);
  }
})();
`;

export function resultShell(): string {
  return page(
    { title: '診断結果 | ナチュール診断', noindex: true, script: SHELL_SCRIPT, head: DECLARE_CSS },
    '<div class="app">' +
      '<header class="app-header">ナチュール診断</header>' +
      '<section class="screen active" id="result"><div id="resultMount"></div></section>' +
      // 宣言のフォーク（A-1）。結果に重ねて出す。CTAを押した人にも、押さない人にも
      declareSection() +
    '</div>'
  );
}
