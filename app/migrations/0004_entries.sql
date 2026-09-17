-- 申込の入口（entries）と、種類ごとの付帯情報（entry_seminars）。
-- 要件：アプリ化要件定義.md F1-2（エンティティ）・F4-5（入口ごとの申込フォーム）
--
-- セミナー → 体験セッション → 成約のような、読み解きガイド以外の経路を扱えるようにする。
-- 「どこから申し込みが来たか」を申込1件につき必ず1つ持たせるのが目的。
--
-- ───────── なぜ表を作り直すのか ─────────
-- entry_id は NULL を許さない。ALTER TABLE ADD COLUMN では足せない。
-- SQLite は REFERENCES 付きの列を足すとき既定値に NULL を要求するため、
-- 「Cannot add a REFERENCES column with non-NULL default value」で落ちる。
--
-- ───────── 作り直してよいのは session_applications だけ ─────────
-- この表を参照している表が1つも無いので、DROP しても ON DELETE 動作が発火しない。
-- **apply_visits や responses を同じやり方で作り直してはいけない。**
-- DROP の暗黙 DELETE が session_applications.apply_visit_id / response_id の
-- ON DELETE SET NULL を撃ち、紐づけが黙って NULL に化ける。
-- `pragma foreign_keys = off` はトランザクション内では無視され、
-- `pragma defer_foreign_keys` は違反検査を遅らせるだけで ON DELETE 動作は止めない。
-- 実際に4通り試して確かめてある（tools/entries-migration-test.mjs）。
--
-- ───────── 列をどちらに置くかの基準 ─────────
-- その NULL が何を意味するかで決める。
--   ・「上書きしていない（＝既定の文面を使う）」の NULL は正当  → entries に置く
--   ・「その種類には該当しない」の NULL は設計の穴            → 種類ごとの表へ出す
-- 開催日・会場・参加者数は guide には存在しない概念なので entry_seminars へ出す。
-- 出した先では held_on を NOT NULL にできる（横持ちのままでは不可能だった）。

-- ───────────────────────────────────────────
-- 申込の入口（全種類に共通するものだけ）
-- ───────────────────────────────────────────
create table entries (
  id            text primary key,
  slug          text not null unique,        -- URLに載る。'guide' / 'sem-0928'
  kind          text not null,               -- 'guide' | 'seminar' | 'direct'
  name          text not null,               -- 管理用の表示名

  -- 申込ページの上書き。**どの入口にもある概念**で、NULL は「上書きしていない」の意味。
  -- NULL のときは views/apply-page.ts の既定の文面をそのまま使う。
  headline      text,                        -- 見出し
  intro         text,                        -- 冒頭の説明
  session_label text,                        -- セッションの長さの表記（'30〜45分' / '60分'）
  fields_json   text,                        -- 事前入力の追加定義（JSON配列）

  system        integer not null default 0,  -- 1 は消せない行（guide / direct）
  active        integer not null default 1,
  created_at    text not null,

  -- 種類ごとの表から複合外部キーで参照するために要る
  unique (id, kind)
);

create index idx_entries_kind on entries(kind, created_at desc);

-- kind に CHECK は置かない。種類を1つ増やすたびに表の作り直しになるため
-- （上の「なぜ表を作り直すのか」と同じ壁に毎回ぶつかる）。

-- ───────────────────────────────────────────
-- セミナー固有（kind='seminar' の入口にだけ1行）
--
-- kind を定数に固定して (entry_id, kind) で参照することで、
-- guide や direct の入口にはセミナー情報を付けられなくなる。
-- 逆方向（seminar なら必ず1行ある）は宣言できないので、
-- Admin でのセミナー作成は entries と entry_seminars を同じ batch で入れること。
-- ───────────────────────────────────────────
create table entry_seminars (
  entry_id       text primary key,
  kind           text not null default 'seminar' check (kind = 'seminar'),
  held_on        text not null,              -- 開催日。**ここでは NOT NULL にできる**
  venue          text,
  audience_count integer,                    -- 参加者数（申込率の分母）。当日まで不明なので NULL 可
  foreign key (entry_id, kind) references entries(id, kind) on delete cascade
);

-- 既定の入口2つ。**この2行があるから entry_id を NOT NULL にできる。**
-- system=1 は Admin から消させない印。消えると既存の申込が参照先を失う。
insert into entries (id, slug, kind, name, system, active, created_at) values
  ('entry_guide',  'guide',  'guide',  '診断 → 読み解きガイド終章', 1, 1, '2026-09-17T00:00:00.000Z'),
  ('entry_direct', 'direct', 'direct', '直接アクセス・入口不明',     1, 1, '2026-09-17T00:00:00.000Z');

-- ───────────────────────────────────────────
-- 申込（作り直し。足すのは entry_id と custom_answers の2列）
-- ───────────────────────────────────────────
create table session_applications_new (
  id              text primary key,
  created_at      text not null,

  -- 既定値を持たせてあるのは、**このマイグレーションをコードより先に当てても
  -- 申込が落ちないようにする**ため。入口を渡さない現行の insert は guide になる。
  -- 入口別の書き分けが全経路で入ったら、この既定値は外してよい。
  entry_id        text not null default 'entry_guide' references entries(id),

  apply_visit_id  text references apply_visits(id) on delete set null,
  response_id     text references responses(id)    on delete set null,
  type_code       text,
  name            text not null,
  email           text not null,
  concern         text,
  preferred_slots text,
  question        text,
  custom_answers  text,                      -- 入口ごとの追加項目の回答（JSON）
  source          text not null default 'in-app',
  status          text not null default '未対応',
  held_at         text,
  admin_note      text,
  deleted_at      text
);

-- 旧Googleフォームはガイド終章の申込フォームだったので guide に寄せる。
-- 到達IDを持つものも guide。どちらでもないものは入口が分からないので direct。
insert into session_applications_new
  (id, created_at, entry_id, apply_visit_id, response_id, type_code, name, email,
   concern, preferred_slots, question, custom_answers, source, status, held_at, admin_note, deleted_at)
  select id, created_at,
         case when source = 'google-form-import' then 'entry_guide'
              when apply_visit_id is not null    then 'entry_guide'
              else 'entry_direct' end,
         apply_visit_id, response_id, type_code, name, email,
         concern, preferred_slots, question, null, source, status, held_at, admin_note, deleted_at
    from session_applications;

drop table session_applications;
alter table session_applications_new rename to session_applications;

-- 索引は 0001・0003 で張っていたものをすべて張り直す（表ごと作り直したので消えている）。
create index idx_session_apps_created  on session_applications(created_at desc);
create index idx_session_apps_response on session_applications(response_id);
create index idx_session_apps_visit    on session_applications(apply_visit_id);
create index idx_session_apps_status   on session_applications(status);
create index idx_session_apps_email    on session_applications(email);
create index idx_session_apps_entry    on session_applications(entry_id, created_at desc);
