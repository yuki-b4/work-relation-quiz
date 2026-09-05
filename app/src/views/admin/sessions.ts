/**
 * 体験セッション申込の一覧（F2-4）と、1件の詳細＋手動紐づけ。
 *
 * 申込は到達ID（`?v=`）で自動的に回答へ紐づく（F4-5）。紐づかないのは3つ。
 *   ・Googleフォームからの移行分（「診断ID」が空の行）
 *   ・直接 /apply/{typeCode} を開いた申込
 *   ・パラメータが落ちた申込（アプリ内ブラウザ経由など）
 * この画面はその3つを拾って手で繋ぐためにある。
 *
 * 一覧では氏名とメールをマスクする（6.2）。全部見るのは詳細だけで、
 * そのときに監査ログへ残す。
 */
import { esc } from '../result.ts';
import { adminPage, type ShellOptions } from './layout.ts';
import { jsonArray, jst, maskEmail, maskName } from '../../lib/admin-format.ts';
import { APPLICATION_STATUSES, PER_PAGE, type SessionListRow } from '../../lib/admin-queries.ts';

function option(value: string, label: string, current: string | undefined): string {
  return `<option value="${esc(value)}"${current === value ? ' selected' : ''}>${esc(label)}</option>`;
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || (k === 'page' && Number(v) === 1)) continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function sessionsListPage(
  shell: ShellOptions,
  data: { rows: SessionListRow[]; total: number; page: number; pages: number },
  f: { status?: string; linked?: string; q?: string; page?: number },
  csrf: string
): string {
  const rows = data.rows
    .map((a) => {
      const dup = (a.visit_application_count ?? 0) >= 2;
      const unlinked = !a.response_id;
      return (
        `<tr${dup || unlinked ? ' class="is-alert"' : ''}>` +
          `<td class="nowrap"><a href="/admin/sessions/${esc(a.id)}">${esc(jst(a.created_at))}</a></td>` +
          `<td>${esc(maskName(a.name))}</td>` +
          `<td class="mono">${esc(maskEmail(a.email))}</td>` +
          `<td>${a.response_id
            ? `<a href="/admin/responses/${esc(a.response_id)}">${esc(a.response_type_code ?? '')}／${esc(jst(a.response_created_at))}</a>`
            : '<span class="tag alert">未紐づけ</span>'}` +
            `${dup ? ' <span class="tag alert">到達ID重複</span>' : ''}</td>` +
          `<td>${esc(jsonArray(a.preferred_slots).join('／') || '—')}</td>` +
          '<td>' +
            `<form method="post" action="/admin/sessions/${esc(a.id)}" style="display:flex; gap:6px">` +
              `<input type="hidden" name="csrf" value="${esc(csrf)}">` +
              `<input type="hidden" name="back" value="/admin/sessions${esc(qs({ ...f }))}">` +
              `<select name="status">${APPLICATION_STATUSES.map((s) => option(s, s, a.status)).join('')}</select>` +
              '<button class="btn sm" type="submit">変更</button>' +
            '</form>' +
          '</td>' +
          `<td>${a.held_at ? esc(jst(a.held_at)) : '<span class="faint">—</span>'}</td>` +
        '</tr>'
      );
    })
    .join('');

  const body =
    '<h1>体験セッション申込</h1>' +
    `<p class="sub">${data.total.toLocaleString()} 件（${data.page} / ${data.pages} ページ・1ページ ${PER_PAGE} 件）</p>` +
    '<form class="panel" method="get" action="/admin/sessions"><div class="filters">' +
      '<div class="f"><label for="status">ステータス</label><select id="status" name="status">' +
        option('', 'すべて', f.status) + APPLICATION_STATUSES.map((s) => option(s, s, f.status)).join('') +
      '</select></div>' +
      '<div class="f"><label for="linked">回答との紐づけ</label><select id="linked" name="linked">' +
        option('', 'すべて', f.linked) + option('no', '未紐づけのみ', f.linked) + option('yes', '紐づけ済みのみ', f.linked) +
      '</select></div>' +
      `<div class="f"><label for="q">氏名・メール</label><input id="q" type="search" name="q" value="${esc(f.q ?? '')}"></div>` +
      '<div class="f"><button class="btn" type="submit">絞り込む</button></div>' +
      '<div class="f"><a class="btn ghost" href="/admin/sessions">解除</a></div>' +
    '</div></form>' +
    '<div class="panel">' +
      '<div class="scroll"><table><thead><tr>' +
        '<th>申込日時</th><th>氏名</th><th>メール</th><th>紐づく回答</th><th>希望の時間帯</th><th>ステータス</th><th>実施日</th>' +
      '</tr></thead><tbody>' +
      (rows || '<tr><td colspan="7" class="muted">該当する申込がありません。</td></tr>') +
      '</tbody></table></div>' +
      '<p class="note">氏名とメールは一覧では伏せています。全部を見るには申込日時のリンクから詳細を開いてください。</p>' +
      (data.pages > 1
        ? `<div class="pager">${data.page > 1 ? `<a class="btn ghost sm" href="/admin/sessions${qs({ ...f, page: data.page - 1 })}">← 前</a>` : ''}` +
          `<span class="muted">${data.page} / ${data.pages}</span>` +
          `${data.page < data.pages ? `<a class="btn ghost sm" href="/admin/sessions${qs({ ...f, page: data.page + 1 })}">次 →</a>` : ''}</div>`
        : '') +
      '<p class="note"><a class="btn ghost sm" href="/admin/export/applications.csv">申込のCSV出力</a></p>' +
    '</div>';

  return adminPage({ ...shell, nav: 'sessions' }, body);
}

export function sessionDetailPage(
  shell: ShellOptions,
  a: SessionListRow,
  candidates: { id: string; created_at: string; type_code: string; type_name: string; visited_at: string | null }[],
  csrf: string
): string {
  const slots = jsonArray(a.preferred_slots);
  const dup = (a.visit_application_count ?? 0) >= 2;

  const linkBlock = a.response_id
    ? '<div class="panel"><h2>紐づく回答</h2>' +
        `<p><a href="/admin/responses/${esc(a.response_id)}">${esc(a.response_type_code ?? '')}／${esc(a.response_type_name ?? '')}` +
        `（${esc(jst(a.response_created_at))}）を開く</a></p>` +
        `<form method="post" action="/admin/sessions/${esc(a.id)}/link" style="margin-top:10px">` +
          `<input type="hidden" name="csrf" value="${esc(csrf)}">` +
          '<input type="hidden" name="response_id" value="">' +
          '<button class="btn ghost sm" type="submit">紐づけを外す</button>' +
        '</form>' +
      '</div>'
    : '<div class="panel"><h2>回答との紐づけ</h2>' +
        '<p class="warn">この申込はどの回答にも紐づいていません。' +
        '到達ID（<code>?v=</code>）が付かずに申込フォームが開かれたか、移行データです。</p>' +
        (candidates.length
          ? `<form method="post" action="/admin/sessions/${esc(a.id)}/link">` +
            `<input type="hidden" name="csrf" value="${esc(csrf)}">` +
            '<div class="scroll"><table><thead><tr><th></th><th>回答日時</th><th>タイプ</th><th>申込フォーム到達</th></tr></thead><tbody>' +
            candidates.map((c) => (
              '<tr>' +
                `<td><input type="radio" name="response_id" value="${esc(c.id)}" required></td>` +
                `<td>${esc(jst(c.created_at))}</td>` +
                `<td>${esc(c.type_code)}／${esc(c.type_name)}</td>` +
                `<td>${c.visited_at ? esc(jst(c.visited_at)) : '<span class="faint">到達なし</span>'}</td>` +
              '</tr>'
            )).join('') +
            '</tbody></table></div>' +
            '<p style="margin-top:10px"><button class="btn" type="submit">選んだ回答に紐づける</button></p>' +
            '<p class="note">候補は「同じタイプで、この申込より前に受けた回答」を、申込フォームへの到達が新しい順に並べたものです。</p>' +
            '</form>'
          : '<p class="muted">候補が見つかりませんでした。</p>') +
      '</div>';

  const body =
    '<h1>申込の詳細</h1>' +
    '<p class="sub"><a href="/admin/sessions">← 申込一覧へ</a></p>' +
    (dup
      ? '<p class="warn">同じ到達IDに ' + esc(String(a.visit_application_count)) + ' 件の申込があります。' +
        '<code>?v=</code> 付きのURLが人づてに渡り、第三者の申込が元の回答に紐づいた可能性があります。' +
        '紐づけ先が正しいか確かめてください。</p>'
      : '') +
    '<div class="panel"><h2>申込内容</h2><dl class="kv">' +
      `<dt>申込日時</dt><dd>${esc(jst(a.created_at, true))}（JST）</dd>` +
      `<dt>氏名</dt><dd>${esc(a.name)}</dd>` +
      `<dt>メール</dt><dd><a href="mailto:${esc(a.email)}">${esc(a.email)}</a></dd>` +
      `<dt>タイプ</dt><dd>${esc(a.type_code ?? '—')}</dd>` +
      `<dt>希望の時間帯</dt><dd>${slots.length ? esc(slots.join('／')) : '<span class="faint">—</span>'}</dd>` +
      `<dt>気になっていること</dt><dd class="wrap-cell">${a.concern ? esc(a.concern) : '<span class="faint">—</span>'}</dd>` +
      `<dt>質問</dt><dd class="wrap-cell">${a.question ? esc(a.question) : '<span class="faint">—</span>'}</dd>` +
      `<dt>取り込み元</dt><dd>${esc(a.source)}</dd>` +
      `<dt>到達ID</dt><dd class="mono">${a.apply_visit_id ? esc(a.apply_visit_id) : '—'}</dd>` +
    '</dl></div>' +
    linkBlock +
    '<div class="panel"><h2>運用</h2>' +
      `<form method="post" action="/admin/sessions/${esc(a.id)}">` +
        `<input type="hidden" name="csrf" value="${esc(csrf)}">` +
        `<input type="hidden" name="back" value="/admin/sessions/${esc(a.id)}">` +
        '<div class="filters" style="margin-bottom:10px">' +
          '<div class="f"><label for="status">ステータス</label>' +
          `<select id="status" name="status">${APPLICATION_STATUSES.map((s) => option(s, s, a.status)).join('')}</select></div>` +
          `<div class="f"><label for="held_on">実施日</label><input id="held_on" type="date" name="held_on" value="${esc((a.held_at ?? '').slice(0, 10))}"></div>` +
        '</div>' +
        '<div class="f"><label for="admin_note">メモ</label>' +
        `<textarea id="admin_note" name="admin_note" maxlength="8000">${esc(a.admin_note ?? '')}</textarea></div>` +
        '<p style="margin-top:10px"><button class="btn" type="submit">保存する</button></p>' +
      '</form>' +
    '</div>';

  return adminPage({ ...shell, nav: 'sessions' }, body);
}
