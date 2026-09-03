/**
 * 診断の採点。
 *
 * 要件：アプリ化要件定義.md F3-1（判定ロジックは現行踏襲）／F3-2（サーバ側で再計算し、
 * クライアントの申告値を信用しない）。
 *
 * 元の実装は prototype.html の tally() / radarScores() / finish()。
 * 一致は tools/parity-check.mjs で検証している（9問の二択は512通りを総当たり）。
 */
import { AX, QUESTIONS, RADAR_AXES, RADAR_Q } from '../content/quiz.ts';
import { TYPES, type TypeCode } from '../content/types.ts';

/** 1問ぶんの回答。二択は極の文字（O/G/B/K/L/S）、リッカートは 1〜4。 */
export type Answer = string | number;

export type AxisKey = keyof typeof AX;
export type RadarKey = (typeof RADAR_AXES)[number];

export type Tally = { L: number; R: number; total: number };
export type RadarScores = Record<RadarKey, number>;

export type Score = {
  typeCode: TypeCode;
  typeName: string;
  axisH: string;
  axisC: string;
  axisW: string;
  axisCounts: Record<AxisKey, Tally>;
  radar: RadarScores;
};

/** 全24問。9問（二択）＋15問（リッカート）。 */
export const ANSWER_COUNT = QUESTIONS.length + RADAR_Q.length;

/**
 * 受け取った回答が形として正しいかを見る。
 * 要件 F1-3：設問数・値域・整合をサーバ側で検証する。
 */
export function validateAnswers(answers: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(answers)) return { ok: false, errors: ['answers が配列ではありません'] };
  if (answers.length !== ANSWER_COUNT) {
    errors.push(`回答数が ${ANSWER_COUNT} ではありません（${answers.length}）`);
    return { ok: false, errors };
  }
  QUESTIONS.forEach((q, i) => {
    const poles = AX[q.axis as AxisKey].poles as readonly string[];
    const v = answers[i];
    if (typeof v !== 'string' || !poles.includes(v)) {
      errors.push(`Q${i + 1}: 極が不正です（期待 ${poles.join('|')}、実際 ${JSON.stringify(v)}）`);
    }
  });
  RADAR_Q.forEach((_q, i) => {
    const v = answers[QUESTIONS.length + i];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 4) {
      errors.push(`Q${QUESTIONS.length + i + 1}: 1〜4 の整数ではありません（${JSON.stringify(v)}）`);
    }
  });
  return { ok: errors.length === 0, errors };
}

/** 1つの軸について、左右どちらの極が何回選ばれたかを数える。 */
export function tally(answers: readonly Answer[], axis: AxisKey): Tally {
  const [L, R] = AX[axis].poles;
  let l = 0;
  let r = 0;
  QUESTIONS.forEach((q, i) => {
    if (q.axis !== axis) return;
    if (answers[i] === L) l++;
    else if (answers[i] === R) r++;
  });
  return { L: l, R: r, total: l + r };
}

/** 5軸のスコア。各軸3問の平均を 0〜1 に正規化する（(平均-1)/3）。 */
export function radarScores(answers: readonly Answer[]): RadarScores {
  const sum = {} as Record<RadarKey, number>;
  const cnt = {} as Record<RadarKey, number>;
  RADAR_AXES.forEach((a) => {
    sum[a] = 0;
    cnt[a] = 0;
  });
  RADAR_Q.forEach((q, i) => {
    const v = answers[QUESTIONS.length + i];
    if (typeof v === 'number') {
      sum[q.axis as RadarKey] += v;
      cnt[q.axis as RadarKey]++;
    }
  });
  const out = {} as RadarScores;
  RADAR_AXES.forEach((a) => {
    out[a] = cnt[a] ? (sum[a] / cnt[a] - 1) / 3 : 0;
  });
  return out;
}

/**
 * タイプコードを決める。各軸3問の多数決（左の極が2つ以上なら左）。
 * 3問なので同数にはならず、必ずどちらかに決まる。
 */
export function typeCodeOf(answers: readonly Answer[]): TypeCode {
  const h = tally(answers, 'h');
  const c = tally(answers, 'c');
  const w = tally(answers, 'w');
  return ((h.L >= 2 ? 'O' : 'G') + (c.L >= 2 ? 'B' : 'K') + (w.L >= 2 ? 'L' : 'S')) as TypeCode;
}

/** 採点の入口。検証を通った回答を渡すこと。 */
export function score(answers: readonly Answer[]): Score {
  const axisCounts = {
    h: tally(answers, 'h'),
    c: tally(answers, 'c'),
    w: tally(answers, 'w'),
  };
  const typeCode = typeCodeOf(answers);
  return {
    typeCode,
    typeName: TYPES[typeCode].name,
    axisH: typeCode[0]!,
    axisC: typeCode[1]!,
    axisW: typeCode[2]!,
    axisCounts,
    radar: radarScores(answers),
  };
}

/**
 * 保存用に丸める。小数3桁（アプリ化要件定義.md F1-2）。
 * 旧スプレッドシートは2桁だったので、移行データより精度が上がる。
 */
export function roundRadar(radar: RadarScores): RadarScores {
  const out = {} as RadarScores;
  RADAR_AXES.forEach((a) => {
    out[a] = Math.round(radar[a] * 1000) / 1000;
  });
  return out;
}
