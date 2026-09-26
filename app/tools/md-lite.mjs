/**
 * 文面の Markdown を HTML に写すための最小の読み手。
 *
 * 使う側：
 *   tools/extract-pages.mjs     公開ページ文面.md・プライバシーポリシー.md・利用規約.md
 *   tools/extract-seminars.mjs  セミナーLP文面.md
 *
 * どちらも「自分たちが書いた文面」だけを読む。汎用の Markdown パーサにしないのは、
 * 書ける記法を絞っておくと、文面の側で表現が暴れず、画面の見た目が揃うから。
 * 使える記法：段落・箇条書き（`-` と `1.`）・**強調**・`コード`・[リンク](/path)。
 */
/** HTMLに出す前に必ず通す。文面は自分たちのものだが、素通しにはしない。 */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 行内の記法。**強調**・`コード`・[リンク](/path)・生のURLだけを見る。
 * **エスケープしてから**当てるので、Markdown由来のタグ以外は入らない。
 *
 * リンク先は `/` で始まるサイト内か mailto: だけを許す。外部URLを書きたくなったら、
 * ここを広げる前に「本当に必要か」を考える（情報ページから外へ出す導線は基本作らない）。
 */
export function inline(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\((\/[^)\s]*|mailto:[^)\s]+)\)/g, (m, label, href) => {
    return `<a href="${href}">${label}</a>`;
  });
  if (/\[[^\]]+\]\(/.test(s)) throw new Error(`リンク先がサイト内でも mailto: でもない：${text}`);
  return s;
}

/**
 * ブロックを組み立てる。段落・箇条書き（`-` と `1.`）だけ。
 * 表や画像は使っていないので見ない。使いたくなったらここを足す。
 */
export function blocks(lines) {
  const out = [];
  let para = [];
  let list = null; // { tag: 'ul'|'ol', items: string[] }

  const flushPara = () => {
    if (para.length) { out.push(`<p>${inline(para.join(''))}</p>`); para = []; }
  };
  const flushList = () => {
    if (list) {
      out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }

    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara();
      const tag = ul ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push((ul ? ul[1] : ol[1]));
      continue;
    }
    flushList();
    // 段落の途中の改行は、そのまま繋ぐ（日本語なので空白を入れない）
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return out.join('');
}

/** タグを落として素のテキストにする（構造化データと description の保険に使う）。 */
export function textOf(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
