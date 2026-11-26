/**
 * RESULTADOS — estatísticas da turma e análise por questão.
 */
import { numericValue, MULTIPLE_MARKS, UNCERTAIN, type AnswerKeyItem, type GivenAnswer } from "./grading";

export interface ScoreSummary {
  count: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function summarizeScores(scores: number[]): ScoreSummary {
  const v = scores.filter((s) => Number.isFinite(s)).sort((a, b) => a - b);
  if (v.length === 0) return { count: 0, mean: null, median: null, min: null, max: null };
  const sum = v.reduce((a, b) => a + b, 0);
  const mid = Math.floor(v.length / 2);
  const median = v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  return { count: v.length, mean: r2(sum / v.length), median: r2(median), min: v[0], max: v[v.length - 1] };
}

/** Distribuição das notas em faixas (ex.: 0–1, 1–2, ..., 9–10). A nota máxima entra na última faixa. */
export function scoreDistribution(scores: number[], maxScore = 10, buckets = 10) {
  const size = maxScore / buckets;
  const counts = new Array(buckets).fill(0) as number[];
  for (const s of scores) {
    if (!Number.isFinite(s)) continue;
    const i = Math.min(buckets - 1, Math.max(0, Math.floor(s / size)));
    counts[i]++;
  }
  return counts.map((count, i) => ({ from: r2(i * size), to: r2((i + 1) * size), count }));
}

export interface QuestionAnalysis {
  number: number;
  annulled: boolean;
  total: number;
  /** Percentual de cada alternativa + "Em branco" + "Dupla marcação". */
  distribution: { option: string; count: number; percent: number; correct: boolean }[];
  hitRate: number | null; // 0–100
}

export function analyzeQuestions(
  key: AnswerKeyItem[],
  submissions: Record<number, GivenAnswer>[],
  optionLabels: Record<number, string[]>,
): QuestionAnalysis[] {
  return [...key]
    .sort((a, b) => a.number - b.number)
    .map((item) => {
      const labels = optionLabels[item.number] ?? [];
      // Tipo B: "042" e "42" são a mesma resposta
      const norm = (v: string) => {
        if (item.type !== "numeric") return v.toUpperCase();
        const n = numericValue(v);
        return n === null ? v : String(n);
      };
      const counts = new Map<string, number>(labels.map((l) => [l, 0]));
      let blank = 0;
      let multiple = 0;
      let considered = 0;
      let hits = 0;
      for (const answers of submissions) {
        const g = answers[item.number];
        if (g === UNCERTAIN) continue; // leitura pendente não entra na estatística
        considered++;
        if (g === null || g === undefined || g === "") blank++;
        else if (g === MULTIPLE_MARKS) multiple++;
        else counts.set(norm(g), (counts.get(norm(g)) ?? 0) + 1);
        if (g && g !== MULTIPLE_MARKS && item.accepted.some((a) => norm(a) === norm(g))) hits++;
      }
      const pct = (n: number) => (considered ? r2((n / considered) * 100) : 0);
      const accepted = new Set(item.accepted.map(norm));
      const distribution = [...counts.entries()].map(([option, count]) => ({
        option,
        count,
        percent: pct(count),
        correct: accepted.has(option),
      }));
      if (blank) distribution.push({ option: "Em branco", count: blank, percent: pct(blank), correct: false });
      if (multiple) distribution.push({ option: "Dupla marcação", count: multiple, percent: pct(multiple), correct: false });
      return {
        number: item.number,
        annulled: item.annulled,
        total: considered,
        distribution,
        hitRate: considered ? pct(hits) : null,
      };
    });
}

/** Questões ordenadas da mais difícil (menor acerto) para a mais fácil. Ignora anuladas. */
export function rankByDifficulty(analysis: QuestionAnalysis[]) {
  return analysis
    .filter((q) => !q.annulled && q.hitRate !== null)
    .sort((a, b) => (a.hitRate! - b.hitRate!) || a.number - b.number);
}
