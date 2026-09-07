/**
 * 法人リード（F2-5）・紹介者マスタ（F2-6）・CSV出力（F2-7）の画面。
 * どれも1画面で完結する小さな表なので、1ファイルにまとめる。
 */
import { esc } from '../result.ts';
import { adminPage, type ShellOptions } from './layout.ts';
import { jsonArray, jst, maskEmail } from '../../lib/admin-format.ts';
import { CORP_STATUSES, PER_PAGE, type CorpLeadRow, type ReferrerRow } from '../../lib/admin-queries.ts';

function option(value: string, label: string, current: string | undefined): string {
  return `<option value="${esc(value)}"${current === value ? ' selected' : ''}>${esc(label)}</option>`;
}

// ───────── 法人リード（F2-5） ─────────

/**
 * 法人リードは、メールアドレスがそのまま連絡先で、これを見ないと仕事にならない。
 * それでも既定は伏せておき（6.2）、「全部表示する」を押したときだけ出す。
 * 押した操作は監査ログに残す（routes/admin.ts 側）。
 */
export function corpLeadsPage(
  shell: ShellOptions,
  data: { rows: CorpLeadRow[]; total: number; page: number; pages: number },
  f: { status?: string; page?: number; reveal?: boolean },
  csrf: string
): string {
  const rows = data.rows
    .map((l) => (
      '<tr>' +
        `<td class="nowrap">${esc(jst(l.created_at))}</td>` +
        `<td class="mono">${f.reveal
          ? `<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>`
          : esc(maskEmail(l.email))}</td>` +
        `<td class="wrap-cell">${esc(jsonArray(l.issues).join('／') || '—')}</td>` +
        `<td class="wrap-cell">${l.detail ? esc(l.detail) : '<span class="faint">—</span>'}</td>` +
        `<td>${l.page ? esc(l.page) : '—'}</td>` +
        `<td class="mono">${l.ref_code ? esc(l.ref_code) : '—'}</td>` +
        '<td>' +
          `<form method="post" action="/admin/corp-leads/${esc(l.id)}">` +
            `<input type="hidden" name="csrf" value="${esc(csrf)}">` +
            `<select name="status">${CORP_STATUSES.map((s) => option(s, s, l.status)).join('')}</select>` +
            `<input name="admin_note" value="${esc(l.admin_note ?? '')}" placeholder="メモ" style="width:150px; margin:4px 0">` +
            '<button class="btn sm" type="submit">保存</button>' +
          '</form>' +
        '</td>' +
      '</tr>'
    ))
    .join('');

  const body =
    '<h1>法人リード</h1>' +
    `<p class="sub">${data.total.toLocaleString()} 件（${data.page} / ${data.pages} ページ）。法人LPの商談フォームから届いたリードです。</p>` +
    '<form class="panel" method="get" action="/admin/corp-leads"><div class="filters">' +
      '<div class="f"><label for="status">ステータス</label><select id="status" name="status">' +
        option('', 'すべて', f.status) + CORP_STATUSES.map((s) => option(s, s, f.status)).join('') +
      '</select></div>' +
      (f.reveal ? '<input type="hidden" name="reveal" value="1">' : '') +
      '<div class="f"><button class="btn" type="submit">絞り込む</button></div>' +
      '<div class="f"><a class="btn ghost" href="/admin/corp-leads">解除</a></div>' +
      `<div class="f"><a class="btn ghost" href="/admin/corp-leads?${f.status ? `status=${encodeURIComponent(f.status)}&` : ''}${f.reveal ? '' : 'reveal=1'}">` +
        `${f.reveal ? 'メールを伏せる' : 'メールを全部表示する'}</a></div>` +
    '</div></form>' +
    '<div class="panel">' +
      '<div class="scroll"><table><thead><tr>' +
        '<th>日時</th><th>メール</th><th>課題</th><th>自由記述</th><th>流入ページ</th><th>紹介元</th><th>ステータス・メモ</th>' +
      '</tr></thead><tbody>' +
      (rows || '<tr><td colspan="7" class="muted">まだ法人リードはありません。' +
        '法人LPはPhase 4でアプリへ移す予定なので、当面はスプレッドシートからの移行分だけが入ります。</td></tr>') +
      '</tbody></table></div>' +
      (data.pages > 1
        ? `<div class="pager">${data.page > 1 ? `<a class="btn ghost sm" href="/admin/corp-leads?page=${data.page - 1}">← 前</a>` : ''}` +
          `<span class="muted">${data.page} / ${data.pages}</span>` +
          `${data.page < data.pages ? `<a class="btn ghost sm" href="/admin/corp-leads?page=${data.page + 1}">次 →</a>` : ''}</div>`
        : '') +
      (f.reveal ? '' : '<p class="note">メールアドレスは伏せています。連絡するときは「メールを全部表示する」を押してください。</p>') +
      '<p class="note"><a class="btn ghost sm" href="/admin/export/corp-leads.csv">法人リードのCSV出力</a></p>' +
    '</div>';

  return adminPage({ ...shell, nav: 'corp-leads' }, body);
}

// ───────── 紹介者マスタ（F2-6） ─────────

/**
 * 紹介リンクをコピーするだけの小さなスクリプト。
 * ここだけは JS を使う。コードを目で読んで手で打つと、大小の取り違えが起きるため。
 */
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

export function referrersPage(
  shell: ShellOptions,
  rows: ReferrerRow[],
  origin: string,
  csrf: string
): string {
  const list = rows
    .map((r) => {
      const link = `${origin}/?ref=${r.code}`;
      return (
        `<tr${r.active ? '' : ' class="muted"'}>` +
          `<td class="mono">${esc(r.code)}${r.active ? '' : ' <span class="tag off">無効</span>'}</td>` +
          `<td>${esc(r.name)}</td>` +
          `<td class="wrap-cell">${r.note ? esc(r.note) : '<span class="faint">—</span>'}</td>` +
          `<td class="right">${r.response_count}</td>` +
          `<td class="right">${r.guide_count}</td>` +
          `<td class="right">${r.application_count}</td>` +
          `<td><span class="mono faint" style="font-size:11px">${esc(link)}</span><br>` +
            `<button class="btn ghost sm" type="button" data-copy="${esc(link)}">紹介リンクをコピー</button></td>` +
          '<td>' +
            `<form method="post" action="/admin/referrers/${esc(r.code)}" style="display:flex; gap:5px; flex-wrap:wrap">` +
              `<input type="hidden" name="csrf" value="${esc(csrf)}">` +
              `<input name="name" value="${esc(r.name)}" style="width:110px">` +
              `<input name="note" value="${esc(r.note ?? '')}" placeholder="メモ" style="width:130px">` +
              `<input type="hidden" name="active" value="${r.active ? '1' : '0'}">` +
              '<button class="btn sm" type="submit">保存</button>' +
            '</form>' +
            `<form method="post" action="/admin/referrers/${esc(r.code)}" style="margin-top:4px">` +
              `<input type="hidden" name="csrf" value="${esc(csrf)}">` +
              `<input type="hidden" name="name" value="${esc(r.name)}">` +
              `<input type="hidden" name="note" value="${esc(r.note ?? '')}">` +
              `<input type="hidden" name="active" value="${r.active ? '0' : '1'}">` +
              `<button class="btn ghost sm" type="submit">${r.active ? '無効にする' : '有効に戻す'}</button>` +
            '</form>' +
          '</td>' +
        '</tr>'
      );
    })
    .join('');

  const body =
    '<h1>紹介者</h1>' +
    '<p class="sub">紹介リンクの発行と、紹介者ごとの実績。コードは「イニシャル（英大文字）＋ランダム英数字5文字」で自動発行します。</p>' +
    '<div class="panel"><h2>紹介者を追加する</h2>' +
      '<form method="post" action="/admin/referrers"><div class="filters">' +
        `<input type="hidden" name="csrf" value="${esc(csrf)}">` +
        '<div class="f"><label for="name">紹介者名</label><input id="name" name="name" required maxlength="60" placeholder="田中"></div>' +
        '<div class="f"><label for="initials">イニシャル（英字2文字）</label>' +
        '<input id="initials" name="initials" maxlength="2" placeholder="TK" style="width:90px"></div>' +
        '<div class="f"><label for="note">メモ</label><input id="note" name="note" maxlength="200" placeholder="◯◯の紹介・2026-09"></div>' +
        '<div class="f"><button class="btn" type="submit">コードを発行する</button></div>' +
      '</div>' +
      '<p class="note">イニシャルを空にすると <span class="mono">XX</span> で発行します。' +
      '大小だけが違うコードは作りません（取り違えを防ぐため、既存コードと大小を無視して重複を避けます）。</p>' +
      '</form>' +
    '</div>' +
    '<div class="panel">' +
      '<div class="scroll"><table><thead><tr>' +
        '<th>コード</th><th>紹介者名</th><th>メモ</th><th class="right">回答</th><th class="right">ガイド到達</th>' +
        '<th class="right">申込</th><th>紹介リンク</th><th>編集</th>' +
      '</tr></thead><tbody>' +
      (list || '<tr><td colspan="8" class="muted">まだ紹介者が登録されていません。</td></tr>') +
      '</tbody></table></div>' +
    '</div>' +
    `<script>${COPY_SCRIPT}</script>`;

  return adminPage({ ...shell, nav: 'referrers' }, body);
}

// ───────── CSV出力（F2-7） ─────────

export function exportPage(shell: ShellOptions, counts: Record<string, number>): string {
  const card = (href: string, title: string, desc: string, n: number) =>
    '<div class="panel">' +
      `<h2>${esc(title)}</h2>` +
      `<p class="muted" style="font-size:12px; margin-bottom:10px">${esc(desc)}</p>` +
      `<p class="sub">${n.toLocaleString()} 件</p>` +
      '<form method="get" action="' + href + '"><div class="filters">' +
        '<div class="f"><label>期間（開始）</label><input type="date" name="from"></div>' +
        '<div class="f"><label>期間（終了）</label><input type="date" name="to"></div>' +
        '<div class="f"><button class="btn" type="submit">CSVを出す</button></div>' +
      '</div></form>' +
    '</div>';

  const body =
    '<h1>CSV出力</h1>' +
    '<p class="sub">UTF-8 の BOM 付きなので、Excel でそのまま開けます。期間を空にすると全件出ます。' +
    '出力した操作は監査ログに残ります。</p>' +
    '<div class="grid2">' +
      card('/admin/export/responses.csv', '回答', '1行1回答。タイプ・5軸・流入・ガイド到達・申込の有無まで。', counts.responses ?? 0) +
      card('/admin/export/answers.csv', '設問別回答', '1行1設問。24問の生の回答。移行データは9問だけ入っています。', counts.answers ?? 0) +
      card('/admin/export/applications.csv', '体験セッション申込', '1行1申込。氏名とメールを含みます。扱いに注意。', counts.applications ?? 0) +
      card('/admin/export/corp-leads.csv', '法人リード', '1行1リード。メールアドレスを含みます。', counts.corpLeads ?? 0) +
    '</div>';

  return adminPage({ ...shell, nav: 'export' }, body);
}
