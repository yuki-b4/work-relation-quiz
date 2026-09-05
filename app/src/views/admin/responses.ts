/**
 * 回答一覧（F2-2）と回答詳細（F2-3）。
 *
 * 詳細は「一画面で、その人のすべてが見えること」が要件なので、タブや折りたたみに逃がさず
 * 8ブロックを縦に並べる。回答者本人は結果を1度しか見られない（F4）が、Adminは何度でも見る。
 */
import { esc } from '../result.ts';
import { adminPage, type ShellOptions } from './layout.ts';
import {
  duration, guideReach, jsonArray, jst, maskEmail, maskName, pct,
} from '../../lib/admin-format.ts';
import {
  APPLICATION_STATUSES, PER_PAGE, RESPONSE_STATUSES,
  type ApplicationRow, type ResponseDetail, type ResponseFilters, type ResponseListRow,
} from '../../lib/admin-queries.ts';
import { AX, RADAR_AXES, RADAR_META } from '../../content/quiz.ts';
import { TYPES, TYPE_CODES } from '../../content/types.ts';
import type { QuestionView } from '../../lib/question-archive.ts';

/** 絞り込みの値を、そのままリンクに引き継ぐためのクエリ文字列を作る。 */
export function queryString(f: ResponseFilters, override: Record<string, string | number | undefined> = {}): string {
  const p = new URLSearchParams();
  const src: Record<string, unknown> = { ...f, ...override };
  for (const [k, v] of Object.entries(src)) {
    if (v === undefined || v === null || v === '') continue;
    if (k === 'page' && Number(v) === 1) continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

function option(value: string, label: string, current: string | undefined): string {
  return `<option value="${esc(value)}"${current === value ? ' selected' : ''}>${esc(label)}</option>`;
}

function filterForm(f: ResponseFilters, opts: { refs: string[]; srcs: string[] }): string {
  return (
    '<form class="panel" method="get" action="/admin/responses">' +
      '<div class="filters">' +
        `<div class="f"><label for="from">期間（開始）</label><input id="from" type="date" name="from" value="${esc(f.from ?? '')}"></div>` +
        `<div class="f"><label for="to">期間（終了）</label><input id="to" type="date" name="to" value="${esc(f.to ?? '')}"></div>` +
        '<div class="f"><label for="type">タイプ</label><select id="type" name="type">' +
          option('', 'すべて', f.type) +
          TYPE_CODES.map((c) => option(c, `${c}／${TYPES[c].name}`, f.type)).join('') +
        '</select></div>' +
        '<div class="f"><label for="ref">紹介元</label><select id="ref" name="ref">' +
          option('', 'すべて', f.ref) + opts.refs.map((r) => option(r, r, f.ref)).join('') +
        '</select></div>' +
        '<div class="f"><label for="src">流入元</label><select id="src" name="src">' +
          option('', 'すべて', f.src) + opts.srcs.map((r) => option(r, r, f.src)).join('') +
        '</select></div>' +
        '<div class="f"><label for="visit">申込フォーム到達</label><select id="visit" name="visit">' +
          option('', 'すべて', f.visit) + option('yes', '到達あり', f.visit) + option('no', '到達なし', f.visit) +
        '</select></div>' +
        '<div class="f"><label for="status">対応状況</label><select id="status" name="status">' +
          option('', 'すべて', f.status) + RESPONSE_STATUSES.map((s) => option(s, s, f.status)).join('') +
        '</select></div>' +
        `<div class="f"><label for="q">フリーワード（ヒアリング・メモ）</label><input id="q" type="search" name="q" value="${esc(f.q ?? '')}" placeholder="例：任せられない"></div>` +
        `<input type="hidden" name="sort" value="${esc(f.sort ?? 'created_at')}">` +
        `<input type="hidden" name="dir" value="${esc(f.dir ?? 'desc')}">` +
        '<div class="f"><button class="btn" type="submit">絞り込む</button></div>' +
        '<div class="f"><a class="btn ghost" href="/admin/responses">解除</a></div>' +
      '</div>' +
    '</form>'
  );
}

/** 並べ替えのリンク。押すたびに昇順・降順が入れ替わる。 */
function sortLink(f: ResponseFilters, key: string, label: string): string {
  const active = (f.sort ?? 'created_at') === key;
  const dir = active && f.dir === 'desc' ? 'asc' : 'desc';
  const mark = active ? (f.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return `<a href="/admin/responses${queryString(f, { sort: key, dir, page: undefined })}">${esc(label)}${mark}</a>`;
}

export function responsesListPage(
  shell: ShellOptions,
  data: { rows: ResponseListRow[]; total: number; page: number; pages: number },
  f: ResponseFilters,
  opts: { refs: string[]; srcs: string[] }
): string {
  const rows = data.rows
    .map((r) => {
      const visited = r.visit_count > 0;
      const applied = r.application_count > 0;
      return (
        '<tr>' +
          `<td class="nowrap"><a href="/admin/responses/${esc(r.id)}">${esc(jst(r.created_at))}</a></td>` +
          `<td class="nowrap">${esc(r.type_code)}<span class="muted">／${esc(r.type_name)}</span></td>` +
          `<td>${r.ref_code ? `<span class="mono">${esc(r.ref_code)}</span>` : '<span class="faint">—</span>'}</td>` +
          `<td>${r.referrer_name ? esc(r.referrer_name) : (r.ref_code ? '<span class="tag alert">未登録</span>' : '<span class="faint">—</span>')}</td>` +
          `<td>${r.src ? esc(r.src) : '<span class="faint">—</span>'}</td>` +
          `<td>${esc(guideReach(r.guide_opened_at, r.guide_max_chapter, r.guide_completed_at))}</td>` +
          `<td>${visited ? `<span class="tag on">到達 ${r.visit_count}</span>` : '<span class="tag off">なし</span>'}` +
            `${applied ? ` <span class="tag on">申込</span>` : ''}</td>` +
          `<td>${esc(r.admin_status || '未対応')}</td>` +
        '</tr>'
      );
    })
    .join('');

  const body =
    '<h1>回答</h1>' +
    `<p class="sub">${data.total.toLocaleString()} 件（${data.page} / ${data.pages} ページ・1ページ ${PER_PAGE} 件）</p>` +
    filterForm(f, opts) +
    '<div class="panel">' +
      '<div class="scroll"><table><thead><tr>' +
        `<th>${sortLink(f, 'created_at', '日時')}</th>` +
        `<th>${sortLink(f, 'type_code', 'タイプ')}</th>` +
        '<th>紹介元コード</th><th>紹介者名</th><th>流入元</th><th>ガイド到達</th>' +
        `<th>申込フォーム到達${(f.sort === 'applied_at') ? '' : ''}／${sortLink(f, 'applied_at', '申込日時')}</th>` +
        '<th>対応状況</th>' +
      '</tr></thead><tbody>' +
      (rows || '<tr><td colspan="8" class="muted">該当する回答がありません。</td></tr>') +
      '</tbody></table></div>' +
      pager('/admin/responses', f, data) +
      `<p class="note"><a class="btn ghost sm" href="/admin/export/responses.csv${queryString(f, { page: undefined })}">この条件でCSV出力</a>` +
      ` <a class="btn ghost sm" href="/admin/export/answers.csv${queryString(f, { page: undefined })}">設問別回答のCSV</a></p>` +
    '</div>';

  return adminPage({ ...shell, nav: 'responses' }, body);
}

function pager(base: string, f: ResponseFilters, data: { page: number; pages: number; total: number }): string {
  if (data.pages <= 1) return '';
  const prev = data.page > 1 ? `<a class="btn ghost sm" href="${base}${queryString(f, { page: data.page - 1 })}">← 前</a>` : '';
  const next = data.page < data.pages ? `<a class="btn ghost sm" href="${base}${queryString(f, { page: data.page + 1 })}">次 →</a>` : '';
  return `<div class="pager">${prev}<span class="muted">${data.page} / ${data.pages}</span>${next}</div>`;
}

// ───────── 詳細（F2-3） ─────────

/** 5軸の帯。結果画面と同じ「左右の極のあいだのどこにいるか」を、Adminの幅で出す。 */
function radarBlock(r: ResponseDetail): string {
  return RADAR_AXES.map((a) => {
    const v = Number(r[`radar_${a}`] ?? 0);
    const m = RADAR_META[a];
    const pos = 8 + Math.max(0, Math.min(1, v)) * 84;
    return (
      '<div class="bar">' +
        `<div class="bar-name">${esc(m.name)}</div>` +
        '<div>' +
          `<div class="bar-track"><span class="bar-dot" style="left:${pos.toFixed(2)}%"></span></div>` +
          `<div class="bar-ends"><span class="${v < 0.5 ? 'on' : ''}">${esc(m.left)}</span>` +
          `<span class="muted">${esc(pct(v))}</span>` +
          `<span class="${v > 0.5 ? 'on' : ''}">${esc(m.right)}</span></div>` +
        '</div>' +
      '</div>'
    );
  }).join('');
}

/** 3軸の判定と内訳カウント。境界事例（4対5）が一目で分かるようにする。 */
function axisBlock(r: ResponseDetail): string {
  let counts: Record<string, { L: number; R: number; total: number }> = {};
  try { counts = JSON.parse(String(r.axis_counts ?? '{}')); } catch { counts = {}; }
  const names: Record<string, string> = { h: '本音', c: '衝突', w: '重心' };
  return (
    '<table><thead><tr><th>軸</th><th>判定</th><th>内訳</th></tr></thead><tbody>' +
    (['h', 'c', 'w'] as const).map((axis) => {
      const meta = AX[axis];
      const picked = String(r[`axis_${axis}`] ?? '');
      const label = picked === meta.poles[0] ? meta.left : meta.right;
      const ct = counts[axis];
      const close = ct && Math.abs(ct.L - ct.R) <= 1;
      return (
        `<tr><td>${esc(names[axis])}</td>` +
        `<td><b>${esc(picked)}</b>／${esc(label)}</td>` +
        `<td>${ct ? `${esc(meta.left)} ${ct.L} 対 ${ct.R} ${esc(meta.right)}` : '<span class="faint">—</span>'}` +
        `${close ? ' <span class="tag alert">きわどい</span>' : ''}</td></tr>`
      );
    }).join('') +
    '</tbody></table>'
  );
}

/** 設問別回答24問（F2-3 ブロック3）。設問文は回答時のバージョンのものを出す。 */
function answersBlock(questions: QuestionView[], versionKnown: boolean, version: string): string {
  const note = versionKnown
    ? ''
    : `<p class="warn">この回答の設問セット（<span class="mono">${esc(version)}</span>）の設問文は保存されていません。` +
      '設問の識別子と軸だけを出します。</p>';
  return (
    note +
    '<div class="scroll"><table class="q"><thead><tr><th>#</th><th>設問</th><th>回答</th><th>軸</th></tr></thead><tbody>' +
    questions.map((q) => (
      '<tr>' +
        `<td>${q.orderNo}</td>` +
        `<td class="wrap-cell">${q.text ? esc(q.text) : `<span class="mono faint">${esc(q.key)}</span>`}</td>` +
        `<td class="wrap-cell">${q.answerText ? esc(q.answerText) : `<span class="mono">${esc(q.value)}</span>`}</td>` +
        `<td class="faint">${esc(q.axisLabel)}</td>` +
      '</tr>'
    )).join('') +
    '</tbody></table></div>'
  );
}

const SURVEY_LABELS: [string, string][] = [
  ['me', 'これは私だ'], ['others', '他者当てはめ'], ['others_who', '他者当てはめ_誰'],
  ['share', '見せたい・話したい'], ['share_who', '見せたい_誰'],
  ['dig', '深掘りしたい'], ['miss', '滑った部分'],
];

function applicationBlock(a: ApplicationRow, csrf: string): string {
  const slots = jsonArray(a.preferred_slots);
  return (
    '<div class="panel" style="background:#FAFAF8">' +
      '<dl class="kv">' +
        `<dt>申込日時</dt><dd>${esc(jst(a.created_at))}</dd>` +
        `<dt>氏名</dt><dd>${esc(a.name)}</dd>` +
        `<dt>メール</dt><dd><a href="mailto:${esc(a.email)}">${esc(a.email)}</a></dd>` +
        `<dt>希望の時間帯</dt><dd>${slots.length ? esc(slots.join('／')) : '<span class="faint">—</span>'}</dd>` +
        `<dt>気になっていること</dt><dd>${a.concern ? esc(a.concern) : '<span class="faint">—</span>'}</dd>` +
        `<dt>質問</dt><dd>${a.question ? esc(a.question) : '<span class="faint">—</span>'}</dd>` +
        `<dt>取り込み元</dt><dd>${esc(a.source)}</dd>` +
      '</dl>' +
      `<form method="post" action="/admin/sessions/${esc(a.id)}" style="margin-top:10px; display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap">` +
        `<input type="hidden" name="csrf" value="${esc(csrf)}">` +
        `<input type="hidden" name="back" value="/admin/responses/${esc(a.response_id ?? '')}">` +
        '<div class="f"><label>ステータス</label><select name="status">' +
          APPLICATION_STATUSES.map((s) => option(s, s, a.status)).join('') +
        '</select></div>' +
        `<div class="f"><label>実施日</label><input type="date" name="held_on" value="${esc((a.held_at ?? '').slice(0, 10))}"></div>` +
        '<button class="btn sm" type="submit">保存</button>' +
      '</form>' +
    '</div>'
  );
}

export function responseDetailPage(
  shell: ShellOptions,
  r: ResponseDetail,
  extra: {
    questions: QuestionView[];
    versionKnown: boolean;
    survey: Record<string, string | null> | null;
    hearing: Record<string, string | null> | null;
    visits: { id: string; visited_at: string; cta: string; application_count: number }[];
    applications: ApplicationRow[];
  },
  csrf: string
): string {
  const code = String(r.type_code ?? '');
  const t = TYPES[code as keyof typeof TYPES];
  const version = String(r.question_set_version ?? '');

  const basic =
    '<div class="panel"><h2>1. 基本情報</h2>' +
      '<div class="grid2">' +
        '<dl class="kv">' +
          `<dt>回答ID</dt><dd class="mono">${esc(r.id)}</dd>` +
          `<dt>回答日時</dt><dd>${esc(jst(String(r.created_at), true))}（JST）</dd>` +
          `<dt>所要時間</dt><dd>${esc(duration(String(r.created_at), r.completed_at ? String(r.completed_at) : null))}</dd>` +
          `<dt>設問セット</dt><dd class="mono">${esc(version)}${version === 'legacy' ? ' <span class="tag alert">移行データ</span>' : ''}</dd>` +
          `<dt>回答アンカー</dt><dd>${r.frame ? esc(String(r.frame)) : '<span class="faint">—</span>'}</dd>` +
          `<dt>モード／セグメント</dt><dd>${esc(String(r.mode ?? ''))}／${esc(String(r.segment ?? ''))}</dd>` +
        '</dl>' +
        '<dl class="kv">' +
          `<dt>紹介元コード</dt><dd class="mono">${r.ref_code ? esc(String(r.ref_code)) : '—'}</dd>` +
          `<dt>紹介者名</dt><dd>${r.referrer_name ? esc(String(r.referrer_name)) : (r.ref_code ? '<span class="tag alert">未登録</span>' : '—')}</dd>` +
          `<dt>流入元（src）</dt><dd>${r.src ? esc(String(r.src)) : '—'}</dd>` +
          `<dt>UTM</dt><dd>${[r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).map((x) => esc(String(x))).join(' / ') || '—'}</dd>` +
          `<dt>流入URL</dt><dd class="mono">${r.entry_url ? esc(String(r.entry_url)) : '—'}</dd>` +
          `<dt>リファラ</dt><dd class="mono">${r.referrer_url ? esc(String(r.referrer_url)) : '—'}</dd>` +
          `<dt>端末</dt><dd>${[r.device_type, r.os, r.browser].filter(Boolean).map((x) => esc(String(x))).join(' / ') || '—'}</dd>` +
          `<dt>X共有</dt><dd>${r.shared_at ? `${esc(jst(String(r.shared_at)))}（${esc(String(r.share_count ?? 0))}回）` : '—'}</dd>` +
        '</dl>' +
      '</div>' +
    '</div>';

  const result =
    '<div class="panel"><h2>2. 診断結果</h2>' +
      `<p style="margin-bottom:12px"><b style="font-size:17px">${esc(String(r.type_name ?? ''))}</b> ` +
      `<span class="mono muted">${esc(code)}</span>` +
      (t ? `<br><span class="muted">${esc(t.catch)}</span>` : '') + '</p>' +
      '<div class="grid2"><div>' + axisBlock(r) + '</div>' +
      `<div><p class="sub">5軸スコア</p>${radarBlock(r)}</div></div>` +
    '</div>';

  const answers =
    '<div class="panel"><h2>3. 設問別回答（24問）</h2>' +
      answersBlock(extra.questions, extra.versionKnown, version) +
    '</div>';

  const survey =
    '<div class="panel"><h2>4. 検証アンケート</h2>' +
      (extra.survey
        ? '<dl class="kv">' + SURVEY_LABELS.map(([k, label]) =>
            `<dt>${esc(label)}</dt><dd>${extra.survey![k] ? esc(String(extra.survey![k])) : '<span class="faint">—</span>'}</dd>`
          ).join('') + '</dl>'
        : '<p class="muted">なし。検証アンケートは新規収集を廃止しているので、移行データにだけ入っています。</p>') +
    '</div>';

  const hearing =
    '<div class="panel"><h2>5. 商談前ヒアリング</h2>' +
      (extra.hearing
        ? '<dl class="kv">' +
          `<dt>いま悩んでいること</dt><dd class="wrap-cell">${extra.hearing.now_text ? esc(String(extra.hearing.now_text)) : '<span class="faint">—</span>'}</dd>` +
          `<dt>解消後の毎日</dt><dd class="wrap-cell">${extra.hearing.future_text ? esc(String(extra.hearing.future_text)) : '<span class="faint">—</span>'}</dd>` +
          `<dt>更新日時</dt><dd>${esc(jst(String(extra.hearing.updated_at ?? '')))}</dd>` +
          '</dl>'
        : '<p class="muted">入力なし。</p>') +
    '</div>';

  const guide =
    '<div class="panel"><h2>6. 読み解きガイド到達</h2>' +
      '<dl class="kv">' +
        `<dt>開いた</dt><dd>${r.guide_opened_at ? esc(jst(String(r.guide_opened_at))) : '<span class="faint">未</span>'}</dd>` +
        `<dt>最終到達章</dt><dd>${esc(guideReach(r.guide_opened_at ? String(r.guide_opened_at) : null, r.guide_max_chapter === null || r.guide_max_chapter === undefined ? null : Number(r.guide_max_chapter), r.guide_completed_at ? String(r.guide_completed_at) : null))}</dd>` +
        `<dt>終章到達</dt><dd>${r.guide_completed_at ? esc(jst(String(r.guide_completed_at))) : '<span class="faint">未</span>'}</dd>` +
      '</dl>' +
    '</div>';

  const visitRows = extra.visits
    .map((v) => (
      `<tr${v.application_count >= 2 ? ' class="is-alert"' : ''}>` +
        `<td>${esc(jst(v.visited_at))}</td>` +
        `<td>${esc(v.cta)}</td>` +
        `<td class="mono faint">${esc(v.id.slice(0, 12))}…</td>` +
        `<td>${v.application_count >= 2
          ? `<span class="tag alert">申込 ${v.application_count} 件</span>`
          : v.application_count === 1 ? '<span class="tag on">申込 1 件</span>' : '<span class="tag off">なし</span>'}</td>` +
      '</tr>'
    ))
    .join('');

  const apply =
    '<div class="panel"><h2>7. 申込フォームへの到達と申込</h2>' +
      (extra.visits.length
        ? '<div class="scroll"><table><thead><tr><th>到達日時</th><th>CTA</th><th>到達ID</th><th>申込</th></tr></thead>' +
          `<tbody>${visitRows}</tbody></table></div>` +
          (extra.visits.some((v) => v.application_count >= 2)
            ? '<p class="warn">同じ到達IDに2件以上の申込があります。' +
              '<code>?v=</code> 付きのURLが人づてに渡り、第三者の申込がこの回答に紐づいた可能性があります。</p>'
            : '')
        : '<p class="muted">到達なし。</p>') +
      (extra.applications.length
        ? extra.applications.map((a) => applicationBlock(a, csrf)).join('')
        : '<p class="muted" style="margin-top:10px">紐づいた申込はありません。</p>') +
    '</div>';

  const ops =
    '<div class="panel"><h2>8. 運用</h2>' +
      `<form method="post" action="/admin/responses/${esc(String(r.id))}">` +
        `<input type="hidden" name="csrf" value="${esc(csrf)}">` +
        '<div class="filters" style="margin-bottom:10px">' +
          '<div class="f"><label for="admin_status">対応状況</label><select id="admin_status" name="admin_status">' +
            RESPONSE_STATUSES.map((s) => option(s, s, String(r.admin_status ?? '未対応'))).join('') +
          '</select></div>' +
        '</div>' +
        '<div class="f"><label for="admin_note">メモ</label>' +
        `<textarea id="admin_note" name="admin_note" maxlength="8000">${esc(String(r.admin_note ?? ''))}</textarea></div>` +
        '<p style="margin-top:10px"><button class="btn" type="submit">保存する</button></p>' +
      '</form>' +
      '<hr style="border:none; border-top:1px solid var(--line); margin:16px 0">' +
      '<h2 style="border:none">削除依頼への対応</h2>' +
      '<p class="muted" style="font-size:12px; margin-bottom:8px">' +
        '「削除（伏せる）」は一覧・CSVから外し、データは残します。' +
        '「完全に消す」は設問別回答・ヒアリング・到達記録もろとも物理削除します。取り消せません。</p>' +
      `<form method="post" action="/admin/responses/${esc(String(r.id))}/delete" style="display:inline">` +
        `<input type="hidden" name="csrf" value="${esc(csrf)}">` +
        `<button class="btn ghost sm" type="submit">${r.deleted_at ? '伏せるのを解除' : '削除（伏せる）'}</button>` +
      '</form> ' +
      `<form method="post" action="/admin/responses/${esc(String(r.id))}/purge" style="display:inline"` +
        ' onsubmit="return confirm(\'この回答を完全に削除します。取り消せません。よろしいですか？\')">' +
        `<input type="hidden" name="csrf" value="${esc(csrf)}">` +
        '<button class="btn danger sm" type="submit">完全に消す</button>' +
      '</form>' +
    '</div>';

  const body =
    `<h1>${esc(String(r.type_name ?? ''))}<span class="muted" style="font-weight:400; font-size:14px"> ／ ${esc(jst(String(r.created_at)))}</span></h1>` +
    `<p class="sub"><a href="/admin/responses">← 回答一覧へ</a></p>` +
    (r.deleted_at ? '<p class="warn">この回答は削除済み（伏せている）です。一覧とCSVには出ません。</p>' : '') +
    basic + result + answers + survey + hearing + guide + apply + ops;

  return adminPage({ ...shell, nav: 'responses' }, body);
}

/** 一覧の氏名・メールはマスクして出す（6.2）。詳細でのみ全表示する。 */
export { maskEmail, maskName };
