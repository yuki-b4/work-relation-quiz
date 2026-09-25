/**
 * セミナーの告知ページ（LP）の文面と開催情報を Markdown から機械的に写して、
 * app/src/content/seminars.ts を作る。
 *
 *   node tools/extract-seminars.mjs
 *
 * 読む先（文面の正）：セミナーLP文面.md
 * 要件：アプリ化要件定義.md F4-5「セミナーの告知ページ」
 *
 * 画像は app/assets/seminar/{slug}/ に置かれたものだけを取り込む（hero・og・speaker）。
 * **置かれていなくても失敗しない。** 画面の側が、写真なし・既定のOGP・頭文字の丸に落とす。
 *
 * ここで作った `src/content/seminars.ts` は生成物なので直接編集しない。
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocks, esc, textOf } from './md-lite.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');
const SRC = resolve(ROOT, 'セミナーLP文面.md');
const ASSETS = resolve(here, '../assets/seminar');
const OUT = resolve(here, '../src/content/seminars.ts');

const REQUIRED = [
  'title', 'description', 'catch', 'headline', 'sub', 'date', 'start', 'end',
  'place', 'fee', 'speaker_name', 'speaker_role',
];
const OPTIONAL = ['place_note', 'ticket_url', 'cta_note', 'closing', 'closing_note', 'badges'];

/** 表記ルール（CLAUDE.md）。「——」も単独の「—」も本文に使わない。 */
function checkDash(label, text) {
  if (/[—―]/.test(text)) throw new Error(`${label}: ダッシュ（— / ―）は使わない：${text}`);
}

/** ```meta の中の `key: value` を読む。key は英小文字と _ だけ。 */
function metaOf(lines, label) {
  const start = lines.findIndex((l) => l.trim() === '```meta');
  if (start < 0) throw new Error(`${label}: \`\`\`meta が無い`);
  const end = lines.findIndex((l, i) => i > start && l.trim() === '```');
  if (end < 0) throw new Error(`${label}: \`\`\`meta が閉じていない`);
  const meta = {};
  for (const line of lines.slice(start + 1, end)) {
    const m = /^([a-z_]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    if (![...REQUIRED, ...OPTIONAL].includes(m[1])) throw new Error(`${label}: 知らない項目 ${m[1]}`);
    meta[m[1]] = m[2].trim();
  }
  for (const key of REQUIRED) {
    if (!meta[key]) throw new Error(`${label}: ${key} が空`);
  }
  for (const [key, value] of Object.entries(meta)) checkDash(`${label} ${key}`, value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${label}: date は 2026-10-10 の形で書く`);
  for (const key of ['start', 'end']) {
    if (!/^\d{2}:\d{2}$/.test(meta[key])) throw new Error(`${label}: ${key} は 13:00 の形で書く`);
  }
  if (meta.end <= meta.start) throw new Error(`${label}: end が start より前になっている`);
  // 日付として実在するか（2026-02-30 のような打ち間違いを落とす）
  const d = new Date(`${meta.date}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) throw new Error(`${label}: date が日付として読めない`);
  if (meta.ticket_url && !/^https:\/\/\S+$/.test(meta.ticket_url)) {
    throw new Error(`${label}: ticket_url は https:// で始まるURLにする（空欄は可）`);
  }
  return { meta, rest: [...lines.slice(0, start), ...lines.slice(end + 1)] };
}

/** `|` で行を分ける（キャッチ・見出しの改行位置）。 */
const linesOf = (s) => s.split('|').map((x) => x.trim()).filter(Boolean);

/**
 * バッジ（`ラベル＝値` を `|` でつなぐ）。ファーストビューの丸い印に出す。
 * **事実だけを書く約束**なので、実績や順位らしい語（No.1・位・満足度・%）は弾く。
 */
function badgesOf(raw, label) {
  if (!raw) return [];
  const items = linesOf(raw).map((pair) => {
    const m = /^([^＝=]+)[＝=](.+)$/.exec(pair);
    if (!m) throw new Error(`${label}: badges は「ラベル＝値」を | でつなぐ：${pair}`);
    return { label: m[1].trim(), value: m[2].trim() };
  });
  if (items.length > 3) throw new Error(`${label}: badges は3つまで`);
  for (const b of items) {
    if (/No\.?\s*1|第?\d+位|満足度|%|％/.test(b.label + b.value)) {
      throw new Error(`${label}: badges に実績や順位は書かない（事実だけ）：${b.label}＝${b.value}`);
    }
  }
  return items;
}

/** 見出しの先頭の `[英字]` は、見出しの上に小さく出す英字（書いたとおりの大文字・小文字で出す）。 */
function splitEyebrow(heading) {
  const m = /^\[([A-Za-z][A-Za-z ]*)\]\s*(.+)$/.exec(heading);
  return m ? { eyebrow: m[1], heading: m[2].trim() } : { eyebrow: '', heading };
}

const FAQ_HEADINGS = ['よくあるご質問', 'よくある質問'];

/**
 * 文の代わりに置くイラスト。絵そのもの（SVG）は `src/views/seminar-page.ts` の ILLUSTS にある。
 * ここに無い名前を md に書いたら止める（絵が無いまま空の枠が出るのを防ぐ）。
 */
const ILLUSTS = ['silence'];

/**
 * 段落として組みつつ、`![説明](illust:名前 "左の吹き出し|右の吹き出し")` の行だけイラストの枠にする。
 * 説明は読み上げ用（画面には出ない）、吹き出しは絵の中に出す。吹き出しの中の `／` は改行。
 * 画面の側（seminar-page.ts）が枠に絵を差し込む。
 */
function blocksWithIllust(lines, label) {
  const out = [];
  let chunk = [];
  for (const line of lines) {
    const m = /^!\[(.+)\]\(illust:([a-z-]+)(?:\s+"(.+)")?\)\s*$/.exec(line.trim());
    if (!m) { chunk.push(line); continue; }
    const [, alt, name, labels = ''] = m;
    if (!ILLUSTS.includes(name)) throw new Error(`${label}: イラスト「${name}」は無い（使えるのは ${ILLUSTS.join('・')}）`);
    checkDash(`${label} イラスト`, `${alt} ${labels}`);
    out.push(blocks(chunk));
    chunk = [];
    out.push(`<figure class="lp-illust" role="img" aria-label="${esc(alt)}" data-illust="${name}" data-labels="${esc(labels)}"></figure>`);
  }
  out.push(blocks(chunk));
  return out.join('');
}

/**
 * `###` で節に、`####` で節の中の小見出しに割る。
 * 特別な節（登壇者・開催概要・よくあるご質問）は種類を付けて返す。
 */
function sectionsOf(lines, label) {
  const lead = [];
  const sections = [];
  let current = null;
  for (const line of lines) {
    const h3 = /^###\s+(.*)$/.exec(line);
    const h4 = /^####\s+(.*)$/.exec(line);
    if (h3 && !h4) {
      current = { ...splitEyebrow(h3[1].trim()), lines: [], items: [] };
      sections.push(current);
      continue;
    }
    if (h4) {
      if (!current) throw new Error(`${label}: #### が ### より前にある`);
      current.items.push({ q: h4[1].trim(), lines: [] });
      continue;
    }
    if (!current) { lead.push(line); continue; }
    const item = current.items.at(-1);
    (item ? item.lines : current.lines).push(line);
  }

  const out = sections.map((s) => {
    checkDash(`${label} 見出し`, s.heading);
    const html = blocksWithIllust(s.lines, label);
    checkDash(`${label} ${s.heading}`, textOf(html));
    if (s.heading === '開催概要') {
      if (textOf(html) || s.items.length) throw new Error(`${label}: 「開催概要」には本文を書かない（meta から組む）`);
      return { kind: 'overview', heading: s.heading, eyebrow: s.eyebrow };
    }
    if (FAQ_HEADINGS.includes(s.heading)) {
      if (!s.items.length) throw new Error(`${label}: 「${s.heading}」に #### の質問が無い`);
      return {
        kind: 'faq',
        heading: s.heading,
        eyebrow: s.eyebrow,
        items: s.items.map((it) => {
          checkDash(`${label} 質問`, it.q);
          const a = blocks(it.lines);
          checkDash(`${label} ${it.q}`, textOf(a));
          return { q: it.q, html: a, text: textOf(a) };
        }),
      };
    }
    if (s.items.length) throw new Error(`${label}: #### は「よくあるご質問」の中だけで使う（${s.heading}）`);
    return { kind: s.heading === '登壇者' ? 'speaker' : 'text', heading: s.heading, eyebrow: s.eyebrow, html };
  });

  const leadHtml = blocks(lead.filter((l) => l.trim() !== '---'));
  checkDash(`${label} リード`, textOf(leadHtml));
  for (const kind of ['overview', 'speaker']) {
    if (!out.some((s) => s.kind === kind)) throw new Error(`${label}: 「${kind === 'overview' ? '開催概要' : '登壇者'}」の節が無い`);
  }
  return { lead: leadHtml, sections: out };
}

// ───────── 画像（置かれている分だけ） ─────────

/** PNG と JPEG の縦横を読む。`<img width height>` に使う（F6-2・表示のがたつき防止）。 */
function sizeOf(buf, file) {
  // PNG：シグネチャのあと IHDR の幅と高さ（ビッグエンディアン）
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG：SOF マーカーを探す（C4・C8・CC はハフマン表などで寸法を持たない）
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  throw new Error(`${file}: PNG でも JPEG でもないか、寸法が読めない`);
}

const IMAGE_NAMES = ['hero', 'og', 'speaker'];
const EXTS = [['png', 'image/png'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg']];

function imagesOf(slug) {
  const found = {};
  for (const name of IMAGE_NAMES) {
    const hits = EXTS.filter(([ext]) => existsSync(resolve(ASSETS, slug, `${name}.${ext}`)));
    if (hits.length > 1) throw new Error(`assets/seminar/${slug}/${name}.* が複数ある。1つにする`);
    if (!hits.length) continue;
    const [ext, mime] = hits[0];
    const rel = `seminar/${slug}/${name}.${ext}`;
    const buf = readFileSync(resolve(ASSETS, slug, `${name}.${ext}`));
    const { width, height } = sizeOf(buf, rel);
    // 画像を差し替えたら URL も変わるようにする（?v=）。SNS とブラウザの古いキャッシュを残さない
    const version = createHash('sha256').update(buf).digest('hex').slice(0, 10);
    found[name] = { ident: `img_${slug.replace(/-/g, '_')}_${name}`, path: `../../assets/${rel}`, ext: ext === 'jpeg' ? 'jpg' : ext, mime, width, height, version };
  }
  return found;
}

// ───────── 読み込み ─────────

const src = readFileSync(SRC, 'utf8');
const parts = src.split(/^##\s+\/seminar\/(\S+)\s*$/m);
if (parts.length < 3) throw new Error('セミナーLP文面.md に `## /seminar/{slug}` が1つも無い');

const seminars = [];
for (let i = 1; i < parts.length; i += 2) {
  const slug = parts[i];
  const label = `/seminar/${slug}`;
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`${label}: slug は英小文字・数字・- だけにする`);
  if (seminars.some((s) => s.slug === slug)) throw new Error(`${label}: slug が重複している`);
  const { meta, rest } = metaOf(parts[i + 1].split('\n'), label);
  const { lead, sections } = sectionsOf(rest, label);
  seminars.push({
    slug,
    data: {
      slug,
      title: meta.title,
      description: meta.description,
      catchLines: linesOf(meta.catch),
      headlineLines: linesOf(meta.headline),
      subLines: linesOf(meta.sub),
      date: meta.date,
      start: meta.start,
      end: meta.end,
      place: meta.place,
      placeNote: meta.place_note ?? '',
      fee: meta.fee,
      ticketUrl: meta.ticket_url ?? '',
      ctaNote: meta.cta_note ?? '',
      closing: meta.closing ?? '',
      closingNote: meta.closing_note ?? '',
      badges: badgesOf(meta.badges, label),
      speakerName: meta.speaker_name,
      speakerRole: meta.speaker_role,
      lead,
      sections,
    },
    images: imagesOf(slug),
  });
}

// ───────── 書き出し ─────────

const imports = seminars.flatMap((s) =>
  Object.values(s.images).map((img) => `import ${img.ident} from '${img.path}';`)
);

const imageLiteral = (images) => {
  const entries = Object.entries(images).map(([name, img]) =>
    `${name}: { data: ${img.ident}, mime: '${img.mime}', ext: '${img.ext}', width: ${img.width}, height: ${img.height}, version: '${img.version}' }`
  );
  return entries.length ? `{ ${entries.join(', ')} }` : '{}';
};

const body = [
  '// 自動生成。直接編集しない。',
  '// 生成元：セミナーLP文面.md（文面と開催情報の正）と app/assets/seminar/{slug}/ の画像',
  '// 再生成：cd app && npm run content',
  '// /seminar/{slug} の中身（アプリ化要件定義.md F4-5「セミナーの告知ページ」）',
  ...imports,
  '',
  `export type SeminarImage = {
  data: ArrayBuffer;
  mime: 'image/png' | 'image/jpeg';
  /** URL に付ける拡張子。jpeg も jpg に揃える。 */
  ext: 'png' | 'jpg';
  width: number;
  height: number;
  /** 中身から作った短い印。URL の ?v= に付けて、差し替えたときに古いキャッシュを使わせない。 */
  version: string;
};

/** eyebrow は見出しの上に小さく出す英字（無ければ空文字）。 */
export type SeminarSection =
  | { kind: 'text'; heading: string; eyebrow: string; html: string }
  | { kind: 'speaker'; heading: string; eyebrow: string; html: string }
  | { kind: 'overview'; heading: string; eyebrow: string }
  | { kind: 'faq'; heading: string; eyebrow: string; items: { q: string; html: string; text: string }[] };

export type Seminar = {
  slug: string;
  title: string;
  description: string;
  /** ファーストビューに手書き風の書体で出す一文。1要素が1行。 */
  catchLines: string[];
  /** 見出し。要素の切れ目で改行する（狭い画面でも）。 */
  headlineLines: string[];
  subLines: string[];
  /** 開催日（YYYY-MM-DD）と時刻（HH:MM）。いずれも日本時間。 */
  date: string;
  start: string;
  end: string;
  place: string;
  placeNote: string;
  fee: string;
  /** Peatix のイベントページ。空のあいだは申込ボタンを押せない。 */
  ticketUrl: string;
  /** 申込ボタンのすぐ下に添える一文。空なら出さない。 */
  ctaNote: string;
  /** ページの最後、申込ボタンの上に置く一文。「|」の位置で改行する。空なら出さない。 */
  closing: string;
  /** 締めのひと言の下に置く短い文。空なら出さない。 */
  closingNote: string;
  /** ファーストビューの丸いバッジ（3つまで）。事実だけ。 */
  badges: { label: string; value: string }[];
  speakerName: string;
  speakerRole: string;
  /** 最初の見出しより前の導入。組み立て済みのHTML。 */
  lead: string;
  sections: SeminarSection[];
  images: { hero?: SeminarImage; og?: SeminarImage; speaker?: SeminarImage };
};
`,
  'export const SEMINARS: Record<string, Seminar> = {',
  ...seminars.map((s) => {
    const json = JSON.stringify(s.data, null, 2).replace(/\n}$/, '');
    return `  ${JSON.stringify(s.slug)}: ${json.replace(/\n/g, '\n  ')},\n    images: ${imageLiteral(s.images)},\n  },`;
  }),
  '};',
  '',
].join('\n');

// 型定義はテンプレート文字列の中にある。注釈にバッククォートを書くとそこで文字列が閉じ、
// 型が静かに消える（2026-09-25に一度起きた）。書き出す前に、型が残っているかを見る
for (const name of ['SeminarImage', 'SeminarSection', 'Seminar']) {
  if (!body.includes(`export type ${name} =`)) throw new Error(`生成物から型 ${name} が消えている（注釈のバッククォートを疑う）`);
}

writeFileSync(OUT, body, 'utf8');

console.log('セミナーLPの文面を書き出しました');
for (const s of seminars) {
  const imgs = IMAGE_NAMES.map((n) => `${n}:${s.images[n] ? `${s.images[n].width}x${s.images[n].height}` : 'なし'}`).join(' ');
  console.log(`  /seminar/${s.slug}  ${s.data.date} ${s.data.start}〜${s.data.end}  ${s.data.sections.length} 節  申込URL:${s.data.ticketUrl ? 'あり' : '未設定'}  ${imgs}`);
}
