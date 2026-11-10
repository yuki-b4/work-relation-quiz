/**
 * 申込フォームで書いてもらった内容（設問への回答。migrations/0008）を、Admin の dl に並べる。
 * 申込の詳細と回答の詳細（紐づく申込）の両方で使う。
 *
 * 設問文は**申込した時点の写し**（question_answers.label）を出す。あとで設問文を直しても、
 * 何を聞かれて答えたものかが変わらない。設問文も回答もデータから来るので、必ずエスケープする。
 * 出した設問は空欄でも1行残っているので、空欄は「—」で出す（何を聞いたかが分かる）。
 */
import { esc } from '../result.ts';
import type { QuestionAnswer } from '../../lib/questions.ts';

export function answerItems(answers: QuestionAnswer[]): string {
  // 2026-11-10 より前の申込で何も書かれていなかったものは、行が無い（空欄の記録を取っていなかった）
  if (!answers.length) return '<dt>任意の設問</dt><dd><span class="faint">記入なし</span></dd>';
  return answers
    .map((a) =>
      `<dt>${esc(a.label)}</dt>` +
      `<dd class="wrap-cell">${a.answer ? esc(a.answer) : '<span class="faint">—</span>'}</dd>`
    )
    .join('');
}
