/**
 * ハッシュ。
 *
 * 要件：アプリ化要件定義.md 6.2（IPアドレスの生値は保存せず、ソルト付きハッシュのみ）。
 */

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * ソルト付きハッシュ。ソルトが無い、または値が空なら null を返す（何も保存しない）。
 * ソルトは環境変数 IP_HASH_SALT。リポジトリには置かない。
 */
export async function saltedHash(
  value: string | null | undefined,
  salt: string | undefined
): Promise<string | null> {
  if (!value || !salt) return null;
  return sha256Hex(`${salt}:${value}`);
}
