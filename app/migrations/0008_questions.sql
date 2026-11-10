-- 申込フォームの設問マスタ（questions）と、入口ごとの設問（entry_questions）、
-- 設問への回答（question_answers）。あわせて見出しの帯（entries.eyebrow）。
-- 要件：アプリ化要件定義.md F1-2（questions ほか）・F4-5（申込フォームの設問）・F2-8（入口の編集）
--
-- 入口ごとに出す任意の設問を、Admin で選べるようにする（2026-11-10）。
-- 診断を使わないセミナー（副業など）でも、その回に合った設問を出すため。
--
-- ───────── このマイグレーションは「足して写す」だけ ─────────
-- 古い列（session_applications.concern / question / custom_answers、
-- entries.session_label / fields_json）は**ここでは消さない**。
-- 古いコードのまま当てても壊れないようにするため（当ててからデプロイまでの間も申込は来る）。
-- 古い列を消すのは 0009 で、新しいコードを出して動作を確かめてから作る。
-- 0009 では先に、下の「既存の回答を写す」をもう一度流す（insert or ignore なので何度流しても同じ）。
-- その間に古いコードが受けた申込を拾うため。
--
-- ───────── session_applications は、もう作り直せない ─────────
-- question_answers が session_applications を on delete cascade で参照する。
-- 0007 のように DROP して作り直すと、DROP の暗黙 DELETE が回答を連鎖で消す。
-- 列を消すときは ALTER TABLE ... DROP COLUMN を使う（作り直さない）。
--
-- ───────── お名前・メールアドレスは設問にしない ─────────
-- 連絡先であって、書いてもらった内容ではない。列なら NOT NULL で必須を保証でき、
-- 一覧・検索・伏せ字・通知がそのまま使える。書いてもらった内容（任意の設問と、
-- 固定の「ご質問・伝えておきたいこと」）は、すべて question_answers の1か所に入れる。

-- ───────────────────────────────────────────
-- 設問マスタ。入力はすべて複数行（2026-11-10 にユーザーが決めた）ので、入力の形の列は持たない。
-- 診断の設問とは別物（診断の設問は prototype.html が正で、DB には持たない）。
-- ───────────────────────────────────────────
create table questions (
  id         text primary key,
  label      text not null,              -- 設問文。「（任意）」は画面が付ける
  hint       text,                       -- 注釈。設問に1対1。NULL なら出さない
  fixed      integer not null default 0, -- 1 は全ページに出す設問。Admin では編集も選択もできない
  archived   integer not null default 0, -- 1 は選択肢から外した設問。回答から参照されるので消さない
  created_at text not null
);

-- ───────────────────────────────────────────
-- 入口ごとに、どの設問をどの順で出すか。新しい入口は0件から始まる。
-- 固定の設問（fixed=1）はここに入れない。選んだ設問の後ろに必ず出す。
-- ───────────────────────────────────────────
create table entry_questions (
  entry_id    text not null references entries(id) on delete cascade,
  question_id text not null references questions(id),
  position    integer not null,
  primary key (entry_id, question_id),
  unique (entry_id, position)
);
create index idx_entry_questions_question on entry_questions(question_id);

-- ───────────────────────────────────────────
-- 設問への回答。**出した設問は空欄でも1行残す**（answer は NULL）。設問ごとの記入率を出すため。
-- 設問文は申込した時点のものを写す。あとで設問文を直しても、過去の回答の意味が変わらない。
-- ───────────────────────────────────────────
create table question_answers (
  application_id text not null references session_applications(id) on delete cascade,
  question_id    text not null references questions(id),
  position       integer not null,       -- 申込者が見た並び順
  label          text not null,          -- 申込した時点の設問文の写し
  answer         text,                   -- 空欄なら NULL
  primary key (application_id, question_id)
);
create index idx_question_answers_question on question_answers(question_id);

-- 見出しの帯。NULL なら既定の「体験セッション（60分・無料）」（views/apply-page.ts）
alter table entries add column eyebrow text;

-- ───────────────────────────────────────────
-- 最初の設問
-- ───────────────────────────────────────────
insert into questions (id, label, hint, fixed, created_at) values
  ('q_concern',    'いま、人間関係で気になっていること',
                   'ひと言でも大丈夫です。書いていただけると、当日の読み解きが早く、深くなります。',
                   0, '2026-11-10T00:00:00.000Z'),
  ('q_side_since', '副業を始めたいと思ってどのくらい経ちますか？',     null, 0, '2026-11-10T00:00:00.000Z'),
  ('q_side_worry', '副業を始める上で悩んでいることを教えてください', null, 0, '2026-11-10T00:00:00.000Z'),
  ('q_message',    'ご質問・伝えておきたいこと',                     null, 1, '2026-11-10T00:00:00.000Z');

-- ───────────────────────────────────────────
-- 旧形式の追加項目（entries.fields_json の各ラベルと、custom_answers のキー）を設問にする。
-- archived=1 にして、新しい入口の選択肢には出さない（過去の回答の参照先として残す）。
-- custom_answers のキーも拾うのは、申込のあとで fields_json を書き換えていた場合に、
-- 回答の行き先が無くなって落ちるのを防ぐため。同じ文のラベルは1問にまとめる。
-- 壊れた JSON は '[]' / '{}' に読み替える（json_each が例外を投げて移行が止まらないように）。
-- ───────────────────────────────────────────
insert into questions (id, label, hint, fixed, archived, created_at)
  select 'q_legacy_' || row_number() over (order by label), label, null, 0, 1, '2026-11-10T00:00:00.000Z'
    from (
      select trim(j.value) as label
        from entries e,
             json_each(case when json_valid(e.fields_json) and json_type(e.fields_json) = 'array'
                            then e.fields_json else '[]' end) j
       where j.type = 'text' and trim(j.value) <> ''
      union
      select trim(j.key) as label
        from session_applications sa,
             json_each(case when json_valid(sa.custom_answers) and json_type(sa.custom_answers) = 'object'
                            then sa.custom_answers else '{}' end) j
       where trim(j.key) <> ''
    )
   where label not in (select label from questions);

-- ───────────────────────────────────────────
-- 入口ごとの設問。今の画面を変えないように付ける。
--   ・guide と既存のセミナー：「いま、人間関係で気になっていること」（今はどのページにも出ている）
--   ・既存のセミナーで追加項目を持つもの：その後ろに、追加項目を並び順のまま
--   ・direct は自分のページを持たない（/apply/{typeCode} を ?v= なしで開いた申込）ので付けない
-- ───────────────────────────────────────────
insert into entry_questions (entry_id, question_id, position)
  select id, 'q_concern', 1 from entries where id = 'entry_guide' or system = 0;

insert or ignore into entry_questions (entry_id, question_id, position)
  select e.id, q.id, j.key + 2
    from entries e,
         json_each(case when json_valid(e.fields_json) and json_type(e.fields_json) = 'array'
                        then e.fields_json else '[]' end) j
    join questions q on q.label = trim(j.value)
   where e.system = 0 and j.type = 'text' and trim(j.value) <> '';

-- 長さの表記を、帯の文言そのものに置き換える（既定の帯と同じ形で組む）
update entries set eyebrow = '体験セッション（' || trim(session_label) || '・無料）'
 where session_label is not null and trim(session_label) <> '';

-- ───────────────────────────────────────────
-- 既存の回答を写す。**0009 でもう一度流す**ので、どれも insert or ignore にしておく。
-- 空欄の記録は過去には無いので、写すのは値のあるものだけ（記入率が正しいのは 2026-11-10 以降）。
-- 並び順は、旧画面と同じ「気になっていること → 追加項目 → ご質問」。
-- ───────────────────────────────────────────
insert or ignore into question_answers (application_id, question_id, position, label, answer)
  select id, 'q_concern', 1, 'いま、人間関係で気になっていること', concern
    from session_applications
   where concern is not null and trim(concern) <> '';

insert or ignore into question_answers (application_id, question_id, position, label, answer)
  select sa.id, q.id,
         coalesce((select eq.position from entry_questions eq
                    where eq.entry_id = sa.entry_id and eq.question_id = q.id), 90),
         q.label, j.value
    from session_applications sa,
         json_each(case when json_valid(sa.custom_answers) and json_type(sa.custom_answers) = 'object'
                        then sa.custom_answers else '{}' end) j
    join questions q on q.label = trim(j.key)
   where j.value is not null and trim(j.value) <> '';

insert or ignore into question_answers (application_id, question_id, position, label, answer)
  select sa.id, 'q_message',
         (select coalesce(max(qa.position), 0) + 1 from question_answers qa where qa.application_id = sa.id),
         'ご質問・伝えておきたいこと', sa.question
    from session_applications sa
   where sa.question is not null and trim(sa.question) <> '';
