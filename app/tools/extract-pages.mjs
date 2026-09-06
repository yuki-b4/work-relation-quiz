/**
 * 情報ページの文面を Markdown から機械的に写して、app/src/content/pages.ts を作る。
 *
 *   node tools/extract-pages.mjs
 *
 * 読む先（文面の正）：
 *   公開ページ文面.md      → /about・/faq・/contact
 *   プライバシーポリシー.md → /privacy
 *   利用規約.md            → /terms
 *
 * 手で書き写すと、文面の正とページの中身が静かにずれる。`tools/extract-content.mjs` が
 * prototype.html に対してやっていることを、この3つの Markdown に対してやる。
 *
 * ここで作った `src/content/pages.ts` は生成物なので直接編集しない。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');
const OUT = resolve(here, '../src/content/pages.ts');

// ───────── Markdown（この3ファイルが使う範囲だけ） ─────────

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

/**
 * `### 見出し` で節に割る。見出しの前に書いた段落はリード文になる。
 * `/faq` ではこの見出しがそのまま質問になる。
 */
function sectionsOf(lines) {
  const lead = [];
  const sections = [];
  let current = null;
  for (const line of lines) {
    const h = /^###\s+(.*)$/.exec(line);
    if (h) {
      current = { heading: h[1].trim(), lines: [] };
      sections.push(current);
      continue;
    }
    (current ? current.lines : lead).push(line);
  }
  return {
    lead: blocks(lead),
    sections: sections.map((s) => ({ heading: s.heading, html: blocks(s.lines) })),
  };
}

// ───────── 公開ページ文面.md ─────────

/** ```meta の中の `key: value` を読む。 */
function metaOf(lines, label) {
  const start = lines.findIndex((l) => l.trim() === '```meta');
  if (start < 0) throw new Error(`${label}: \`\`\`meta が無い`);
  const end = lines.findIndex((l, i) => i > start && l.trim() === '```');
  if (end < 0) throw new Error(`${label}: \`\`\`meta が閉じていない`);
  const meta = {};
  for (const line of lines.slice(start + 1, end)) {
    const m = /^([a-z]+)\s*:\s*(.*)$/.exec(line.trim());
    if (m) meta[m[1]] = m[2].trim();
  }
  if (!meta.title) throw new Error(`${label}: title が無い`);
  if (!meta.description) throw new Error(`${label}: description が無い`);
  return { meta, rest: [...lines.slice(0, start), ...lines.slice(end + 1)] };
}

function readCopyPages() {
  const src = readFileSync(resolve(ROOT, '公開ページ文面.md'), 'utf8');
  const pages = {};
  // `## /パス` で割る。先頭（この文書自身の説明）は捨てる。
  const parts = src.split(/^##\s+(\/[a-z-]+)\s*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const path = parts[i];
    const lines = parts[i + 1].split('\n').filter((l) => l.trim() !== '---');
    const { meta, rest } = metaOf(lines, path);
    const { lead, sections } = sectionsOf(rest);
    pages[path] = { title: meta.title, description: meta.description, h1: meta.title, lead, sections };
  }
  for (const path of ['/about', '/faq', '/contact']) {
    if (!pages[path]) throw new Error(`公開ページ文面.md に ${path} が無い`);
  }
  return pages;
}

// ───────── プライバシーポリシー.md / 利用規約.md ─────────

/**
 * 規約類は「最初の `---` より下」が本文（その上はこの文書自身の説明と注記）。
 * 本文の `## ` が見出し（＝h1）、`### ` が各条。
 */
function readLegal(file, description) {
  const src = readFileSync(resolve(ROOT, file), 'utf8');
  const i = src.search(/^---\s*$/m);
  if (i < 0) throw new Error(`${file}: 本文の区切り（---）が無い`);
  const body = src.slice(i).split('\n').slice(1);

  const h1Index = body.findIndex((l) => /^##\s+/.test(l));
  if (h1Index < 0) throw new Error(`${file}: 本文の見出し（##）が無い`);
  const h1 = body[h1Index].replace(/^##\s+/, '').trim();

  const { lead, sections } = sectionsOf(body.slice(h1Index + 1));
  return { title: h1.replace(/^ナチュール診断\s*/, ''), description, h1, lead, sections };
}

// ───────── 書き出し ─────────

const copy = readCopyPages();

const pages = {
  about: copy['/about'],
  faq: copy['/faq'],
  contact: copy['/contact'],
  privacy: readLegal(
    'プライバシーポリシー.md',
    'ナチュール診断における個人情報の取り扱いについて定めたものです。取得する情報、利用目的、保存期間、開示や削除のご請求の窓口を記載しています。'
  ),
  terms: readLegal(
    '利用規約.md',
    'ナチュール診断の利用条件を定めたものです。診断結果の性質、その場かぎりの表示について、禁止事項、免責の範囲を記載しています。'
  ),
};

// FAQPage の構造化データ用（F7-3）。見出しが質問、中身が答え。
const faqItems = pages.faq.sections.map((s) => ({ q: s.heading, a: textOf(s.html) }));
if (faqItems.length < 5) throw new Error('FAQ が少なすぎる（リッチリザルトに出ない）');

const banner = [
  '// 自動生成。直接編集しない。',
  '// 生成元：公開ページ文面.md／プライバシーポリシー.md／利用規約.md（いずれも文面の正）',
  '// 再生成：cd app && node tools/extract-pages.mjs',
  '// /about・/faq・/contact・/privacy・/terms の中身',
  '',
].join('\n');

const body = `${banner}export type InfoSection = {
  /** 節の見出し。/faq ではこれが質問そのもの。 */
  heading: string;
  /** 本文のHTML。生成時に組み立て済みなので、描画側はそのまま出す。 */
  html: string;
};

export type InfoPage = {
  /** <title> に使う。サイト名は描画側で付ける。 */
  title: string;
  description: string;
  h1: string;
  /** 見出しの前に置かれた導入。無ければ空文字。 */
  lead: string;
  sections: InfoSection[];
};

export const INFO_PAGES = ${JSON.stringify(pages, null, 2)} as const satisfies Record<string, InfoPage>;

/** FAQPage 構造化データ（アプリ化要件定義.md F7-3）。答えはタグを落とした素のテキスト。 */
export const FAQ_ITEMS = ${JSON.stringify(faqItems, null, 2)} as const;
`;

writeFileSync(OUT, body, 'utf8');

console.log('公開ページの文面を書き出しました');
for (const [key, p] of Object.entries(pages)) {
  console.log(`  /${key === 'about' ? 'about' : key}`.padEnd(12), `${p.sections.length} 節  ${p.title}`);
}
console.log(`  FAQ の質問  ${faqItems.length} 件`);
