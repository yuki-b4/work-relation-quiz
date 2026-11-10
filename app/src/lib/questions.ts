/**
 * 申込フォームの設問マスタ（migrations/0008）を読み書きする。
 *
 * 要件：アプリ化要件定義.md F1-2（questions / entry_questions / question_answers）・F4-5。
 *
 *   ・入口ごとに選んだ設問を、選んだ順に出す。その後ろに固定の設問（`fixed=1`。ご質問・伝えておきたいこと）
 *   ・**入力はすべて複数行**（2026-11-10 にユーザーが決めた）。入力の形は設問に持たせない
 *   ・回答は、出した設問ぶん必ず1行ずつ残す（空欄は NULL）。設問ごとの記入率を出すため
 *   ・回答には**申込した時点の設問文を写す**。あとで設問文を直しても、過去の回答の意味が変わらない
 *
 * お名前・メールアドレスは設問にしない。連絡先として `session_applications` の列に置く（F1-2）。
 */

/** 申込ページに出す設問。 */
export type FormQuestion = { id: string; label: string; hint: string | null; fixed: number };

/** 回答1件。`question_answers` の1行。 */
export type QuestionAnswer = {
  question_id: string;
  position: number;
  label: string;
  answer: string | null;
};

/** 1つの設問に書ける字数。旧「気になっていること」「ご質問」と同じ。 */
export const ANSWER_MAX = 4000;

/** 入口ごとに選べる設問の数の上限。旧「追加項目」と同じ10個。長いフォームは申込を落とす。 */
export const MAX_SELECTED = 10;

/** ガイド経由の申込ページ（/apply/{typeCode}）が読む入口。migrations/0007 の system 行。 */
export const GUIDE_ENTRY_ID = 'entry_guide';

/** 固定の設問（ご質問・伝えておきたいこと）。古い画面から `question` で送られてきたときの行き先。 */
export const MESSAGE_QUESTION_ID = 'q_message';

/** 人間関係の設問。古い画面から `concern` で送られてきたときの行き先。 */
export const CONCERN_QUESTION_ID = 'q_concern';

/**
 * その入口の申込ページに出す設問を、出す順に返す。選んだ設問（順番どおり）→ 固定の設問。
 * 選んだ設問がアーカイブ済みでも出す（アーカイブは「新しく選ばせない」の意味）。
 */
export async function formQuestions(db: D1Database, entryId: string): Promise<FormQuestion[]> {
  const { results } = await db
    .prepare(
      `select q.id, q.label, q.hint, q.fixed
         from questions q
         left join entry_questions eq on eq.question_id = q.id and eq.entry_id = ?
        where eq.entry_id is not null or q.fixed = 1
        order by q.fixed, eq.position, q.id`
    )
    .bind(entryId)
    .all<FormQuestion>();
  return results ?? [];
}

/**
 * 送られてきた回答を、出した設問に当てはめる。
 *
 * **設問文はクライアントから受け取らず、マスタから引いたものを写す。** 受け付けるのは
 * その入口で出した設問のIDだけなので、知らないIDを混ぜ込まれても入らない。
 * 出した設問は空欄でも1行作る（answer は null）。
 *
 * `legacy` は、キャッシュに残った古い画面（`concern` と `question` を別々に送っていた）からの送信。
 * 新しい画面は `answers` で送るので、`answers` があるときは見ない。
 */
export function answerRows(
  questions: FormQuestion[],
  posted: unknown,
  legacy: { concern?: unknown; question?: unknown } = {}
): QuestionAnswer[] {
  const map: Record<string, unknown> =
    posted && typeof posted === 'object' && !Array.isArray(posted)
      ? (posted as Record<string, unknown>)
      : { [CONCERN_QUESTION_ID]: legacy.concern, [MESSAGE_QUESTION_ID]: legacy.question };
  return questions.map((q, i) => {
    const raw = map[q.id];
    const v = typeof raw === 'string' ? raw.trim().slice(0, ANSWER_MAX) : '';
    return { question_id: q.id, position: i + 1, label: q.label, answer: v || null };
  });
}

/** 申込1件ぶんの回答。並び順は申込者が見た順。 */
export async function loadQuestionAnswers(db: D1Database, applicationId: string): Promise<QuestionAnswer[]> {
  const { results } = await db
    .prepare(
      `select question_id, position, label, answer from question_answers
        where application_id = ? order by position, question_id`
    )
    .bind(applicationId)
    .all<QuestionAnswer>();
  return results ?? [];
}

/**
 * 回答を申込ごとにまとめる。CSV と回答詳細（申込が複数ありうる）で、まとめて引いたものを配るのに使う。
 * 行は並び順どおりに来る前提（呼ぶ側の SQL で order by する）。
 */
export function groupAnswers(rows: (QuestionAnswer & { application_id: string })[]): Map<string, QuestionAnswer[]> {
  const out = new Map<string, QuestionAnswer[]>();
  for (const { application_id, ...a } of rows) {
    const list = out.get(application_id);
    if (list) list.push(a);
    else out.set(application_id, [a]);
  }
  return out;
}

/** 書いてあるものだけを「設問文：回答」で1行ずつ。CSV の「追加項目」の列と通知に使う。 */
export function answersText(rows: QuestionAnswer[]): string {
  return rows.filter((r) => r.answer).map((r) => `${r.label}：${r.answer}`).join('\n');
}

// ───────── Admin の入口編集（F2-8） ─────────

/** 入口の編集画面に並べる設問。選ばれていれば `position` が入る。 */
export type QuestionChoice = {
  id: string;
  label: string;
  hint: string | null;
  archived: number;
  position: number | null;
};

/**
 * 入口の編集画面の選択肢。固定の設問は選ばせないので出さない。
 * アーカイブ済みは、その入口で選ばれているものだけ出す（外せるように）。
 * 並びは選ばれている順 → 選ばれていないものを作った順。
 */
export async function questionChoices(db: D1Database, entryId: string): Promise<QuestionChoice[]> {
  const { results } = await db
    .prepare(
      `select q.id, q.label, q.hint, q.archived, eq.position
         from questions q
         left join entry_questions eq on eq.question_id = q.id and eq.entry_id = ?
        where q.fixed = 0 and (q.archived = 0 or eq.entry_id is not null)
        order by eq.position is null, eq.position, q.created_at, q.id`
    )
    .bind(entryId)
    .all<QuestionChoice>();
  return results ?? [];
}

/**
 * 入口の編集フォームから、選ばれた設問の並びを作る。通れば ID の並び、駄目なら利用者に見せる文言。
 *
 *   ・選べるのは `choices`（その入口の選択肢）にあるものだけ。固定の設問や知らないIDは弾く
 *   ・順番は数字の小さい順。空欄や同じ数字は、画面に並んでいる順で決める
 */
export function selectedQuestionIds(
  choices: QuestionChoice[],
  checked: string[],
  orderOf: (id: string) => string
): { ok: true; ids: string[] } | { ok: false; message: string } {
  const known = new Map(choices.map((c, i) => [c.id, i]));
  const unique = [...new Set(checked)];
  if (unique.some((id) => !known.has(id))) {
    return { ok: false, message: '選べない設問が含まれています。画面を開き直してから選び直してください。' };
  }
  if (unique.length > MAX_SELECTED) {
    return { ok: false, message: `任意の設問は${MAX_SELECTED}個までにしてください。` };
  }
  const order = (id: string) => {
    const n = Number(orderOf(id).trim());
    return orderOf(id).trim() !== '' && Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  };
  const ids = unique.sort((a, b) => order(a) - order(b) || known.get(a)! - known.get(b)!);
  return { ok: true, ids };
}
