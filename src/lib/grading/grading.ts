/**
 * CORREÇÃO — cálculo de nota a partir do gabarito oficial.
 *
 * Usado por todos os modos de aplicação (câmera, lote, digital, manual,
 * gamificada): uma única regra de nota para o sistema inteiro.
 *
 * Convenção para a resposta lida de uma questão:
 *   "A" | "B" | ... | "C"/"E" (certo/errado) | texto  → resposta marcada
 *   null / undefined                      → em branco
 *   "*"                                   → mais de uma marcação (dupla marcação)
 *   "?"                                   → leitura incerta (exige revisão do professor)
 *   "042" (Tipo B)                        → centena, dezena e unidade marcadas; "_" = coluna sem marcação
 */
import type { AnnulPolicy, QuestionType } from "@/lib/models/types";

export const MULTIPLE_MARKS = "*";
export const UNCERTAIN = "?";

export type GivenAnswer = string | null | undefined;

export interface AnswerKeyItem {
  number: number;
  type: QuestionType;
  /** Respostas aceitas. Mais de uma = "aceitar mais de uma resposta". */
  accepted: string[];
  weight: number;
  annulled: boolean;
}

export type QuestionStatus =
  | "correct"
  | "wrong"
  | "blank"
  | "multiple"
  | "uncertain"
  | "annulled"
  | "manual"
  | "pending_manual";

export interface QuestionResult {
  number: number;
  given: GivenAnswer;
  status: QuestionStatus;
  points: number;
  maxPoints: number; // 0 quando anulada com política "remove"
}

export interface GradeOptions {
  maxScore?: number; // padrão 10
  annulPolicy?: AnnulPolicy; // padrão credit_all
  /** Pontos atribuídos manualmente (discursivas / resposta curta). */
  manualPoints?: Record<number, number>;
}

export interface GradeResult {
  score: number; // já na escala de maxScore, 2 casas
  maxScore: number;
  earnedPoints: number;
  possiblePoints: number;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  questions: QuestionResult[];
  /** true = não registrar automaticamente; o professor precisa revisar. */
  needsReview: boolean;
  reviewReasons: string[];
}

/** Normaliza texto para comparar respostas curtas: sem acento, caixa ou espaços extras. */
export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function isObjective(type: QuestionType): boolean {
  return type === "multiple_choice" || type === "true_false";
}

/** Tipo B: "042" = 42. Coluna em branco ("_") ou valor inválido = resposta errada. */
export function numericValue(s: string): number | null {
  const t = s.trim();
  return /^\d{1,3}$/.test(t) ? Number(t) : null;
}

function isManual(type: QuestionType) {
  return type === "essay" || type === "lined";
}

export function gradeSubmission(
  key: AnswerKeyItem[],
  answers: Record<number, GivenAnswer>,
  options: GradeOptions = {},
): GradeResult {
  const maxScore = options.maxScore ?? 10;
  const policy = options.annulPolicy ?? "credit_all";
  const manual = options.manualPoints ?? {};

  const questions: QuestionResult[] = [];
  const reviewReasons: string[] = [];
  let earned = 0;
  let possible = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let blankCount = 0;

  const sorted = [...key].sort((a, b) => a.number - b.number);

  for (const item of sorted) {
    const weight = Math.max(0, item.weight);
    const given = answers[item.number];

    if (item.annulled) {
      const counts = policy === "credit_all";
      const pts = counts ? weight : 0;
      questions.push({ number: item.number, given, status: "annulled", points: pts, maxPoints: counts ? weight : 0 });
      earned += pts;
      possible += counts ? weight : 0;
      continue;
    }

    possible += weight;

    // Pontuação manual tem prioridade (o professor decidiu).
    if (manual[item.number] !== undefined) {
      const pts = Math.min(weight, Math.max(0, manual[item.number]));
      questions.push({ number: item.number, given, status: "manual", points: pts, maxPoints: weight });
      earned += pts;
      if (pts >= weight && weight > 0) correctCount++;
      continue;
    }

    if (given === UNCERTAIN) {
      questions.push({ number: item.number, given, status: "uncertain", points: 0, maxPoints: weight });
      reviewReasons.push(`Não foi possível identificar com segurança a questão ${item.number}.`);
      continue;
    }

    if (given === null || given === undefined || given === "") {
      // Discursiva sem nota lançada ainda não é "em branco": aguarda o professor.
      if (isManual(item.type)) {
        questions.push({ number: item.number, given, status: "pending_manual", points: 0, maxPoints: weight });
        continue;
      }
      questions.push({ number: item.number, given: null, status: "blank", points: 0, maxPoints: weight });
      blankCount++;
      continue;
    }

    if (given === MULTIPLE_MARKS) {
      questions.push({ number: item.number, given, status: "multiple", points: 0, maxPoints: weight });
      wrongCount++;
      continue;
    }

    if (isManual(item.type) || (item.type === "short_answer" && item.accepted.length === 0)) {
      questions.push({ number: item.number, given, status: "pending_manual", points: 0, maxPoints: weight });
      continue;
    }

    const ok =
      item.type === "numeric"
        ? numericValue(given) !== null && item.accepted.some((a) => numericValue(a) === numericValue(given))
        : isObjective(item.type)
          ? item.accepted.some((a) => a.toUpperCase() === given.toUpperCase())
          : item.accepted.some((a) => normalizeAnswer(a) === normalizeAnswer(given));

    if (ok) {
      questions.push({ number: item.number, given, status: "correct", points: weight, maxPoints: weight });
      earned += weight;
      correctCount++;
    } else {
      questions.push({ number: item.number, given, status: "wrong", points: 0, maxPoints: weight });
      wrongCount++;
    }
  }

  const score = possible > 0 ? round2((earned / possible) * maxScore) : 0;

  return {
    score,
    maxScore,
    earnedPoints: round2(earned),
    possiblePoints: round2(possible),
    correctCount,
    wrongCount,
    blankCount,
    questions,
    needsReview: reviewReasons.length > 0,
    reviewReasons,
  };
}

/** Recalcula as notas de todas as entregas (ex.: após anular questão ou mudar gabarito). */
export function regradeAll<T extends { answers: Record<number, GivenAnswer>; manualPoints?: Record<number, number> }>(
  key: AnswerKeyItem[],
  submissions: T[],
  options: Omit<GradeOptions, "manualPoints"> = {},
): Array<T & { result: GradeResult }> {
  return submissions.map((s) => ({
    ...s,
    result: gradeSubmission(key, s.answers, { ...options, manualPoints: s.manualPoints }),
  }));
}

export interface KeyChange {
  number: number;
  field: "accepted" | "weight" | "annulled";
  from: unknown;
  to: unknown;
}

/** Lista o que mudou entre duas versões do gabarito (vai para o registro de alterações). */
export function diffAnswerKey(before: AnswerKeyItem[], after: AnswerKeyItem[]): KeyChange[] {
  const changes: KeyChange[] = [];
  const prev = new Map(before.map((k) => [k.number, k]));
  for (const k of after) {
    const p = prev.get(k.number);
    if (!p) continue;
    const a = [...p.accepted].sort().join(",");
    const b = [...k.accepted].sort().join(",");
    if (a !== b) changes.push({ number: k.number, field: "accepted", from: p.accepted, to: k.accepted });
    if (p.weight !== k.weight) changes.push({ number: k.number, field: "weight", from: p.weight, to: k.weight });
    if (p.annulled !== k.annulled) changes.push({ number: k.number, field: "annulled", from: p.annulled, to: k.annulled });
  }
  return changes;
}

/** Formato brasileiro: 7,5 / 10,0 */
export function formatScore(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
