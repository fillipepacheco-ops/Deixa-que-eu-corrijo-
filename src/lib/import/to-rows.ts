/**
 * Confere as questões importadas (vindas do navegador) antes de gravar:
 * tipos válidos, tamanhos razoáveis e imagens só da pasta do próprio professor.
 */
import type { QuestionType } from "@/lib/models/types";

export interface ImportedRow {
  type: QuestionType;
  statement: string;
  options: { label: string; text: string }[];
  correct_answers: string[];
  weight: number;
  annulled: boolean;
  image_path: string | null;
}

const TYPES: QuestionType[] = ["multiple_choice", "true_false", "short_answer", "essay", "numeric", "lined"];
const LETTERS = ["A", "B", "C", "D", "E"];
export const MAX_IMPORTED = 200;

export function importedToRows(raw: unknown, userId: string): { ok: true; rows: ImportedRow[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "Arquivo não lido. Escolha a prova de novo." };
  if (raw.length === 0) return { ok: false, error: "Escolha o arquivo da prova (PDF ou Word) antes de criar." };
  if (raw.length > MAX_IMPORTED) return { ok: false, error: `São no máximo ${MAX_IMPORTED} questões por avaliação.` };
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const rows: ImportedRow[] = [];
  for (const item of raw as Record<string, unknown>[]) {
    const type = TYPES.includes(item?.type as QuestionType) ? (item.type as QuestionType) : "essay";
    const options =
      type === "multiple_choice" && Array.isArray(item.options)
        ? (item.options as Record<string, unknown>[]).slice(0, 5).map((o, i) => ({ label: LETTERS[i], text: str(o?.text, 2000) }))
        : [];
    const answers = Array.isArray(item.correct_answers) ? (item.correct_answers as unknown[]).map((a) => str(a, 5)) : [];
    const correct =
      type === "multiple_choice"
        ? answers.filter((a) => options.some((o) => o.label === a)).slice(0, 1)
        : type === "true_false"
          ? answers.filter((a) => a === "C" || a === "E").slice(0, 1)
          : type === "numeric"
            ? answers.filter((a) => /^\d{1,3}$/.test(a)).map((a) => String(Number(a))).slice(0, 1)
            : [];
    const image = str(item.image_path, 300);
    const finalType: QuestionType = type === "multiple_choice" && options.length < 2 ? "essay" : type;
    rows.push({
      type: finalType,
      statement: str(item.statement, 20000),
      options: finalType === "multiple_choice" ? options : [],
      correct_answers: finalType === "essay" || finalType === "lined" ? [] : correct,
      weight: 1,
      annulled: false,
      image_path: image && image.startsWith(`${userId}/`) && !image.includes("..") ? image : null,
    });
  }
  return { ok: true, rows };
}
