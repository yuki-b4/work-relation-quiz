/**
 * CSV 出力（アプリ化要件定義.md F2-7）。
 *
 * **UTF-8 BOM 付き**にする。付けないと Excel が Shift_JIS と誤認して日本語が化ける。
 * 改行・カンマ・引用符を含む値は必ず引用する。先頭が = + - @ の値は、Excel が数式として
 * 解釈しないように ' を前置する（CSVインジェクション対策）。
 */

/** UTF-8 BOM。見えない文字なので、リテラルに直接置かずここで名前を付ける。 */
const BOM = '\uFEFF';

export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  // Excel / Sheets の数式起動を殺す。表示は変わるが、Adminが読む用途では実害がない。
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(cells: readonly unknown[]): string {
  return cells.map(csvCell).join(',');
}

/** ヘッダー＋行 → BOM付きCSV文字列。改行は CRLF（Excelの既定）。 */
export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return BOM + [csvRow(header), ...rows.map(csvRow)].join('\r\n') + '\r\n';
}

/** ダウンロード用のヘッダー。ファイル名は日本語を避け、日付を入れて重複しないようにする。 */
export function csvHeaders(filename: string): Record<string, string> {
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store, private',
  };
}
