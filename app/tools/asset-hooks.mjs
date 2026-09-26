/**
 * asset-loader.mjs が登録する読み込みの差し替え。png・jpg だけを ArrayBuffer の既定の書き出しにする。
 * それ以外は node の通常の読み込みに任せる。
 */
import { readFile } from 'node:fs/promises';

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && /\.(png|jpe?g)$/i.test(new URL(url).pathname)) {
    const b64 = (await readFile(new URL(url))).toString('base64');
    return {
      format: 'module',
      shortCircuit: true,
      source:
        `const b = Buffer.from(${JSON.stringify(b64)}, 'base64');` +
        'export default b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);',
    };
  }
  return nextLoad(url, context);
}
