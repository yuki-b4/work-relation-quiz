/**
 * セミナーの告知ページ（/seminar/{slug}）を、開催前・申込URLあり・終了後の3つの状態で描いて見る。
 *
 *   node --experimental-strip-types tools/seminar-check.mjs
 *
 * アプリ化要件定義.md F4-5「セミナーの告知ページ」。時刻で表示が変わるページなので、
 * dev サーバーを立てて今の時刻で見るだけでは、終了後の表示が確かめられない。
 * ここでは「今」を渡して描き分ける。
 */
import { SEMINARS } from '../src/content/seminars.ts';
import { seminarEnded, seminarPage } from '../src/views/seminar-page.ts';

let fail = 0;
const t = (label, actual, expected) => {
  if (String(actual) !== String(expected)) { fail++; console.log(`  NG: ${label} → 期待 ${expected} / 実際 ${actual}`); }
};
const markup = (html) => html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
const ldOf = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1].replace(/<\\\//g, '</'));

const ORIGIN = 'https://natur-indicator.com';
const slugs = Object.keys(SEMINARS);
t('セミナーが1件以上ある', slugs.length > 0, true);

for (const slug of slugs) {
  const s = SEMINARS[slug];
  const start = Date.parse(`${s.date}T${s.start}:00+09:00`);
  const end = Date.parse(`${s.date}T${s.end}:00+09:00`);
  const before = start - 3 * 86400_000;
  const label = `/seminar/${slug}`;

  // ── 開催前（申込URLは md のまま） ──
  {
    const html = seminarPage(s, ORIGIN, before);
    const body = markup(html);
    t(`${label} 開催前は終了扱いでない`, seminarEnded(s, before), false);
    t(`${label} 開催前は noindex でない`, /noindex/.test(html), false);
    t(`${label} h1 が1つ`, (body.match(/<h1/g) ?? []).length, 1);
    t(`${label} canonical`, html.includes(`<link rel="canonical" href="${ORIGIN}/seminar/${slug}">`), true);
    t(`${label} キャッチの一文が文字で入っている`, body.includes('class="lp-catch"') && s.catchLines.every((l) => body.includes(l)), true);
    t(`${label} 見出しが入っている`, s.headlineLines.every((l) => body.includes(l)), true);
    t(`${label} og:image が絶対URL`, /property="og:image" content="https:\/\//.test(html), true);
    // 申込ボタン：URLがあれば Peatix へ、無ければ押せない表示
    if (s.ticketUrl) {
      t(`${label} 申込ボタンが Peatix へ向く`, body.includes(`href="${s.ticketUrl}"`), true);
    } else {
      t(`${label} 申込URL未設定なら押せない表示`, body.includes('お申し込みの受付は準備中です') && body.includes('aria-disabled="true"'), true);
    }
    const graph = ldOf(html)['@graph'];
    const ev = graph.find((g) => g['@type'] === 'Event');
    t(`${label} Event の構造化データがある`, !!ev, true);
    t(`${label} 開始が日本時間`, ev.startDate, `${s.date}T${s.start}:00+09:00`);
    t(`${label} 終了が日本時間`, ev.endDate, `${s.date}T${s.end}:00+09:00`);
    t(`${label} オンライン開催`, ev.eventAttendanceMode, 'https://schema.org/OnlineEventAttendanceMode');
    t(`${label} WebSite がある`, graph.some((g) => g['@type'] === 'WebSite'), true);
    // 開催概要と登壇者が組まれていること（md では本文を書かない／meta から組む節）
    t(`${label} 開催概要の表がある`, body.includes('class="lp-dl"'), true);
    t(`${label} 登壇者の名前がある`, body.includes(`class="lp-spk-name">${s.speakerName}<`), true);
    // 独立したLP（F4-5）：診断サイトの共通CSS・ヘッダー・フッターを持ち込まない
    t(`${label} 診断サイトのヘッダーを使っていない`, body.includes('app-header') || body.includes('site-foot'), false);
    t(`${label} 診断サイトのCSSを使っていない`, /\.screen\{|--coral:/.test(html), false);
    // DADS：本文へ飛ぶリンク・言語・FAQ は details で開閉
    t(`${label} 本文へ飛ぶリンクがある`, body.includes('<a class="lp-skip" href="#main">') && body.includes('<main id="main">'), true);
    t(`${label} 言語が日本語`, html.startsWith('<!DOCTYPE html><html lang="ja">'), true);
    t(`${label} FAQ が details で開閉する`, (body.match(/<details><summary>/g) ?? []).length, s.sections.find((x) => x.kind === 'faq')?.items.length ?? 0);
    // 表記ルール（CLAUDE.md）：ダッシュを本文に使わない
    t(`${label} ダッシュを使っていない`, /[—―]/.test(body.replace(/<[^>]+>/g, '')), false);
  }

  // ── 申込URLが入ったとき ──
  {
    const withTicket = { ...s, ticketUrl: 'https://peatix.com/event/0000000' };
    const body = markup(seminarPage(withTicket, ORIGIN, before));
    t(`${label} 申込URLがあればボタンが Peatix へ向く`, (body.match(/href="https:\/\/peatix\.com\/event\/0000000"/g) ?? []).length >= 2, true);
    t(`${label} 申込URLがあれば準備中の表示は出ない`, body.includes('お申し込みの受付は準備中です'), false);
  }

  // ── 終了後 ──
  {
    const after = end + 60_000;
    const withTicket = { ...s, ticketUrl: 'https://peatix.com/event/0000000' };
    const html = seminarPage(withTicket, ORIGIN, after);
    const body = markup(html);
    t(`${label} 終了時刻ちょうどで終了扱い`, seminarEnded(s, end), true);
    t(`${label} 終了後は noindex`, html.includes('<meta name="robots" content="noindex, nofollow">'), true);
    t(`${label} 終了後は申込ボタンを外す`, body.includes('peatix.com/event/0000000'), false);
    t(`${label} 終了後は終了と出す`, body.includes('このセミナーは終了しました。'), true);
    t(`${label} 終了後は診断へ戻れる`, body.includes('<a class="lp-btn" href="/"'), true);
  }
}

if (fail) {
  console.log(`\nセミナーLPの検査：NG ${fail} 件`);
  process.exit(1);
}
console.log(`セミナーLPの検査：${slugs.length} 件とも OK（開催前・申込URLあり・終了後）`);
