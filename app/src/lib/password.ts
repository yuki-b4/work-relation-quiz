/**
 * パスワードのハッシュ化と照合。
 *
 * 要件：アプリ化要件定義.md F2-1（パスワードは bcrypt / argon2 でハッシュ化）。
 *
 * **bcrypt / argon2 ではなく PBKDF2-HMAC-SHA256 を使う。** 理由：
 *   ・Workers に bcrypt / argon2 のネイティブ実装が無い。持ち込むと WASM か純JS実装になり、
 *     純JS の bcrypt はエッジのCPU時間を素で数百ms食う上、依存も増える
 *   ・PBKDF2 は WebCrypto にネイティブで入っていて、依存ゼロで動く
 *   ・OWASP の Password Storage Cheat Sheet も、bcrypt/argon2 が使えない環境の選択肢として
 *     PBKDF2-HMAC-SHA256・600,000回を挙げている
 * 600,000回で1回あたり約0.3秒のCPU。ログインは1名・年に数十回なので、
 * Workers Paid（月3,000万CPU-ms）の枠に対して無視できる（8.2）。
 *
 * 保存形式は自己記述にする。あとから回数を上げたくなったら、ログイン成功時に
 * 新しい回数で入れ直せる（needsRehash）。
 *
 *   pbkdf2-sha256$600000$<salt(base64)>$<hash(base64)>
 */

/** いま新しく作るときの反復回数（OWASP 2023年以降の推奨値）。 */
export const PBKDF2_ITERATIONS = 600_000;

const SALT_BYTES = 16;
const KEY_BITS = 256;
const PREFIX = 'pbkdf2-sha256';

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    // Uint8Array<ArrayBuffer> をそのまま渡す。BufferSource として受け取られる。
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as unknown as BufferSource, iterations },
    key,
    KEY_BITS
  );
  return new Uint8Array(bits);
}

/** 新しいパスワードのハッシュを作る。保存するのはこの文字列だけ。 */
export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, iterations);
  return `${PREFIX}$${iterations}$${toBase64(salt)}$${toBase64(hash)}`;
}

/**
 * 照合。**必ず定数時間で比べる**（早期returnにすると、一致した先頭バイト数が時間に出る）。
 * 形式が壊れている・アルゴリズムが違う場合は false を返す（例外にしない。
 * ログインの入口で落ちると、攻撃者に「その口だけ挙動が違う」を教えることになる）。
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 4 || parts[0] !== PREFIX) return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 5_000_000) return false;
  let expected: Uint8Array;
  let salt: Uint8Array;
  try {
    salt = fromBase64(parts[2]!);
    expected = fromBase64(parts[3]!);
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = await derive(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}

/** 長さの違いも含めて、比較にかかる時間を入力に依存させない。 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** 文字列どうしの定数時間比較（CSRFトークン・セッションIDの照合に使う）。 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  return timingSafeEqual(enc.encode(a), enc.encode(b));
}

/** 保存済みハッシュの反復回数が今の推奨より低いか。ログイン成功時に入れ直す判断に使う。 */
export function needsRehash(stored: string): boolean {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 4 || parts[0] !== PREFIX) return true;
  return Number(parts[1]) < PBKDF2_ITERATIONS;
}
