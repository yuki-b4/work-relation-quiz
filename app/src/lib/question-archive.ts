/**
 * 設問セットの版と、設問文の引き当て。
 *
 * 要件：アプリ化要件定義.md F2-3 ブロック3「**設問文は回答時のバージョンのものを表示する**」。
 *
 * `response_answers` に入っているのは識別子（`bin-3`・`lik-11`）と軸と値だけで、設問文は
 * 持っていない。設問を改訂すると、過去の回答に**いまの設問文**が付いてしまい、記録の意味が
 * 変わってしまう。そこで、版ごとの設問文をここで引く。
 *
 * 版の増やし方（設問を改訂するときの手順。app/README.md にも書く）：
 *   1. いまの `QUESTION_SET_VERSION`（例 '2026-09'）を ARCHIVE に追加する。
 *      **文面を書き写さない。** その時点の `src/content/quiz.ts` をコピーして
 *      `src/content/quiz-<版>.ts` として凍結し、ここから import する
 *   2. `prototype.html` の設問を直して `npm run content` を実行する
 *   3. `wrangler.toml` の `QUESTION_SET_VERSION` を上げる
 *
 * 版が分からない回答（移行データや、上の手順を踏み損ねた版）は、設問文を出さずに
 * 識別子と軸だけを出す。**それらしい設問文を当てはめない**ことを優先する。
 */
import { AX, LIKERT, QUESTIONS, RADAR_META, RADAR_Q } from '../content/quiz.ts';
import type { AnswerRow } from './admin-queries.ts';

export type BinaryQuestion = {
  readonly axis: string;
  readonly text: string;
  readonly a: { readonly t: string; readonly p: string };
  readonly b: { readonly t: string; readonly p: string };
};

export type QuestionSet = {
  readonly binary: readonly BinaryQuestion[];
  readonly likert: readonly { readonly axis: string; readonly text: string }[];
  readonly likertChoices: readonly { readonly t: string; readonly v: number }[];
};

/** いまの設問セット（生成物の `src/content/quiz.ts`）。 */
export const CURRENT_SET: QuestionSet = {
  binary: QUESTIONS,
  likert: RADAR_Q,
  likertChoices: LIKERT,
};

/**
 * 過去の版。
 *
 * `legacy`（スプレッドシートからの移行データ。7.3）は**登録しない**。
 * 移行元に残っているのは9問の選択結果（O/G など）だけで、そのとき画面に出ていた設問文が
 * 保存されていないため。現行の設問文を当てても、それが同じである保証がない。
 */
const ARCHIVE: Record<string, QuestionSet> = {};

export function questionSetOf(version: string, currentVersion: string): QuestionSet | null {
  if (version && version === currentVersion) return CURRENT_SET;
  return ARCHIVE[version] ?? null;
}

export type QuestionView = {
  orderNo: number;
  key: string;
  kind: string;
  axis: string;
  axisLabel: string;
  value: string;
  /** 設問文。版が分からなければ null。 */
  text: string | null;
  /** 選んだ選択肢の文。二択は選択肢の文、リッカートは「ややそう思う（3）」。 */
  answerText: string | null;
};

const AXIS_NAME: Record<string, string> = {
  h: '本音（3軸）', c: '衝突（3軸）', w: '重心（3軸）',
};

function axisLabelOf(axis: string): string {
  if (AXIS_NAME[axis]) return AXIS_NAME[axis]!;
  const m = (RADAR_META as Record<string, { name: string }>)[axis];
  return m ? `${m.name}（5軸）` : axis;
}

/**
 * 保存されている回答行を、画面に出せる形にする。
 * 設問文が引けなくても必ず1行返す（欠測も「何番の設問が空だったか」が見えるように）。
 */
export function viewAnswers(rows: readonly AnswerRow[], set: QuestionSet | null): QuestionView[] {
  return rows.map((row) => {
    const base: QuestionView = {
      orderNo: row.order_no,
      key: row.question_key,
      kind: row.kind,
      axis: row.axis,
      axisLabel: axisLabelOf(row.axis),
      value: row.value,
      text: null,
      answerText: null,
    };
    if (!set) return base;

    const m = /^(bin|lik)-(\d+)$/.exec(row.question_key);
    if (!m) return base;
    const idx = Number(m[2]) - 1;

    if (m[1] === 'bin') {
      const q = set.binary[idx];
      if (!q) return base;
      const picked = q.a.p === row.value ? q.a : q.b.p === row.value ? q.b : null;
      return { ...base, text: q.text, answerText: picked ? picked.t : null };
    }

    const q = set.likert[idx];
    if (!q) return base;
    const choice = set.likertChoices.find((c) => String(c.v) === String(row.value));
    return { ...base, text: q.text, answerText: choice ? `${choice.t}（${row.value}）` : null };
  });
}

/** 二択の極（O/G など）が、どちらの言葉なのかを出す。CSVの列名に使う。 */
export function poleLabel(axis: string, pole: string): string {
  const meta = (AX as Record<string, { left: string; right: string; poles: readonly string[] }>)[axis];
  if (!meta) return pole;
  return pole === meta.poles[0] ? meta.left : meta.right;
}
