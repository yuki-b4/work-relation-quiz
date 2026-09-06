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
 *     PBKDF2-HMAC-SHA256 を挙げている
 *
 * **反復回数は100,000。Workers の WebCrypto がそれ以上を受け付けない。**
 * OWASP の推奨は600,000だが、その値で作ると本番で次の例外になって落ちる。
 *
 *   NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not supported
 *
 * **ローカルの `wrangler dev` はこの上限を課さない。** 手元では600,000でも通ってしまい、
 * デプロイして初めて出る。だから試験で定数そのものを固定している
 * （tools/admin-auth-test.mjs）。上げるときは PBKDF2_MAX_ITERATIONS を超えないこと。
 *
 * 推奨値に足りないぶんは、**パスワードの長さで埋める**。`tools/admin-password.mjs` が
 * 24文字（約140ビット）を作り、README もパスワードマネージャの使用を求めている。
 * この強度なら反復回数は総当たりの成否をもう左右しない。回数が効いてくるのは、
 * 人が考えた短いパスワードを使ったときだけ。
 *
 * 保存形式は自己記述にする。あとから回数を変えたくなったら、ログイン成功時に
 * 新しい回数で入れ直せる（needsRehash）。
 *
 *   pbkdf2-sha256$100000$<salt(base64)>$<hash(base64)>
 */

/**
 * Workers の WebCrypto が受け付ける PBKDF2 の反復回数の上限。
 * これを超えて deriveBits を呼ぶと NotSupportedError になる（本番のみ。dev では通る）。
 */
export const PBKDF2_MAX_ITERATIONS = 100_000;

/** いま新しく作るときの反復回数。上限いっぱいを使う。 */
export const PBKDF2_ITERATIONS = PBKDF2_MAX_ITERATIONS;

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

/**
 * 新しいパスワードのハッシュを作る。保存するのはこの文字列だけ。
 *
 * **上限を超える回数は受け付けない。** 作れてしまうと、そのハッシュは本番で照合できない。
 * `tools/admin-password.mjs` は Node で動き、Node には上限が無いので、ここで止めないと
 * 「作れたのにログインできない」ハッシュができてしまう。
 */
export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  if (iterations > PBKDF2_MAX_ITERATIONS) {
    throw new Error(
      `PBKDF2 の反復回数は ${PBKDF2_MAX_ITERATIONS} までです（指定 ${iterations}）。` +
      'Workers の WebCrypto がこれを超える値を受け付けません。'
    );
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, iterations);
  return `${PREFIX}$${iterations}$${toBase64(salt)}$${toBase64(hash)}`;
}

/** 保存値を読んだ結果。壊れているときは、なぜ壊れているかを返す。 */
export type StoredHash =
  | { ok: true; iterations: number; salt: Uint8Array; expected: Uint8Array }
  | { ok: false; reason: 'empty' | 'format' | 'algo' | 'iterations' | 'base64' };

/**
 * 保存値を読む。
 *
 * **壊れている理由を返すのが肝。** ここが壊れていても照合は「不一致」にしかならず、
 * 画面には「パスワードが違います」としか出ないので、原因に辿りつけない。
 * 呼び出し側（login）が監査ログにこの理由を残す。
 *
 * 実際に踏んだ壊れ方：ハッシュに `$` が3つ入っているのに、
 * `wrangler d1 execute --command "…"` のダブルクォートへ貼ったせいでシェルが変数展開し、
 * `$` ごと消えた値が保存されていた。形式は 'format' として出る。
 */
export function parseStoredHash(stored: string | null | undefined): StoredHash {
  const raw = String(stored ?? '');
  if (!raw) return { ok: false, reason: 'empty' };
  const parts = raw.split('$');
  if (parts.length !== 4) return { ok: false, reason: 'format' };
  if (parts[0] !== PREFIX) return { ok: false, reason: 'algo' };
  const iterations = Number(parts[1]);
  // 上限を超えた保存値は、この環境では計算し直せない（deriveBits が例外を投げる）。
  // 該当するのは、上限を知らずに作られた古いハッシュだけ。
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > PBKDF2_MAX_ITERATIONS) {
    return { ok: false, reason: 'iterations' };
  }
  try {
    const salt = fromBase64(parts[2]!);
    const expected = fromBase64(parts[3]!);
    if (salt.length === 0 || expected.length === 0) return { ok: false, reason: 'base64' };
    return { ok: true, iterations, salt, expected };
  } catch {
    return { ok: false, reason: 'base64' };
  }
}

/**
 * 照合。**必ず定数時間で比べる**（早期returnにすると、一致した先頭バイト数が時間に出る）。
 * 形式が壊れている・アルゴリズムが違う場合は false を返す（例外にしない。
 * ログインの入口で落ちると、攻撃者に「その口だけ挙動が違う」を教えることになる）。
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (!parsed.ok) return false;
  const { iterations, salt, expected } = parsed;
  let actual: Uint8Array;
  try {
    actual = await derive(password, salt, iterations);
  } catch {
    // 実行環境が受け付けない条件（上のチェックをすり抜けた場合）。落とさず不一致にする。
    return false;
  }
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
