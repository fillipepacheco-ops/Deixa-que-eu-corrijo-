/** PROVA MULTI — monta as questões da prova final a partir das partes de cada professor. */

export const OPTION_LETTERS = ["A", "B", "C", "D", "E"] as const;

export interface MultiSlot {
  id: string;
  position: number;
  teacher_name: string;
  discipline: string;
  question_count: number;
}

export interface MultiQuestion {
  slot_id: string;
  position: number;
  statement: string;
  options: { label: string; text: string }[] | null;
  correct: string | null;
}

export interface BuiltQuestion {
  position: number;
  type: "multiple_choice";
  statement: string;
  options: { label: string; text: string }[];
  correct_answers: string[];
  weight: number;
  annulled: boolean;
  section: string;
}

export const sectionName = (s: Pick<MultiSlot, "discipline">) => s.discipline.trim();

/** O que falta numa questão (vazio = pronta). */
export function missingOf(q: MultiQuestion | undefined, optionCount: number): string[] {
  if (!q || !q.statement.trim()) return ["enunciado"];
  const miss: string[] = [];
  const opts = q.options ?? [];
  const empty = OPTION_LETTERS.slice(0, optionCount).filter((l) => !opts.find((o) => o.label === l)?.text?.trim());
  if (empty.length) miss.push(`alternativa${empty.length > 1 ? "s" : ""} ${empty.join(", ")}`);
  if (!q.correct || !OPTION_LETTERS.slice(0, optionCount).includes(q.correct as (typeof OPTION_LETTERS)[number])) miss.push("gabarito");
  return miss;
}

/** Progresso de um professor: quantas questões estão prontas. */
export function slotProgress(slot: MultiSlot, questions: MultiQuestion[], optionCount: number) {
  const own = questions.filter((q) => q.slot_id === slot.id);
  let ready = 0;
  for (let p = 1; p <= slot.question_count; p++) if (missingOf(own.find((q) => q.position === p), optionCount).length === 0) ready++;
  return { ready, total: slot.question_count };
}

/**
 * Questões da prova final: seções na ordem dos professores, questões na ordem de cada um.
 * Devolve os problemas encontrados (questões incompletas) em vez de montar pela metade.
 */
export function buildMultiQuestions(
  slots: MultiSlot[],
  questions: MultiQuestion[],
  optionCount: number,
): { rows: BuiltQuestion[]; problems: string[] } {
  const rows: BuiltQuestion[] = [];
  const problems: string[] = [];
  const ordered = [...slots].sort((a, b) => a.position - b.position);
  for (const slot of ordered) {
    const own = questions.filter((q) => q.slot_id === slot.id);
    for (let p = 1; p <= slot.question_count; p++) {
      const q = own.find((x) => x.position === p);
      const miss = missingOf(q, optionCount);
      if (miss.length) {
        problems.push(`${sectionName(slot)} (${slot.teacher_name}) — questão ${p}: falta ${miss.join(", ")}`);
        continue;
      }
      rows.push({
        position: rows.length + 1,
        type: "multiple_choice",
        statement: q!.statement.trim(),
        options: OPTION_LETTERS.slice(0, optionCount).map((l) => ({ label: l, text: (q!.options ?? []).find((o) => o.label === l)!.text.trim() })),
        correct_answers: [q!.correct!],
        weight: 1,
        annulled: false,
        section: sectionName(slot),
      });
    }
  }
  return { rows, problems };
}
