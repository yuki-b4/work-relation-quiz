/**
 * Admin の器。
 *
 * 診断側の器（views/layout.ts）とは分ける。診断は1カラム・最大640pxの読み物で、
 * `body{display:flex; justify-content:center}` が効いている。Admin は横に広い表を出すので、
 * その CSS の上に載せると必ず窮屈になる。
 *
 * **prototype.html には Admin 画面が無いので、ここの CSS は機械抽出の対象外**（作業の約束1）。
 * ただし色だけは診断側と揃えたいので、APP_CSS の `:root{...}` をそのまま切り出して使う。
 * 手で色を書き写すと、あとで診断側の色を変えたときにここだけ古い色が残る。
 */
import { APP_CSS } from '../../content/styles.ts';
import { esc } from '../result.ts';

/** APP_CSS の先頭にある `:root{ ... }` を丸ごと取り出す。無ければ最低限の色だけ返す。 */
function rootVars(): string {
  const i = APP_CSS.indexOf(':root{');
  if (i < 0) return ':root{--bg:#F3F3EF;--surface:#FFF;--ink:#232427;--muted:#6E7176;--faint:#9A9CA0;--line:#E4E3DD;--chrome:#2B333D;--coral:#C0492B;--teal:#0F6E56;--trust:#274A73}';
  const end = APP_CSS.indexOf('}', i);
  return end < 0 ? '' : APP_CSS.slice(i, end + 1);
}

const ADMIN_CSS = `
${rootVars()}
*{box-sizing:border-box;margin:0;padding:0}
[hidden]{display:none !important}
body{font-family:"Noto Sans JP",system-ui,sans-serif; color:var(--ink); background:var(--bg);
  line-height:1.7; font-size:14px; -webkit-text-size-adjust:100%}
a{color:var(--trust)}
.ad-bar{background:var(--chrome); color:#fff; padding:10px 18px; display:flex; align-items:center;
  gap:18px; flex-wrap:wrap; position:sticky; top:0; z-index:20}
.ad-bar b{font-size:15px; font-weight:700; letter-spacing:.04em}
.ad-nav{display:flex; gap:14px; flex-wrap:wrap; flex:1}
.ad-nav a{color:#D7DBE0; text-decoration:none; padding:3px 0; border-bottom:2px solid transparent; font-size:13px}
.ad-nav a:hover{color:#fff}
.ad-nav a[aria-current]{color:#fff; border-bottom-color:var(--coral)}
.ad-me{font-size:12px; color:#AEB5BD; display:flex; gap:10px; align-items:center}
.ad-me button{background:none; border:1px solid #55606C; color:#D7DBE0; border-radius:6px;
  padding:3px 10px; font:inherit; font-size:12px; cursor:pointer}
.ad-me button:hover{border-color:#8A939D; color:#fff}
.wrap{max-width:1240px; margin:0 auto; padding:18px}
h1{font-size:19px; font-weight:700; margin-bottom:4px}
h2{font-size:15px; font-weight:700; margin:0 0 10px}
.sub{color:var(--muted); font-size:12px; margin-bottom:14px}
.panel{background:var(--surface); border:1px solid var(--line); border-radius:10px;
  padding:16px; margin-bottom:14px}
.panel > h2{padding-bottom:8px; border-bottom:1px solid var(--line)}
.warn{background:#FBEDE7; border:1px solid #E7C3B6; color:var(--coral-ink,#7A2E1A);
  border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:13px}
.ok{background:#E3F1EB; border:1px solid #B6D8CB; color:#0A4A3A; border-radius:8px;
  padding:10px 14px; margin-bottom:14px; font-size:13px}
table{border-collapse:collapse; width:100%; font-size:13px}
.scroll{overflow-x:auto; -webkit-overflow-scrolling:touch}
th,td{border-bottom:1px solid var(--line); padding:7px 9px; text-align:left; vertical-align:top;
  white-space:nowrap}
th{background:#F7F7F4; font-weight:700; font-size:12px; color:var(--muted); position:sticky; top:0}
td.wrap-cell{white-space:normal; min-width:220px; max-width:420px}
tr:hover td{background:#FAFAF8}
tr.is-alert td{background:#FDF3EF}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px}
.muted{color:var(--muted)}
.faint{color:var(--faint)}
.tag{display:inline-block; border-radius:999px; padding:1px 9px; font-size:11px; font-weight:700;
  border:1px solid var(--line); background:#F7F7F4; color:var(--muted); white-space:nowrap}
.tag.on{background:var(--teal-soft,#E3F1EB); border-color:#B6D8CB; color:#0A4A3A}
.tag.off{background:#F2F2EF; color:var(--faint)}
.tag.alert{background:#FBEDE7; border-color:#E7C3B6; color:#7A2E1A}
.filters{display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end}
.f{display:flex; flex-direction:column; gap:3px}
.f label{font-size:11px; color:var(--muted); font-weight:700}
input,select,textarea{font:inherit; font-size:13px; color:var(--ink); background:#fff;
  border:1px solid #CFCEC7; border-radius:7px; padding:6px 9px}
input:focus,select:focus,textarea:focus{outline:2px solid var(--trust); outline-offset:-1px}
textarea{width:100%; min-height:78px; resize:vertical; line-height:1.7}
.btn{display:inline-block; background:var(--chrome); color:#fff; border:1px solid var(--chrome);
  border-radius:7px; padding:6px 15px; font:inherit; font-size:13px; font-weight:700;
  cursor:pointer; text-decoration:none; text-align:center}
.btn:hover{background:var(--chrome-hover,#3A444F)}
.btn.ghost{background:#fff; color:var(--ink); border-color:#CFCEC7; font-weight:400}
.btn.ghost:hover{background:#F4F4F1}
.btn.danger{background:#fff; color:var(--coral); border-color:#E0B5A8}
.btn.danger:hover{background:#FBEDE7}
.btn.sm{padding:3px 10px; font-size:12px; font-weight:400}
.pager{display:flex; gap:10px; align-items:center; margin-top:12px; font-size:13px}
.grid2{display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:14px}
dl.kv{display:grid; grid-template-columns:max-content 1fr; gap:5px 16px; font-size:13px}
dl.kv dt{color:var(--muted); white-space:nowrap}
dl.kv dd{word-break:break-all}
.bar{display:grid; grid-template-columns:80px 1fr; gap:10px; align-items:center; margin-bottom:9px}
.bar-name{font-size:12px; font-weight:700; text-align:right; color:var(--muted)}
.bar-track{position:relative; height:8px; background:#EDEDE8; border-radius:999px}
.bar-dot{position:absolute; top:50%; width:11px; height:11px; margin:-5.5px 0 0 -5.5px;
  border-radius:50%; background:var(--coral); box-shadow:0 0 0 3px rgba(192,73,43,.15)}
.bar-ends{display:flex; justify-content:space-between; font-size:10px; color:var(--faint);
  margin-top:3px; line-height:1.4}
.bar-ends .on{color:var(--ink); font-weight:700}
.q td:first-child{color:var(--faint); text-align:right; width:34px}
.q .lik b{display:inline-block; min-width:18px}
.login{max-width:380px; margin:9vh auto; padding:0 18px}
.login .panel{padding:24px}
.login .f{margin-bottom:12px}
.login input{width:100%}
.note{font-size:12px; color:var(--muted); margin-top:10px}
.right{text-align:right}
.nowrap{white-space:nowrap}
@media (max-width:640px){
  .wrap{padding:12px}
  /* 幅が足りないとタイトルとナビが同じ行で折り返して、見出しが列の途中に落ちる。
     タイトルだけ1行に落として、その下にナビを並べる。 */
  .ad-bar{padding:8px 12px; gap:8px}
  .ad-bar b{flex-basis:100%}
  .ad-nav{flex-basis:100%}
}
`;

export type Nav = 'responses' | 'sessions' | 'corp-leads' | 'referrers' | 'export' | 'none';

const NAV: [Nav, string, string][] = [
  ['responses', '/admin/responses', '回答'],
  ['sessions', '/admin/sessions', '体験セッション申込'],
  ['corp-leads', '/admin/corp-leads', '法人リード'],
  ['referrers', '/admin/referrers', '紹介者'],
  ['export', '/admin/export', 'CSV出力'],
];

export type ShellOptions = {
  title: string;
  nav?: Nav;
  /** ログイン中のアドレス。ログイン画面では省く。 */
  email?: string;
  csrf?: string;
  /** 画面上部に出す警告（ログイン通知が未設定など）。 */
  warnings?: string[];
  flash?: string;
};

/**
 * Admin の全ページ共通の器。
 * `<meta name="robots">` も入れるが、本命は index.ts が全 /admin/** に付ける
 * `X-Robots-Tag` のほう（F6-3。robots.txt には Admin のパスを書かない）。
 */
export function adminPage(opts: ShellOptions, body: string): string {
  const nav = opts.email
    ? '<nav class="ad-nav">' +
      NAV.map(([key, href, label]) =>
        `<a href="${href}"${opts.nav === key ? ' aria-current="page"' : ''}>${esc(label)}</a>`
      ).join('') +
      '</nav>' +
      '<div class="ad-me"><span>' + esc(opts.email) + '</span>' +
      `<form method="post" action="/admin/logout"><input type="hidden" name="csrf" value="${esc(opts.csrf ?? '')}">` +
      '<button type="submit">ログアウト</button></form></div>'
    : '<nav class="ad-nav"></nav>';

  return (
    '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<meta name="robots" content="noindex, nofollow">' +
    `<title>${esc(opts.title)} | ナチュール診断 Admin</title>` +
    `<style>${ADMIN_CSS}</style></head><body>` +
    `<header class="ad-bar"><b>ナチュール診断 Admin</b>${nav}</header>` +
    '<main class="wrap">' +
    (opts.flash ? `<p class="ok">${esc(opts.flash)}</p>` : '') +
    (opts.warnings ?? []).map((w) => `<p class="warn">${w}</p>`).join('') +
    body +
    '</main></body></html>'
  );
}
