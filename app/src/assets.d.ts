/**
 * wrangler の `[[rules]] type = "Data"` で同梱するファイルの型。
 * これが無いと `import ogp from '../assets/ogp.png'` を型検査が通せない。
 */
declare module '*.png' {
  const data: ArrayBuffer;
  export default data;
}
