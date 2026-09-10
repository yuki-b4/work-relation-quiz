-- 宣言（施策a 段1）。
-- 正：集客戦略マップ.md §3.6（画面と実装）・§3.8（A-1〜A-4と列の意味）
--
-- 結果画面の直後に置くフォーク（「この結果を、どこで使いますか」）で選ばれた
-- 場面・相手・期限を残す。**文面より先に、記録を出す**ための列で、
-- 見立て（段2・段3）はまだ何も作らない。
-- 0001〜0003 は編集せず、変更はこのファイルで足す。
--
-- 値はコードで入れる（'work' など）。画面の言葉を変えても記録が割れないため。
-- 表示の言葉は app/src/lib/declaration.ts が持つ。

-- ───────── 回答（フォークでの宣言・A-1） ─────────
alter table responses add column concern_domain    text;  -- 'work'（職場）| 'love'（恋愛・結婚）| 'unknown'（まだ分からない）
alter table responses add column concern_target    text;  -- 相手の立場。boss/peer/report（職場）partner/family（恋愛・結婚）other
alter table responses add column concern_deadline  text;  -- 'now'（今すぐ）| 'months'（数ヶ月のうち）| 'none'（期限はない）
alter table responses add column partner_type_code text;  -- 推定した相手のタイプ3文字。**段2で埋まる**（段1では常に null）
alter table responses add column declared_at       text;  -- 宣言した時刻。**ここが null かどうかで宣言率が測れる**

-- ───────── 申込フォームでの宣言（A-4） ─────────
-- 申込フォームで取った宣言は、申込の行に持つ。**回答側の列に書き戻さない。**
-- 書き戻すと「申込した人は必ず宣言済み」になり、§3.8 が段1で測れるとした3つ目、
-- **宣言した人としない人の申込率の差**が測れなくなる（全員が宣言済みの側に入るため）。
-- フォークを飛ばした人・ガイド経由の人の宣言は、ここでだけ拾う。
alter table session_applications add column concern_domain   text;
alter table session_applications add column concern_target   text;
alter table session_applications add column concern_deadline text;

-- 索引は張らない。§8 で見るのは全件の集計（宣言率・ドメイン分布・宣言の有無別の申込率）で、
-- どれも全走査になるうえ、索引が効いてくる件数にはまだ遠い。
