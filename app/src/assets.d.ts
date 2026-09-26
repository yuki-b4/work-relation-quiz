/**
 * wrangler の `[[rules]] type = "Data"` で同梱するファイルの型。
 * これが無いと `import ogp from '../assets/ogp.png'` を型検査が通せない。
 */
declare module '*.png' {
  const data: ArrayBuffer;
  export default data;
}

declare module '*.ico' {
  const data: ArrayBuffer;
  export default data;
}

declare module '*.svg' {
  const data: ArrayBuffer;
  export default data;
}

// セミナーLPの写真（app/assets/seminar/{slug}/）。写真は png より jpg の方が軽い
declare module '*.jpg' {
  const data: ArrayBuffer;
  export default data;
}

declare module '*.jpeg' {
  const data: ArrayBuffer;
  export default data;
}
