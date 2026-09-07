/**
 * 正規のホストへ寄せる（アプリ化要件定義.md F6-4：重複インデックスを作らない）。
 *
 * `wrangler.toml` で apex（natur-indicator.com）と www の両方をカスタムドメインにしている。
 * 何もしないと**同じ内容が2つのホストで配信され、canonical もそれぞれ自分を指す**ので、
 * 検索エンジンからは別サイトが2つあるように見えて評価が割れる。
 *
 * apex を正とし、www は 301 で寄せる。共有URL・sitemap・OGP もすべて apex に揃う。
 */

/**
 * www 付きのURLなら、apex へ寄せた行き先を返す。寄せる必要が無ければ null。
 * パス・クエリ・ハッシュはそのまま持っていく（`?ref=` の計測を切らさない）。
 */
export function apexUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!url.hostname.startsWith('www.')) return null;
  url.hostname = url.hostname.slice(4);
  // 前段の都合で http のまま渡ってくることがあるので、行き先は必ず https にする。
  url.protocol = 'https:';
  return url.toString();
}
