/**
 * Converte o formulário do editor de questão nos campos do banco.
 * Separado da Server Action para poder ser testado.
 */
import type { QuestionOption, QuestionType } from "@/lib/models/types";

export const OPTION_LABELS = ["A", "B", "C", "D", "E"] as const;

export const QUESTION_TYPE_NAMES: Record<QuestionType, string> = {
  multiple_choice: "Múltipla escolha",
  true_false: "Certo ou errado",
  short_answer: "Resposta curta",
  essay: "Discursiva",
};

export interface ParsedQuestion {
  type: QuestionType;
  statement: string;
  options: QuestionOption[];
  correct_answers: string[];
  weight: number;
  annulled: boolean;
  image_path: string | null;
}

type FormLike = { get(name: string): FormDataEntryValue | null; getAll(name: string): FormDataEntryValue[] };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "").normalize("NFC").trim();

export function parseQuestionForm(form: FormLike): { ok: true; data: ParsedQuestion } | { ok: false; error: string } {
  const type = str(form.get("type")) as QuestionType;
  if (!(type in QUESTION_TYPE_NAMES)) return { ok: false, error: "Tipo de questão inválido." };

  const statement = str(form.get("statement"));
  const weight = Number(str(form.get("weight")).replace(",", ".") || "1");
  if (!Number.isFinite(weight) || weight < 0) return { ok: false, error: "O peso precisa ser um número (ex.: 1 ou 1,5)." };
  const annulled = form.get("annulled") === "on";

  let options: QuestionOption[] = [];
  let correct: string[] = [];

  if (type === "multiple_choice") {
    // Alternativas preenchidas, re-rotuladas em sequência (A, B, C...).
    const filled = OPTION_LABELS.map((l) => ({ old: l, text: str(form.get(`opt_${l}`)) })).filter((o) => o.text);
    if (filled.length < 2) return { ok: false, error: "Preencha pelo menos 2 alternativas." };
    const marked = new Set(form.getAll("correct").map((v) => String(v)));
    options = filled.map((o, i) => ({ label: OPTION_LABELS[i], text: o.text }));
    correct = filled.map((o, i) => (marked.has(o.old) ? OPTION_LABELS[i] : null)).filter((x): x is (typeof OPTION_LABELS)[number] => !!x);
  } else if (type === "true_false") {
    const v = str(form.get("correct_tf"));
    correct = v === "C" || v === "E" ? [v] : [];
  } else if (type === "short_answer") {
    correct = str(form.get("expected"))
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const image_path = str(form.get("image_path")) || null;
  return { ok: true, data: { type, statement, options, correct_answers: correct, weight, annulled, image_path } };
}

/** Questão nova, já com 5 alternativas vazias quando for múltipla escolha. */
export function blankQuestion(type: QuestionType) {
  return {
    type,
    statement: "",
    options: type === "multiple_choice" ? OPTION_LABELS.map((label) => ({ label, text: "" })) : [],
    correct_answers: [] as string[],
    weight: 1,
    annulled: false,
  };
}
