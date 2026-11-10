-- 旧列を消す（申込フォームの設問マスタの2回目）。
-- 要件：アプリ化要件定義.md F1-2（questions ほか）。1回目は 0008_questions.sql。
--
-- **0008 を当て、新しいコードを本番に出して、新しい申込が question_answers に入るのを確かめてから流す。**
-- 2026-11-10 に本番の sem-1111 で、申込詳細に設問の回答が並ぶのを確かめた。
--
-- ───────── 先に写し直す ─────────
-- 0008 を当ててから新しいコードを出すまでの間に、古いコードが旧列（concern / question / custom_answers）
-- に書いた申込があるかもしれない。列を消す前に、0008 と同じ写しをもう一度流して拾う。
-- どれも insert or ignore なので、0008 で写したものは増えない。
-- 旧形式の追加項目の設問も、その間に増えたラベルがあれば足す（ID の頭は 0008 と被らないよう q_legacy9_）。
--
-- ───────── 列の消し方 ─────────
-- **表を作り直さず、ALTER TABLE ... DROP COLUMN で消す。** question_answers が session_applications を
-- on delete cascade で参照しているので、0007 のように DROP して作り直すと回答が連鎖で消える。
-- DROP COLUMN は表の中身をその場で書き換えるだけで、行を消さない（ON DELETE も撃たない）。
-- 消す列はどれも索引・制約・外部キーに使っていない（使っていると DROP COLUMN は失敗する）。

-- ───────────────────────────────────────────
-- 写し直し（0008 の後半と同じ）
-- ───────────────────────────────────────────
insert or ignore into questions (id, label, hint, fixed, archived, created_at)
  select 'q_legacy9_' || row_number() over (order by label), label, null, 0, 1, '2026-11-10T00:00:00.000Z'
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

-- ───────────────────────────────────────────
-- 旧列を消す
-- ───────────────────────────────────────────
alter table session_applications drop column concern;
alter table session_applications drop column question;
alter table session_applications drop column custom_answers;
alter table entries drop column session_label;
alter table entries drop column fields_json;
