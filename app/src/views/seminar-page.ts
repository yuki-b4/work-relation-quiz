/**
 * セミナーの告知ページ（`/seminar/{slug}`）。
 *
 * 要件：アプリ化要件定義.md F4-5「セミナーの告知ページ」。
 * 参加申込はここでは受けず、Peatix のイベントページへ送る。
 *
 * **診断サイトの見た目（prototype.html のCSS・ヘッダー・フッター）は使わない。** 独立したLPとして、
 * デジタル庁デザインシステム（DADS）の考え方で組む（2026-09-25）。根拠にしたのは公式の配布物：
 *   ・@digital-go-jp/design-tokens 2.0.1（色・文字サイズ・行間・角丸）
 *   ・digital-go-jp/design-system-example-components（ボタン・リンク・見出し・定義リスト・アコーディオン）
 * 取り入れたこと：本文16px以上と行間1.75／文字サイズは rem（OSやブラウザの設定に従う）／
 * リンクは常に下線／ボタンは高さ56px・角丸8px／キーボード操作のフォーカスは黒い枠と黄色の光彩／
 * FAQ はHTMLの details で開閉（JSなし）／本文へ飛ぶリンク／強制カラーモードと視覚効果低減への配慮。
 *
 * トーン＆マナー（色・書体・カードや波の見せ方）は、集客用LPの手本（ポジウィルキャリア）に寄せた。
 * 詳しくは LP_CSS の説明。**色とフォントは `:root` の --lp-* にだけ書く。**
 *
 * **文面はここに書かない。** 正は `セミナーLP文面.md` で、`npm run content` が
 * `src/content/seminars.ts` に写している。この器は、開催情報から日時の表記・申込ボタン・
 * 構造化データを組み、終了後の表示に切り替えるだけ。
 */
import type { Seminar, SeminarImage } from '../content/seminars.ts';
import { websiteLd } from './info-page.ts';
import { ICONS } from './layout.ts';
import { esc } from './result.ts';

const SITE = 'ナチュール診断';
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * 書体。和文は Noto Sans JP（DADS と同じ）、英字と数字は Outfit、キャッチは Zen Kurenaido（手書き風）。
 * 手書き風はキャッチの字だけを配る（`text=`）。全部の字を読み込むと重いため。
 */
function fonts(catchText: string): string {
  const hand = encodeURIComponent([...new Set(catchText)].join(''));
  return (
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Outfit:wght@500;600&display=swap" rel="stylesheet">' +
    `<link href="https://fonts.googleapis.com/css2?family=Zen+Kurenaido&display=swap&text=${hand}" rel="stylesheet">`
  );
}

/**
 * このページの見た目。
 *
 * **組み方は DADS**（本文16px以上・rem 指定・リンクは下線・フォーカスは黒い枠と黄色の光彩・
 * ボタンは高さ56px以上・FAQ は details・WCAG 2.2 AA のコントラスト）。
 * **トーン＆マナーは集客用LPの手本（ポジウィルキャリア）**に寄せる：水色のキーカラー、黄色の丸い申込ボタン、
 * 淡い水色の地、角の丸いカード、STEP の帯、波の背景、紺のフッター、英字の小見出し、手書き風のキャッチ。
 * 色は手本のスクリーンショットの画素から拾った（2026-09-25）。ロゴ・画像・文言は流用しない。
 *
 * 手本の水色（#00b6d9）は白地で 2.4:1 しかなく、文字には使えない。**文字の水色は同じ色相で濃くした**：
 * 大きな見出し・数字は #0091ad（3.7:1。大きな文字の基準 3:1）、小さな文字は #00778f（5.2:1。基準 4.5:1）。
 * 手本の水色は飾り（点・チェック・帯）にだけ使う。帯の上の STEP も白でなく紺の文字にした（白だと 1.5:1）。
 */
const LP_CSS = `
:root{
  --lp-font:'Noto Sans JP',-apple-system,BlinkMacSystemFont,sans-serif;
  --lp-font-en:'Outfit','Noto Sans JP',sans-serif;
  --lp-font-hand:'Zen Kurenaido','Noto Sans JP',sans-serif;
  --lp-cyan:#00b6d9; --lp-cyan-strong:#0091ad; --lp-cyan-text:#00778f;
  --lp-step-1:#70dff1; --lp-step-2:#38cae2; --lp-step-3:#01b5d3; --lp-step-4:#03a8c4; --lp-step-5:#049bb4;
  --lp-aqua:#f1fcfd; --lp-aqua-hero:#e7f6fc; --lp-bubble:#d2faff; --lp-bubble-soft:#e6fcfe;
  --lp-wave-a:#9ddee6; --lp-wave-b:#75cce1; --lp-wave-c:#35a5cf;
  --lp-yellow:#ffda03; --lp-yellow-hover:#f5cb00; --lp-yellow-active:#e6bd00;
  --lp-ink:#2c2c2c; --lp-sub:#767676; --lp-rule:#d7eef3;
  --lp-navy:#022c42; --lp-navy-2:#0d4c6d;
  --lp-focus:#ffd43d; --lp-disabled-bg:#b3b3b3; --lp-disabled-text:#ffffff;
  --lp-shadow:0 6px 24px rgba(2,44,66,.08);
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%; scroll-behavior:smooth; scroll-padding-top:4.5rem}
body{margin:0; background:#fff; color:var(--lp-ink); font-family:var(--lp-font);
  font-size:1rem; line-height:1.75; letter-spacing:.04em; overflow-wrap:anywhere}
img{max-width:100%; height:auto; display:block}
/* 見出し・箇条書き・ボタンは文節の切れ目で折る（「限り／ません」「理／由」のような1字だけの行を作らない） */
.lp-h1,.lp-h2,.lp-closing,.lp-closing-note,.lp-lead p,.lp-body li,.lp-faq summary,.lp-btn,.lp-support,.lp-sub{word-break:auto-phrase; text-wrap:balance}
p{text-wrap:pretty}
h1,h2,h3,p,ul,ol,dl,dd{margin:0}
ul,ol{padding:0}

.lp-skip{position:absolute; left:.5rem; top:-5rem; z-index:20; padding:.75rem 1rem; background:#fff;
  color:var(--lp-cyan-text); font-weight:700; border-radius:.5rem}
.lp-skip:focus{top:.5rem}

a{color:var(--lp-cyan-text); text-decoration:underline; text-underline-offset:.1875rem}
a:hover{text-decoration-thickness:.1875rem}
a:focus-visible,summary:focus-visible,.lp-btn:focus-visible{
  outline:4px solid #000; outline-offset:2px; box-shadow:0 0 0 2px var(--lp-focus)}
a:not(.lp-btn):focus-visible{background:var(--lp-focus); color:#000; border-radius:.25rem}

.lp-wrap{max-width:62rem; margin:0 auto; padding:0 1.25rem}
.lp-prose{max-width:42rem; margin:0 auto}
.lp-num{font-family:var(--lp-font-en); font-weight:600; letter-spacing:.02em}

/* ヘッダー：白地に名乗りと小さな申込ボタン。スクロールしても上に残す */
.lp-header{position:sticky; top:0; z-index:10; background:rgba(255,255,255,.96); box-shadow:0 1px 0 var(--lp-rule)}
.lp-header .lp-wrap{display:flex; align-items:center; justify-content:space-between; gap:1rem; min-height:4rem}
.lp-brand{line-height:1.2; color:var(--lp-ink); font-weight:700; font-size:.9375rem}
.lp-brand span{display:block; font-family:var(--lp-font-en); font-weight:500; font-size:.75rem; letter-spacing:.14em; color:var(--lp-cyan-text)}
.lp-header .lp-btn{min-height:2.75rem; padding:0 1.25rem; font-size:.875rem; width:auto; box-shadow:none}
.lp-header-date{font-size:.875rem; font-weight:700; color:var(--lp-cyan-text)}

/* ファーストビュー：白から淡い水色へ。写真があれば右（スマホでは上）に置き、無ければ泡の飾り */
.lp-hero{position:relative; overflow:hidden; background:linear-gradient(105deg,#fff 0%,#fff 32%,var(--lp-aqua-hero) 100%)}
.lp-bubble{position:absolute; border-radius:50%; background:var(--lp-bubble); pointer-events:none}
.lp-bubble.b1{width:18rem; height:18rem; right:-5rem; top:2rem; opacity:.7}
.lp-bubble.b2{width:9rem; height:9rem; right:9rem; top:13rem; background:var(--lp-bubble-soft)}
.lp-bubble.b3{display:none; width:5rem; height:5rem; right:2rem; bottom:3rem; opacity:.8}
.lp-hero-photo{position:relative; aspect-ratio:4/3; overflow:hidden}
.lp-hero-photo img{width:100%; height:100%; object-fit:cover; object-position:62% 40%}
.lp-hero-photo::after{content:""; position:absolute; inset:auto 0 0 0; height:35%;
  background:linear-gradient(to bottom,rgba(255,255,255,0),#f6fbfd)}
.lp-hero-body{position:relative; padding:2rem 0 3rem}
.lp-chip{display:inline-flex; flex-wrap:wrap; gap:0 1em; padding:.375rem 1rem; border:1px solid var(--lp-cyan);
  border-radius:999px; background:#fff; color:var(--lp-cyan-text); font-weight:700; font-size:.875rem; line-height:1.5}
.lp-catch{margin-top:1.25rem;
  font-family:var(--lp-font-hand); font-weight:400; color:var(--lp-cyan-strong);
  font-size:clamp(2.25rem,9.5vw,3.75rem); line-height:1.3; letter-spacing:.04em}
.lp-h1{margin-top:1rem; font-size:clamp(1.625rem,6.6vw,2.625rem); font-weight:700; line-height:1.5; letter-spacing:.06em}
.lp-sub{margin-top:1rem; font-size:clamp(1.0625rem,4.4vw,1.5rem); font-weight:700; line-height:1.6; letter-spacing:.06em}
@media (min-width:64rem){
  .lp-hero{min-height:40rem}
  .lp-hero-photo{position:absolute; inset:0 0 0 auto; width:50%; aspect-ratio:auto}
  .lp-hero-photo::after{inset:0 auto 0 0; width:45%; height:auto; background:linear-gradient(to right,#fff,rgba(255,255,255,0))}
  .lp-hero-body{padding:4.5rem 0 5rem; max-width:36rem}
  .lp-h1{font-size:2.375rem; letter-spacing:.04em}
  /* 写真が無いあいだは、右の空きにバッジを大きく寄せる（手本の実績の丸の位置） */
  .lp-hero:not(.has-photo) .lp-hero-body{display:grid; grid-template-columns:minmax(0,36rem) 1fr; gap:3rem; align-items:center; max-width:none}
  .lp-hero:not(.has-photo) .lp-badges{display:grid; grid-template-columns:repeat(2,11rem); justify-content:center; gap:1rem 1.5rem; margin:0}
  .lp-hero:not(.has-photo) .lp-badge{width:11rem; height:11rem}
  .lp-hero:not(.has-photo) .lp-badge:nth-child(2){transform:translateY(5.5rem)}
  .lp-hero:not(.has-photo) .lp-badge:nth-child(3){grid-column:1/-1; justify-self:center; margin-top:.5rem; transform:translateX(-3rem)}
  .lp-hero:not(.has-photo) .lp-badge-label{font-size:1rem}
  .lp-hero:not(.has-photo) .lp-badge-value{font-size:1.5rem}
  .lp-hero:not(.has-photo) .lp-badge-value .lp-num{font-size:3rem}
  .lp-bubble.b3{display:block}
}

/* 申込ボタン：黄色の丸いボタンに水色の点（手本）。高さ・フォーカスは DADS */
.lp-cta{margin-top:2rem}
.lp-btn{display:inline-flex; align-items:center; justify-content:center; gap:.625rem; width:100%; max-width:28rem;
  min-height:4rem; padding:.75rem 1.5rem; border:4px double transparent; border-radius:999px;
  background:var(--lp-yellow); color:var(--lp-ink); font-size:clamp(1rem,4.4vw,1.125rem); font-weight:700; line-height:1.4;
  letter-spacing:.04em; text-align:center; text-decoration:none; box-shadow:0 6px 16px rgba(0,0,0,.12)}
.lp-btn::before{content:""; flex:0 0 .5rem; width:.5rem; height:.5rem; border-radius:50%; background:var(--lp-cyan)}
.lp-btn:visited{color:var(--lp-ink)}
.lp-btn:hover{background:var(--lp-yellow-hover); text-decoration:underline}
.lp-btn:active{background:var(--lp-yellow-active)}
.lp-btn[aria-disabled="true"]{background:var(--lp-disabled-bg); color:var(--lp-disabled-text); box-shadow:none; cursor:default; text-decoration:none}
.lp-btn[aria-disabled="true"]::before{background:#fff}
.lp-support{margin-top:.625rem; font-size:.875rem; line-height:1.6; color:var(--lp-sub)}

/* 事実だけの丸いバッジ（手本の実績バッジの位置。実績は作らない） */
.lp-badges{display:flex; flex-wrap:wrap; gap:.75rem; margin-top:2rem; list-style:none}
.lp-badge{display:flex; flex-direction:column; align-items:center; justify-content:center; width:6.5rem; height:6.5rem;
  border-radius:50%; background:var(--lp-bubble); text-align:center; box-shadow:var(--lp-shadow)}
.lp-badge-label{font-size:.75rem; font-weight:700; line-height:1.4; letter-spacing:.02em}
.lp-badge-value{margin-top:.125rem; font-size:1.125rem; font-weight:700; line-height:1.2; color:var(--lp-cyan-text)}
.lp-badge-value .lp-num{font-size:1.875rem; color:var(--lp-cyan-strong)}
@media (min-width:40rem){.lp-badge{width:7.5rem; height:7.5rem}}

/* 導入：短い段落を中央に */
.lp-lead{padding:3.5rem 0; text-align:center}
.lp-lead p{font-size:1.0625rem; line-height:2; font-weight:500}
.lp-lead p+p{margin-top:1.25rem}
@media (min-width:40rem){.lp-lead p{font-size:1.1875rem}}

/* 節：白と淡い水色を交互に。淡い水色の節は白いカードに載せる */
.lp-sec{padding:4rem 0}
.lp-sec.is-aqua{background:var(--lp-aqua)}
.lp-sec-head{text-align:center}
.lp-card{max-width:48rem; margin:0 auto; background:#fff; border-radius:1.5rem; box-shadow:var(--lp-shadow); padding:2rem 1.25rem}
@media (min-width:40rem){.lp-card{padding:2.75rem 3rem}}
.lp-eyebrow{font-family:var(--lp-font-en); font-style:italic; font-weight:500; font-size:1rem; color:var(--lp-sub); letter-spacing:.06em}
.lp-h2{margin:.25rem 0 1.75rem; font-size:clamp(1.375rem,5.6vw,2rem); font-weight:700; line-height:1.45; letter-spacing:.06em; color:var(--lp-cyan-strong)}
.lp-body p+p,.lp-body p+ul,.lp-body p+ol,.lp-body ul+p,.lp-body ol+p{margin-top:1.25rem}
.lp-body strong{font-weight:700}

/* 番号なしの箇条書き：水色のチェック */
.lp-body ul{list-style:none}
.lp-body ul li{position:relative; padding:.875rem 0 .875rem 2.25rem; border-bottom:1px solid var(--lp-rule); font-weight:500}
.lp-body ul li:first-child{padding-top:0}
.lp-body ul li:first-child::before{top:.125rem}
.lp-body ul li::before{content:""; position:absolute; left:0; top:1rem; width:1.5rem; height:1.5rem; border-radius:50%; background:var(--lp-cyan)}
.lp-body ul li::after{content:""; position:absolute; left:.5rem; top:1.3rem; width:.4rem; height:.7rem;
  border-right:2px solid #fff; border-bottom:2px solid #fff; transform:rotate(45deg)}
.lp-body ul li:first-child::after{top:.425rem}

/* 番号付きの箇条書き：STEP のカード。帯は水色から段々濃く（手本）。端数の行は中央に寄せる */
.lp-body ol{list-style:none; counter-reset:lp-step; display:flex; flex-wrap:wrap; justify-content:center; gap:1.25rem}
.lp-body ol li{flex:1 1 100%}
@media (min-width:40rem){.lp-body ol li{flex:0 1 calc((100% - 1.25rem) / 2)}}
@media (min-width:60rem){.lp-body ol li{flex-basis:calc((100% - 2.5rem) / 3)}}
.lp-body ol li{counter-increment:lp-step; background:#fff; border-radius:1.5rem; overflow:hidden; box-shadow:var(--lp-shadow);
  padding:0 1.25rem 1.5rem; text-align:center; font-size:.9375rem; line-height:1.7}
.lp-body ol li::before{content:"STEP " counter(lp-step); display:block; margin:0 -1.25rem 1.25rem; padding:.75rem 0;
  background:var(--lp-step-1); color:var(--lp-navy); font-family:var(--lp-font-en); font-weight:600; font-size:1.625rem;
  letter-spacing:.12em; line-height:1.3}
.lp-body ol li:nth-child(2)::before{background:var(--lp-step-2)}
.lp-body ol li:nth-child(3)::before{background:var(--lp-step-3)}
.lp-body ol li:nth-child(4)::before{background:var(--lp-step-4)}
.lp-body ol li:nth-child(n+5)::before{background:var(--lp-step-5)}
.lp-body ol li strong{display:block; margin-bottom:.5rem; font-size:1.0625rem; letter-spacing:.08em}

/* 登壇者 */
.lp-spk{display:flex; gap:1.25rem; align-items:center; margin-bottom:1.5rem}
.lp-spk img,.lp-initial{width:6rem; height:6rem; border-radius:50%; flex:0 0 6rem; object-fit:cover}
.lp-initial{display:flex; align-items:center; justify-content:center; background:var(--lp-bubble); color:var(--lp-cyan-strong); font-weight:700; font-size:2.25rem}
.lp-spk-name{font-size:1.375rem; font-weight:700; line-height:1.5; letter-spacing:.08em}
.lp-spk-role{font-size:.875rem; font-weight:700; line-height:1.6; color:var(--lp-cyan-text)}

/* 開催概要（DADS の Dl） */
.lp-dl{display:grid; grid-template-columns:auto 1fr; margin:0}
.lp-dl dt,.lp-dl dd{padding:1rem 0; border-bottom:1px solid var(--lp-rule)}
.lp-dl dt{padding-right:1.5rem; font-weight:700; color:var(--lp-cyan-text); white-space:nowrap}
.lp-dl dd{font-weight:500}
.lp-dl .lp-note{display:block; font-size:.875rem; font-weight:400; line-height:1.6; color:var(--lp-sub)}
.lp-nowrap{white-space:nowrap}

/* よくあるご質問（DADS の Accordion を、白いカードに載せる） */
.lp-faq{display:grid; gap:1rem}
.lp-faq details{background:#fff; border-radius:1rem; box-shadow:var(--lp-shadow)}
.lp-faq summary{position:relative; display:flex; gap:.75rem; align-items:baseline; cursor:pointer; list-style:none;
  padding:1.125rem 3.25rem 1.125rem 1.25rem; font-weight:700; line-height:1.6; border-radius:1rem}
.lp-faq summary::-webkit-details-marker{display:none}
.lp-faq summary:hover{background:var(--lp-aqua)}
.lp-faq .lp-q,.lp-faq .lp-a{font-family:var(--lp-font-en); font-weight:600; font-size:1.375rem; line-height:1; color:var(--lp-cyan-strong)}
.lp-faq summary::after{content:""; position:absolute; right:1.5rem; top:1.5rem; width:.5rem; height:.5rem;
  border-right:2px solid var(--lp-cyan-text); border-bottom:2px solid var(--lp-cyan-text); transform:rotate(45deg)}
.lp-faq details[open] summary::after{top:1.75rem; transform:rotate(-135deg)}
.lp-answer{display:flex; gap:.75rem; align-items:baseline; padding:0 1.25rem 1.25rem}
.lp-answer .lp-a{color:var(--lp-sub)}

/* 締め：波の上に中央寄せ（手本の「まずは無料の初回体験へ」の見せ方） */
.lp-close{position:relative; padding:0 0 4.5rem; background:linear-gradient(100deg,var(--lp-wave-a) 0%,var(--lp-wave-b) 50%,var(--lp-wave-c) 100%); text-align:center}
.lp-wave{display:block; width:100%; height:3rem; color:#fff}
.lp-wave.from-aqua{color:var(--lp-aqua)}
@media (min-width:40rem){.lp-wave{height:4.5rem}}
.lp-wave svg{display:block; width:100%; height:100%}
.lp-closing{padding-top:2.5rem; font-size:clamp(1.5rem,6.4vw,2.375rem); font-weight:700; line-height:1.5; letter-spacing:.12em; color:var(--lp-navy)}
.lp-closing-note{max-width:36rem; margin:1.25rem auto 0; font-weight:700; line-height:1.9; color:var(--lp-navy)}
.lp-close .lp-cta{display:flex; flex-direction:column; align-items:center}
.lp-close .lp-support,.lp-close .lp-ended{color:var(--lp-navy)}
.lp-ended{font-weight:700}

/* フッター：紺 */
.lp-footer{background:var(--lp-navy); color:#fff; padding:3rem 0 2.5rem; font-size:.875rem; line-height:1.8}
.lp-footer-brand{font-size:1.0625rem; font-weight:700; margin-bottom:.5rem}
.lp-footer a{color:#fff}
.lp-footer a:focus-visible{color:#000}
.lp-footer ul{list-style:none; display:flex; flex-wrap:wrap; gap:.5rem 2rem; margin-top:1rem}
.lp-footer small{display:block; margin-top:2rem; font-size:.75rem; opacity:.85}

@media (forced-colors:active){
  .lp-card,.lp-faq details,.lp-body ol li,.lp-badge{border:1px solid CanvasText}
  .lp-body ul li::before{background:CanvasText}
  .lp-btn::before{background:CanvasText}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`.replace(/\n\s*/g, ' ').trim();

/** 開始・終了の時刻（日本時間）を UNIX ミリ秒にする。 */
function at(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00+09:00`);
}

/** 終了時刻を過ぎたか。過ぎたら申込ボタンを外し、noindex にする。 */
export function seminarEnded(s: Seminar, now: number): boolean {
  return now >= at(s.date, s.end);
}

/** `10月10日（土）` の形。曜日は日付だけで決まるので、UTC で数えてよい。 */
function dayLabel(date: string, withYear = false): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${withYear ? `${y}年` : ''}${m}月${d}日（${wd}）`;
}

/** `13:00〜14:00`。狭い画面でも時刻の途中では折らない（折るなら日付との間で）。 */
const timeSpan = (s: Seminar) => `<span class="lp-nowrap">${esc(s.start)}〜${esc(s.end)}</span>`;

const feeLabel = (fee: string) => (fee === '無料' ? '参加無料' : `参加費 ${fee}`);

/** 構造化データ用の参加費。「無料」は 0。数字が読めなければ出さない。 */
function priceOf(fee: string): number | null {
  if (fee.includes('無料')) return 0;
  const n = Number(fee.replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function imageUrl(origin: string, slug: string, name: string, img: SeminarImage): string {
  return `${origin}/seminar/${slug}/${name}.${img.ext}?v=${img.version}`;
}

/**
 * `|` の位置で改行する。**狭い画面でも改行する。** 1行が12字前後で収まる長さなので、
 * 自然な折り返しに任せると「やめ／る」のように語の途中で折れる方が読みにくい。
 */
const joinLines = (lines: string[]) => lines.map(esc).join('<br>');

/** 数字だけ英字の書体にする（`60分` の `60`）。手本のLPは数字を大きく、英字の書体で見せている。 */
const nums = (text: string) => esc(text).replace(/\d+/g, (d) => `<span class="lp-num">${d}</span>`);

/** 申込ボタンの文言。無料なら「無料で」を先に言う（手本のボタンの言い方）。 */
const applyLabel = (s: Seminar) => (s.fee === '無料' ? '無料で申し込む' : `申し込む（${s.fee}）`);

/**
 * 申込ボタン。終了後は診断への導線に、申込URLが未設定のあいだは押せない表示にする。
 * Peatix へは同じタブで移る（別タブにすると、戻ってきた人が迷う）。行き先は補足で先に伝える。
 */
function cta(s: Seminar, ended: boolean): string {
  if (ended) {
    return (
      '<div class="lp-cta">' +
        '<p class="lp-ended">このセミナーは終了しました。</p>' +
        '<p class="lp-support">ナチュール診断は、いつでも受けられます。</p>' +
        '<a class="lp-btn" href="/" style="margin-top:1rem">診断を受ける（約2分・無料）</a>' +
      '</div>'
    );
  }
  const button = s.ticketUrl
    ? `<a class="lp-btn" href="${esc(s.ticketUrl)}">${esc(applyLabel(s))}</a>`
    // 押せない状態は aria-disabled で伝える（DADS のボタンと同じ）。リンクにはしない
    : '<span class="lp-btn" role="link" aria-disabled="true">お申し込みの受付は準備中です</span>';
  const support = [
    s.ctaNote,
    s.ticketUrl ? 'お申し込みは、イベント受付サービスのPeatixで受け付けます。' : '',
  ].filter(Boolean);
  return (
    '<div class="lp-cta">' +
      button +
      support.map((t) => `<p class="lp-support">${esc(t)}</p>`).join('') +
    '</div>'
  );
}

function speakerBlock(s: Seminar, origin: string): string {
  const img = s.images.speaker;
  const face = img
    ? `<img src="${esc(imageUrl(origin, s.slug, 'speaker', img))}" alt="${esc(s.speakerName)}の写真"` +
      ` width="${img.width}" height="${img.height}" loading="lazy">`
    // 写真が無いあいだは名前の頭文字。空の枠や仮の写真は置かない
    : `<span class="lp-initial" aria-hidden="true">${esc(s.speakerName.slice(0, 1))}</span>`;
  return (
    '<div class="lp-spk">' + face +
      '<div>' +
        `<p class="lp-spk-name">${esc(s.speakerName)}</p>` +
        `<p class="lp-spk-role">${esc(s.speakerRole)}</p>` +
      '</div>' +
    '</div>'
  );
}

function overview(s: Seminar, ended: boolean): string {
  const apply = ended
    ? '受付を終了しました'
    : s.ticketUrl
      ? `<a href="${esc(s.ticketUrl)}">Peatixのイベントページ</a>から`
      : '準備中です（Peatixで受け付けます）';
  return (
    '<dl class="lp-dl">' +
      `<dt>日時</dt><dd>${esc(dayLabel(s.date, true))}${timeSpan(s)}</dd>` +
      `<dt>形式</dt><dd>${esc(s.place)}${s.placeNote ? `<span class="lp-note">${esc(s.placeNote)}</span>` : ''}</dd>` +
      `<dt>参加費</dt><dd>${esc(s.fee)}</dd>` +
      `<dt>登壇</dt><dd>${esc(s.speakerName)}</dd>` +
      '<dt>主催</dt><dd>ナチュール診断（運営：Mikata）</dd>' +
      `<dt>お申し込み</dt><dd>${apply}</dd>` +
    '</dl>'
  );
}

/** 節の背景。先頭から淡い水色と白を交互にする（締めの波の色もこれに合わせる）。 */
const isAqua = (i: number) => i % 2 === 0;

/**
 * 節を並べる。背景は淡い水色と白を交互にして、節の切れ目を色で示す。
 * 淡い水色の節は、本文を白いカードに載せる（手本の見せ方）。ただし STEP と FAQ は
 * それ自体がカードなので、カードの中にカードを入れない。
 */
function sections(s: Seminar, origin: string, ended: boolean): string {
  return s.sections.map((sec, i) => {
    const aqua = isAqua(i);
    const id = `sec-${i + 1}`;
    // 英字は飾り。読み上げでは見出しだけを読む
    const head =
      '<div class="lp-sec-head">' +
        (sec.eyebrow ? `<p class="lp-eyebrow" aria-hidden="true">${esc(sec.eyebrow)}</p>` : '') +
        `<h2 class="lp-h2" id="${id}">${esc(sec.heading)}</h2>` +
      '</div>';
    let body: string;
    let carded = aqua;
    switch (sec.kind) {
      case 'speaker':
        body = speakerBlock(s, origin) + `<div class="lp-body">${sec.html}</div>`;
        break;
      case 'overview':
        body = overview(s, ended);
        break;
      case 'faq':
        carded = false;
        body =
          '<div class="lp-faq">' +
            sec.items.map((it) =>
              `<details><summary><span class="lp-q" aria-hidden="true">Q</span><span>${esc(it.q)}</span></summary>` +
              `<div class="lp-answer"><span class="lp-a" aria-hidden="true">A</span><div class="lp-body">${it.html}</div></div></details>`
            ).join('') +
          '</div>';
        break;
      default:
        if (sec.html.includes('<ol')) carded = false;
        body = `<div class="lp-body">${sec.html}</div>`;
    }
    // STEP は横に並べるので幅いっぱい。それ以外は読みやすい行の長さに収める
    const wide = sec.kind === 'text' && sec.html.includes('<ol');
    const inner = carded ? `<div class="lp-card">${body}</div>` : wide ? body : `<div class="lp-prose">${body}</div>`;
    return (
      `<section class="lp-sec${aqua ? ' is-aqua' : ''}" aria-labelledby="${id}">` +
        `<div class="lp-wrap">${head}${inner}</div>` +
      '</section>'
    );
  }).join('');
}

/** 締めの上端の波。直前の節の背景色で描いて、波の形に切り取ったように見せる。 */
function wave(fromAqua: boolean): string {
  return (
    `<div class="lp-wave${fromAqua ? ' from-aqua' : ''}" aria-hidden="true">` +
      '<svg viewBox="0 0 1440 80" preserveAspectRatio="none" focusable="false">' +
        '<path d="M0 0H1440V34C1260 78 1080 80 900 58C720 36 540 12 360 22C200 31 90 52 0 64Z" fill="currentColor"/>' +
      '</svg>' +
    '</div>'
  );
}

/**
 * Event の構造化データ（検索結果のイベント表示に使われる）。
 * 申込URLが未設定のあいだは、このページ自身を申込先として書く。
 */
function eventLd(s: Seminar, origin: string, canonical: string, ended: boolean) {
  const image = s.images.og
    ? [imageUrl(origin, s.slug, 'og', s.images.og)]
    : s.images.hero ? [imageUrl(origin, s.slug, 'hero', s.images.hero)] : [`${origin}/ogp.png`];
  const price = priceOf(s.fee);
  return {
    '@type': 'Event',
    name: s.title,
    description: s.description,
    startDate: `${s.date}T${s.start}:00+09:00`,
    endDate: `${s.date}T${s.end}:00+09:00`,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'VirtualLocation', url: s.ticketUrl || canonical },
    image,
    inLanguage: 'ja',
    organizer: { '@type': 'Organization', name: 'Mikata', url: `${origin}/about` },
    performer: { '@type': 'Person', name: s.speakerName },
    ...(price === null ? {} : {
      offers: {
        '@type': 'Offer',
        price,
        priceCurrency: 'JPY',
        url: s.ticketUrl || canonical,
        availability: ended ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      },
    }),
  };
}

function head(s: Seminar, origin: string, canonical: string, ended: boolean): string {
  const og = s.images.og;
  const ogUrl = og ? imageUrl(origin, s.slug, 'og', og) : `${origin}/ogp.png`;
  const ogW = og ? og.width : 1200;
  const ogH = og ? og.height : 630;

  const graph = [
    websiteLd(origin),
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE, item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: s.title, item: canonical },
      ],
    },
    eventLd(s, origin, canonical, ended),
  ];
  // JSON を <script> に埋めるので、`</` だけは崩しておく（本文に `</script>` が来ても閉じないように）
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/<\//g, '<\\/');

  return (
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    `<title>${esc(s.title)} | ${SITE}</title>` +
    `<meta name="description" content="${esc(s.description)}">` +
    (ended ? '<meta name="robots" content="noindex, nofollow">' : '') +
    `<link rel="canonical" href="${esc(canonical)}">` +
    ICONS +
    '<meta property="og:type" content="website">' +
    `<meta property="og:site_name" content="${SITE}">` +
    `<meta property="og:title" content="${esc(s.title)}">` +
    `<meta property="og:description" content="${esc(s.description)}">` +
    `<meta property="og:url" content="${esc(canonical)}">` +
    '<meta property="og:locale" content="ja_JP">' +
    `<meta property="og:image" content="${esc(ogUrl)}">` +
    `<meta property="og:image:width" content="${ogW}">` +
    `<meta property="og:image:height" content="${ogH}">` +
    `<meta property="og:image:alt" content="${esc(s.title)}">` +
    '<meta name="twitter:card" content="summary_large_image">' +
    `<meta name="twitter:image" content="${esc(ogUrl)}">` +
    `<script type="application/ld+json">${jsonLd}</script>` +
    fonts(s.catchLines.join('')) +
    `<style>${LP_CSS}</style>`
  );
}

export function seminarPage(s: Seminar, origin: string, now: number): string {
  const canonical = `${origin}/seminar/${s.slug}`;
  const ended = seminarEnded(s, now);
  const open = !ended && !!s.ticketUrl;

  const hero = s.images.hero;
  // 写真があれば写真、無いあいだは淡い泡の飾り（空の枠や仮の写真は置かない）
  const heroVisual = hero
    ? '<div class="lp-hero-photo">' +
        `<img src="${esc(imageUrl(origin, s.slug, 'hero', hero))}" alt=""` +
        ` width="${hero.width}" height="${hero.height}" fetchpriority="high">` +
      '</div>'
    : '<span class="lp-bubble b1" aria-hidden="true"></span>' +
      '<span class="lp-bubble b2" aria-hidden="true"></span>' +
      '<span class="lp-bubble b3" aria-hidden="true"></span>';

  // 日時と形式。参加費はバッジにあればそちらに任せる。項目の途中では折らない。折るなら項目の切れ目で
  const feeInBadges = s.badges.some((b) => b.label.includes('参加費'));
  const chip = [`${dayLabel(s.date)} ${s.start}〜${s.end}`, s.place, ...(feeInBadges ? [] : [feeLabel(s.fee)])]
    .map((x) => `<span class="lp-nowrap">${nums(x)}</span>`).join('');

  const badges = s.badges.length
    ? '<ul class="lp-badges">' +
        s.badges.map((b) =>
          `<li class="lp-badge"><span class="lp-badge-label">${esc(b.label)}</span>` +
          `<span class="lp-badge-value">${nums(b.value)}</span></li>`
        ).join('') +
      '</ul>'
    : '';

  const lastAqua = s.sections.length > 0 && isAqua(s.sections.length - 1);
  const closing = s.closing && !ended;

  const body =
    '<a class="lp-skip" href="#main">本文へ移動</a>' +
    '<header class="lp-header"><div class="lp-wrap">' +
      `<p class="lp-brand">${SITE}<span>ONLINE SEMINAR</span></p>` +
      (open
        ? `<a class="lp-btn" href="${esc(s.ticketUrl)}">${esc(applyLabel(s))}</a>`
        : `<p class="lp-header-date">${nums(`${dayLabel(s.date)} ${s.start}〜`)}</p>`) +
    '</div></header>' +
    '<main id="main">' +
      `<div class="lp-hero${hero ? ' has-photo' : ''}">` +
        heroVisual +
        '<div class="lp-wrap"><div class="lp-hero-body"><div class="lp-hero-text">' +
          `<p class="lp-chip">${chip}</p>` +
          `<p class="lp-catch">${joinLines(s.catchLines)}</p>` +
          `<h1 class="lp-h1">${joinLines(s.headlineLines)}</h1>` +
          `<p class="lp-sub">${joinLines(s.subLines)}</p>` +
          cta(s, ended) +
        '</div>' +
        badges +
        '</div></div>' +
      '</div>' +
      (s.lead ? `<div class="lp-lead"><div class="lp-wrap lp-body">${s.lead}</div></div>` : '') +
      sections(s, origin, ended) +
      (closing
        ? '<section class="lp-close" aria-labelledby="sec-close">'
        : '<section class="lp-close" aria-label="お申し込み">') +
        wave(lastAqua) +
        '<div class="lp-wrap">' +
          (closing ? `<h2 class="lp-closing" id="sec-close">${s.closing.split('|').map(nums).join('<br>')}</h2>` : '') +
          (closing && s.closingNote ? `<p class="lp-closing-note">${esc(s.closingNote)}</p>` : '') +
          cta(s, ended) +
        '</div>' +
      '</section>' +
    '</main>' +
    '<footer class="lp-footer"><div class="lp-wrap">' +
      `<p class="lp-footer-brand">${SITE}</p>` +
      '<p>主催：ナチュール診断（運営：Mikata）</p>' +
      '<ul>' +
        '<li><a href="/privacy">プライバシーポリシー</a></li>' +
        '<li><a href="/contact">お問い合わせ</a></li>' +
        `<li><a href="/">${SITE}を受ける</a></li>` +
      '</ul>' +
      '<small>&copy; Mikata</small>' +
    '</div></footer>';

  return `<!DOCTYPE html><html lang="ja"><head>${head(s, origin, canonical, ended)}</head><body>${body}</body></html>`;
}
