/**
 * 申込の入口（F4-5）の一覧と詳細。
 *
 * 入口は「どこから申し込みが来たか」で、申込1件につき必ず1つ紐づく。
 * この画面で作るのはセミナーだけ。`guide`（診断 → 読み解きガイド終章）と
 * `direct`（直接アクセス・入口不明）は migrations/0007 が入れる system 行で、
 * **編集も無効化もさせない**。消えると既存の申込が参照先を失うため。
 *
 * 一覧では読み取りと有効・無効の切り替えだけを出し、文面の編集は詳細で行う。
 * 見出しと冒頭の説明は長くなるので、行内のテキスト欄に押し込めない。
 */
import { esc } from '../result.ts';
import { adminPage, type ShellOptions } from './layout.ts';
import { jst } from '../../lib/admin-format.ts';
import type { EntryRow } from '../../lib/admin-queries.ts';

const COPY_SCRIPT = `
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-copy]');
  if (!b) return;
  navigator.clipboard.writeText(b.getAttribute('data-copy')).then(function () {
    var old = b.textContent;
    b.textContent = 'コピーしました';
    setTimeout(function () { b.textContent = old; }, 1400);
  });
});
`;

const KIND_LABEL: Record<string, string> = {
  guide: 'ガイド終章',
  direct: '直接・不明',
  seminar: 'セミナー',
};

/** 申込率。参加者数が入っていないと出せないので、そのときは「—」。 */
function rate(applications: number, audience: number | null): string {
  if (!audience || audience <= 0) return '<span class="faint">—</span>';
  return `${Math.round((applications / audience) * 1000) / 10}%`;
}

export function entriesListPage(
  shell: ShellOptions,
  rows: EntryRow[],
  origin: string,
  csrf: string
): string {
  const list = rows
    .map((e) => {
      const url = `${origin}/apply/s/${e.slug}`;
      const sys = e.system === 1;
      return (
        `<tr${e.active ? '' : ' class="muted"'}>` +
          `<td class="mono">${esc(e.slug)}` +
            `${e.active ? '' : ' <span class="tag off">無効</span>'}` +
            `${sys ? ' <span class="tag">既定</span>' : ''}</td>` +
          `<td>${sys ? esc(e.name) : `<a href="/admin/entries/${esc(e.id)}">${esc(e.name)}</a>`}</td>` +
          `<td>${esc(KIND_LABEL[e.kind] ?? e.kind)}</td>` +
          `<td class="nowrap">${e.held_on ? esc(e.held_on) : '<span class="faint">—</span>'}</td>` +
          `<td class="right">${e.audience_count ?? '<span class="faint">—</span>'}</td>` +
          `<td class="right">${e.application_count}</td>` +
          `<td class="right">${rate(e.application_count, e.audience_count)}</td>` +
          `<td class="right">${e.closed_count}</td>` +
          '<td>' +
            (sys
              ? '<span class="faint">既定の入口のため固定</span>'
              : `<span class="mono faint" style="font-size:11px">${esc(url)}</span><br>` +
                `<button class="btn ghost sm" type="button" data-copy="${esc(url)}">申込URLをコピー</button>`) +
          '</td>' +
          '<td>' +
            (sys
              ? '<span class="faint">—</span>'
              : `<form method="post" action="/admin/entries/${esc(e.id)}/active">` +
                  `<input type="hidden" name="csrf" value="${esc(csrf)}">` +
                  `<input type="hidden" name="active" value="${e.active ? '0' : '1'}">` +
                  `<button class="btn ghost sm" type="submit">${e.active ? '受付を締める' : '受付を再開'}</button>` +
                '</form>') +
          '</td>' +
        '</tr>'
      );
    })
    .join('');

  const body =
    '<h1>申込の入口</h1>' +
    '<p class="sub">体験セッションの申込が「どこから来たか」。申込1件につき必ず1つ紐づきます。' +
    '<span class="tag">既定</span> の2つ（ガイド終章・直接アクセス）は固定で、編集も無効化もできません。</p>' +

    '<div class="panel"><h2>セミナーを追加する</h2>' +
      '<form method="post" action="/admin/entries">' +
        `<input type="hidden" name="csrf" value="${esc(csrf)}">` +
        '<div class="filters">' +
          '<div class="f"><label for="name">表示名</label>' +
          '<input id="name" name="name" required maxlength="80" placeholder="9/28 関係性セミナー"></div>' +
          '<div class="f"><label for="slug">URL用の文字列</label>' +
          '<input id="slug" name="slug" required maxlength="40" placeholder="sem-0928" style="width:150px"></div>' +
          '<div class="f"><label for="held_on">開催日</label>' +
          '<input id="held_on" name="held_on" type="date" required></div>' +
          '<div class="f"><label for="venue">会場</label>' +
          '<input id="venue" name="venue" maxlength="120" placeholder="渋谷 会議室A"></div>' +
          '<div class="f"><label for="audience_count">参加者数</label>' +
          '<input id="audience_count" name="audience_count" type="number" min="0" max="100000" style="width:90px"></div>' +
          '<div class="f"><button class="btn" type="submit">追加する</button></div>' +
        '</div>' +
        '<p class="note">URL用の文字列はそのまま申込ページのURLになります（英小文字・数字・ハイフン）。' +
        '参加者数は当日でよいので、空のままでも追加できます。申込ページの文面は、追加したあと表示名から開いて設定します。</p>' +
      '</form>' +
    '</div>' +

    '<div class="panel">' +
      '<div class="scroll"><table><thead><tr>' +
        '<th>URL用の文字列</th><th>表示名</th><th>種類</th><th>開催日</th>' +
        '<th class="right">参加者</th><th class="right">申込</th><th class="right">申込率</th><th class="right">成約</th>' +
        '<th>申込URL</th><th>受付</th>' +
      '</tr></thead><tbody>' +
      (list || '<tr><td colspan="10" class="muted">入口がありません。</td></tr>') +
      '</tbody></table></div>' +
      '<p class="note">申込率は「申込数 ÷ 参加者数」です。参加者数を入れていないと出ません。</p>' +
    '</div>' +
    `<script>${COPY_SCRIPT}</script>`;

  return adminPage({ ...shell, nav: 'entries' }, body);
}

export function entryDetailPage(shell: ShellOptions, e: EntryRow, origin: string, csrf: string): string {
  const url = `${origin}/apply/s/${e.slug}`;
  const field = (id: string, label: string, hint: string, input: string) =>
    `<div class="f" style="flex-basis:100%"><label for="${id}">${esc(label)}</label>${input}` +
    (hint ? `<p class="note" style="margin-top:4px">${hint}</p>` : '') +
    '</div>';

  const body =
    `<h1>${esc(e.name)}</h1>` +
    '<p class="sub"><a href="/admin/entries">← 入口の一覧へ</a></p>' +

    '<div class="panel"><h2>実績</h2><dl class="kv">' +
      `<dt>申込URL</dt><dd><span class="mono">${esc(url)}</span> ` +
        `<button class="btn ghost sm" type="button" data-copy="${esc(url)}">コピー</button></dd>` +
      `<dt>参加者数</dt><dd>${e.audience_count ?? '<span class="faint">未入力</span>'}</dd>` +
      `<dt>申込</dt><dd>${e.application_count} 件（${rate(e.application_count, e.audience_count)}）</dd>` +
      `<dt>成約</dt><dd>${e.closed_count} 件</dd>` +
      `<dt>作成</dt><dd>${esc(jst(e.created_at, true))}（JST）</dd>` +
    '</dl></div>' +

    '<div class="panel"><h2>セミナーの情報</h2>' +
      `<form method="post" action="/admin/entries/${esc(e.id)}">` +
        `<input type="hidden" name="csrf" value="${esc(csrf)}">` +
        '<div class="filters">' +
          '<div class="f"><label for="name">表示名</label>' +
          `<input id="name" name="name" required maxlength="80" value="${esc(e.name)}"></div>` +
          '<div class="f"><label for="held_on">開催日</label>' +
          `<input id="held_on" name="held_on" type="date" required value="${esc(e.held_on ?? '')}"></div>` +
          '<div class="f"><label for="venue">会場</label>' +
          `<input id="venue" name="venue" maxlength="120" value="${esc(e.venue ?? '')}"></div>` +
          '<div class="f"><label for="audience_count">参加者数</label>' +
          `<input id="audience_count" name="audience_count" type="number" min="0" max="100000" style="width:90px" value="${esc(String(e.audience_count ?? ''))}"></div>` +
        '</div>' +

        '<h2 style="margin-top:18px">申込ページの文面</h2>' +
        '<p class="note">すべて任意です。<b>空のままにすると、ガイド経由と同じ既定の文面が出ます。</b>' +
        'セミナーで話した内容に合わせて変えたいところだけ書いてください。</p>' +
        '<div class="filters">' +
          field('headline', '見出し', '空なら「お申し込み」。',
            `<input id="headline" name="headline" maxlength="120" value="${esc(e.headline ?? '')}" placeholder="体験セッション（60分・無料）">`) +
          field('session_label', 'セッションの長さの表記', '空なら「30〜45分」。本文中の表記に使います。',
            `<input id="session_label" name="session_label" maxlength="40" value="${esc(e.session_label ?? '')}" placeholder="60分">`) +
          field('intro', '冒頭の説明', '空にすると、ガイドへのお礼を除いた既定の文面が出ます。改行はそのまま反映されます。',
            `<textarea id="intro" name="intro" maxlength="4000" rows="6">${esc(e.intro ?? '')}</textarea>`) +
          field('fields_json', '事前入力の追加項目',
            'JSON の配列で書きます。例：<span class="mono">["役職","店舗の人数"]</span>。空なら既定の設問だけになります。',
            `<textarea id="fields_json" name="fields_json" maxlength="2000" rows="3">${esc(e.fields_json ?? '')}</textarea>`) +
        '</div>' +
        '<p style="margin-top:12px"><button class="btn" type="submit">保存する</button></p>' +
      '</form>' +
    '</div>' +

    '<div class="panel"><h2>受付</h2>' +
      `<p>いまは <b>${e.active ? '受付中' : '締め切り済み'}</b> です。` +
      '締めると申込URLは「受付を終了しました」の表示になります。<b>入口そのものは残る</b>ので、' +
      '既に入っている申込と実績はそのまま見られます。</p>' +
      `<form method="post" action="/admin/entries/${esc(e.id)}/active" style="margin-top:10px">` +
        `<input type="hidden" name="csrf" value="${esc(csrf)}">` +
        `<input type="hidden" name="active" value="${e.active ? '0' : '1'}">` +
        `<button class="btn ghost" type="submit">${e.active ? '受付を締める' : '受付を再開する'}</button>` +
      '</form>' +
    '</div>' +
    `<script>${COPY_SCRIPT}</script>`;

  return adminPage({ ...shell, nav: 'entries' }, body);
}
