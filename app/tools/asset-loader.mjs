/**
 * 試験（node で .ts を直接読むもの）用：`import x from '…/hero.jpg'` を ArrayBuffer にする。
 *
 *   node --experimental-strip-types --import ./tools/asset-loader.mjs tools/seminar-check.mjs
 *
 * 本番では wrangler が wrangler.toml の [[rules]]（type = "Data"）で画像を ArrayBuffer として
 * 束ねている。node はそれを知らないので、画像を import した時点で止まる
 * （ERR_UNKNOWN_FILE_EXTENSION）。セミナーLPに写真を置くと `src/content/seminars.ts` が
 * 画像を import するようになるため、ここで同じ形に揃える。
 */
import { register } from 'node:module';

register('./asset-hooks.mjs', import.meta.url);
