/** PROVA MULTI — monta as questões da prova final a partir das partes de cada professor. */
import type { QuestionOption, QuestionType } from "@/lib/models/types";

export interface MultiSlot {
  id: string;
  position: number;
  teacher_name: string;
  discipline: string;
  question_count: number;
}

export interface MultiQuestion {
  id?: string;
  slot_id: string;
  position: number;
  type?: QuestionType | null;
  statement: string;
  options: QuestionOption[] | null;
  correct_answers?: string[] | null;
  /** antigo (0011): só a letra correta */
  correct?: string | null;
  weight?: number | null;
  annulled?: boolean | null;
  image_path?: string | null;
}

export interface BuiltQuestion {
  position: number;
  type: QuestionType;
  statement: string;
  options: QuestionOption[];
  correct_answers: string[];
  weight: number;
  annulled: boolean;
  image_path: string | null;
  section: string;
  multi_slot_id: string;
}

export const sectionName = (s: Pick<MultiSlot, "discipline">) => s.discipline.trim();

export const answersOf = (q: MultiQuestion): string[] => (q.correct_answers?.length ? q.correct_answers : q.correct ? [q.correct] : []);

/** O que falta numa questão (vazio = pronta). */
export function missingOf(q: MultiQuestion | undefined): string[] {
  if (!q) return ["enunciado"];
  const type = q.type ?? "multiple_choice";
  const miss: string[] = [];
  if (!q.statement.trim() && !q.image_path) miss.push("enunciado");
  const answers = answersOf(q);
  if (type === "multiple_choice") {
    const filled = (q.options ?? []).filter((o) => o.text?.trim());
    if (filled.length < 2) miss.push("alternativas");
    if (!answers.some((a) => filled.some((o) => o.label === a))) miss.push("gabarito");
  } else if (type === "true_false" || type === "numeric" || type === "short_answer") {
    if (!answers.length) miss.push("gabarito");
  }
  return miss;
}

/** Progresso de um professor: questões prontas × questões pedidas. */
export function slotProgress(slot: MultiSlot, questions: MultiQuestion[]) {
  const own = questions.filter((q) => q.slot_id === slot.id);
  const ready = own.filter((q) => missingOf(q).length === 0).length;
  return { ready, made: own.length, total: Math.max(slot.question_count, own.length), asked: slot.question_count };
}

/**
 * Questões da prova final: seções na ordem dos professores, questões na ordem de cada um.
 * Devolve os problemas (questões incompletas) em vez de montar pela metade.
 */
export function buildMultiQuestions(slots: MultiSlot[], questions: MultiQuestion[]): { rows: BuiltQuestion[]; problems: string[]; short: string[] } {
  const rows: BuiltQuestion[] = [];
  const problems: string[] = [];
  const short: string[] = [];
  for (const slot of [...slots].sort((a, b) => a.position - b.position)) {
    const own = questions.filter((q) => q.slot_id === slot.id).sort((a, b) => a.position - b.position);
    if (own.length < slot.question_count) short.push(`${sectionName(slot)} (${slot.teacher_name}): ${own.length} de ${slot.question_count}`);
    own.forEach((q, i) => {
      const miss = missingOf(q);
      if (miss.length) {
        problems.push(`${sectionName(slot)} (${slot.teacher_name}) — questão ${i + 1}: falta ${miss.join(", ")}`);
        return;
      }
      const type = q.type ?? "multiple_choice";
      rows.push({
        position: rows.length + 1,
        type,
        statement: q.statement.trim(),
        options: type === "multiple_choice" ? (q.options ?? []).filter((o) => o.text?.trim()) : [],
        correct_answers: type === "essay" || type === "lined" ? [] : answersOf(q),
        weight: Number(q.weight ?? 1) || 1,
        annulled: !!q.annulled,
        image_path: q.image_path ?? null,
        section: sectionName(slot),
        multi_slot_id: slot.id,
      });
    });
  }
  return { rows, problems, short };
}
