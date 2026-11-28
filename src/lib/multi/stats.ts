/** Desempenho da Prova Multi para o professor: a prova inteira ou só a disciplina dele. */
import { gradeSubmission, type AnswerKeyItem } from "@/lib/grading/grading";
import type { AnnulPolicy, QuestionType } from "@/lib/models/types";

export interface SlotQuestion {
  position: number;
  type: QuestionType;
  correct_answers: string[];
  weight: number;
  annulled: boolean;
  section?: string | null;
  /** Questão da disciplina deste professor (ausente nos dados antigos = sim). */
  mine?: boolean;
}
export interface SlotStudent {
  id: string;
  name: string;
  roll: number | null;
  answers: Record<string, string | null> | null;
  manual: Record<string, number> | null;
  done: boolean;
}
export interface SlotClass {
  assessment_id: string;
  class_name: string | null;
  annul_policy: AnnulPolicy;
  max_score?: number | null;
  questions: SlotQuestion[];
  students: SlotStudent[];
}

export type Scope = "mine" | "all";

export interface StudentResult {
  id: string;
  name: string;
  roll: number | null;
  score: number | null;
  hits: number;
}
export interface QuestionStat {
  /** nº na prova */
  number: number;
  section: string | null;
  mine: boolean;
  answered: number;
  correct: number;
  rate: number | null; // 0–1
}
export interface ClassResult {
  id: string;
  name: string;
  total: number; // questões contadas
  rows: StudentResult[];
  graded: number;
  average: number | null;
  questions: QuestionStat[];
}

const isMine = (q: SlotQuestion) => q.mine !== false;

export function classResults(data: SlotClass[], scope: Scope, maxScore: number): ClassResult[] {
  return data.map((c) => {
    const qs = c.questions.filter((q) => (scope === "all" ? true : isMine(q)));
    const key: AnswerKeyItem[] = qs.map((q) => ({ number: q.position, type: q.type, accepted: q.correct_answers, weight: Number(q.weight), annulled: q.annulled }));
    const stats = new Map<number, { answered: number; correct: number }>(qs.map((q) => [q.position, { answered: 0, correct: 0 }]));
    const rows: StudentResult[] = c.students.map((s) => {
      if (!s.done || !key.length) return { id: s.id, name: s.name, roll: s.roll, score: null, hits: 0 };
      const answers: Record<number, string | null> = {};
      for (const [k, v] of Object.entries(s.answers ?? {})) answers[Number(k)] = v;
      const manual: Record<number, number> = {};
      for (const [k, v] of Object.entries(s.manual ?? {})) manual[Number(k)] = Number(v);
      const g = gradeSubmission(key, answers, { maxScore, annulPolicy: c.annul_policy, manualPoints: manual });
      for (const r of g.questions) {
        const st = stats.get(r.number);
        if (!st) continue;
        st.answered++;
        if (r.status === "correct") st.correct++;
      }
      return { id: s.id, name: s.name, roll: s.roll, score: g.score, hits: g.correctCount };
    });
    const scores = rows.map((r) => r.score).filter((x): x is number => x !== null);
    return {
      id: c.assessment_id,
      name: c.class_name ?? "Turma",
      total: key.length,
      rows,
      graded: scores.length,
      average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null,
      questions: qs.map((q) => {
        const st = stats.get(q.position)!;
        return { number: q.position, section: q.section ?? null, mine: isMine(q), answered: st.answered, correct: st.correct, rate: st.answered ? st.correct / st.answered : null };
      }),
    };
  });
}

/** Faixas de nota (em % da nota máxima). */
export const BANDS = [
  { label: "Abaixo de 50%", min: 0, max: 0.5 },
  { label: "50% a 69%", min: 0.5, max: 0.7 },
  { label: "70% a 89%", min: 0.7, max: 0.9 },
  { label: "90% ou mais", min: 0.9, max: 1.01 },
];

export function distribution(results: ClassResult[], maxScore: number): number[] {
  const out = BANDS.map(() => 0);
  for (const c of results)
    for (const r of c.rows) {
      if (r.score === null) continue;
      const p = maxScore ? r.score / maxScore : 0;
      const i = BANDS.findIndex((b) => p >= b.min && p < b.max);
      out[i < 0 ? BANDS.length - 1 : i]++;
    }
  return out;
}

/** Acerto de cada questão somando todas as turmas. */
export function questionRates(results: ClassResult[]): QuestionStat[] {
  const map = new Map<number, QuestionStat>();
  for (const c of results)
    for (const q of c.questions) {
      const cur = map.get(q.number) ?? { ...q, answered: 0, correct: 0, rate: null };
      cur.answered += q.answered;
      cur.correct += q.correct;
      cur.rate = cur.answered ? cur.correct / cur.answered : null;
      map.set(q.number, cur);
    }
  return [...map.values()].sort((a, b) => a.number - b.number);
}
