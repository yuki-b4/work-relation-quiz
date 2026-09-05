/**
 * Admin の表示用ヘルパ（純関数）。
 *
 * 時刻は DB に UTC の ISO8601 で入っている。**画面と CSV は JST で出す**
 * （アプリ化要件定義.md 7.3：タイムゾーンを明示して扱う）。
 * 個人情報のマスクは 6.2「氏名・メールは一覧では一部マスク、詳細でのみ全表示」。
 */

const JST_OFFSET_MS = 9 * 3_600_000;

/** UTCのISO → 'YYYY-MM-DD HH:mm'（JST）。空なら '—'。 */
export function jst(iso: string | null | undefined, withSeconds = false): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return String(iso);
  const s = new Date(t + JST_OFFSET_MS).toISOString();
  return withSeconds ? `${s.slice(0, 10)} ${s.slice(11, 19)}` : `${s.slice(0, 10)} ${s.slice(11, 16)}`;
}

/** CSV用。'YYYY-MM-DD HH:mm:ss'（JST）。Excelがそのまま日時として読む形。 */
export function jstFull(iso: string | null | undefined): string {
  return iso ? jst(iso, true) : '';
}

/** JSTの日付（YYYY-MM-DD）→ その日の 00:00 JST を指すUTCのISO。期間の下限に使う。 */
export function jstDayStart(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const t = Date.parse(`${day}T00:00:00+09:00`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** JSTの日付 → **翌日**の 00:00 JST。期間の上限（未満）に使うと、その日を含められる。 */
export function jstDayEnd(day: string): string | null {
  const start = jstDayStart(day);
  return start ? new Date(Date.parse(start) + 86_400_000).toISOString() : null;
}

/** 氏名のマスク。先頭1文字だけ残す（一覧用。6.2）。 */
export function maskName(name: string | null | undefined): string {
  const s = String(name ?? '').trim();
  if (!s) return '—';
  return s.length <= 1 ? `${s}◯` : `${s[0]}${'◯'.repeat(Math.min(s.length - 1, 3))}`;
}

/** メールのマスク。ローカル部の先頭2文字とドメインだけ残す（一覧用。6.2）。 */
export function maskEmail(email: string | null | undefined): string {
  const s = String(email ?? '').trim();
  const at = s.lastIndexOf('@');
  if (at <= 0) return s ? '***' : '—';
  const local = s.slice(0, at);
  const domain = s.slice(at);
  const head = local.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(local.length - head.length, 1))}${domain}`;
}

/** 所要時間（回答開始→完了）。分秒で読む。 */
export function duration(from: string | null | undefined, to: string | null | undefined): string {
  if (!from || !to) return '—';
  const ms = Date.parse(to) - Date.parse(from);
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const sec = Math.round(ms / 1000);
  return sec < 60 ? `${sec}秒` : `${Math.floor(sec / 60)}分${String(sec % 60).padStart(2, '0')}秒`;
}

/** 0〜1のスコアを％に。境界の見分けがつくよう小数1桁まで出す。 */
export function pct(v: number | null | undefined): string {
  return v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : `${(Number(v) * 100).toFixed(1)}%`;
}

/** JSON配列で入っている列（preferred_slots・issues）を読む。壊れていても落ちない。 */
export function jsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    // 移行前のデータが「、」連結のまま入っている場合の保険。
    return String(raw).split(/[、,]/).map((s) => s.trim()).filter(Boolean);
  }
}

/** ガイドの到達章。数値のままだと読めないので言葉にする。 */
export const GUIDE_CHAPTER_LABEL = ['序章', '第一章', '第二章', '終章'] as const;

export function guideReach(openedAt: string | null, maxChapter: number | null, completedAt: string | null): string {
  if (!openedAt) return '未';
  if (completedAt) return '終章';
  const n = maxChapter ?? 0;
  return GUIDE_CHAPTER_LABEL[Math.max(0, Math.min(3, n))] ?? '序章';
}
