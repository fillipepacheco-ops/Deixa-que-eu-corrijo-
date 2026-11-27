/**
 * CABEÇALHO DA AVALIAÇÃO — fonte única dos dados que aparecem na capa da
 * prova (PDF e Word) e no cartão-resposta. O professor preenche uma vez.
 */
import type { Assessment } from "@/lib/models/types";

export interface ExamHeader {
  schoolName: string;
  title: string;
  subject: string;
  gradeLevel: string;
  className: string;
  teacherName: string;
  appliedOn: string | null; // AAAA-MM-DD
  maxScore: number;
  instructions: string[];
  /** Letra da versão desta cópia (provas com versões A–D); null = versão única. */
  versionLetter: string | null;
}

export const DEFAULT_INSTRUCTIONS = [
  "Verifique se este caderno contém todas as questões e se não há falhas de impressão. Caso haja algum problema, avise o aplicador.",
  "Preencha seus dados no cabeçalho desta capa e no cartão-resposta.",
  "Leia atentamente cada questão antes de responder.",
  "Marque no cartão-resposta apenas uma alternativa por questão, preenchendo toda a bolha com caneta azul ou preta.",
  "Não rasure nem dobre o cartão-resposta. Questões com rasura ou mais de uma marcação serão anuladas.",
  "Somente o cartão-resposta será considerado na correção das questões objetivas.",
];

/** Instruções salvas como texto, uma por linha (numeração automática). */
export function parseInstructions(text: string | null | undefined): string[] {
  const lines = (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\d+[.)-]|[-•*])\s*/, "").trim())
    .filter(Boolean);
  return lines;
}

export function examHeader(a: Assessment): ExamHeader {
  const instructions = parseInstructions(a.instructions).map((t) => t.normalize("NFC"));
  const t = (v: string | null | undefined) => (v ?? "").normalize("NFC").trim();
  return {
    schoolName: t(a.school_name),
    title: t(a.title),
    subject: t(a.subject),
    gradeLevel: t(a.grade_level),
    className: t(a.class_name),
    teacherName: t(a.teacher_name),
    appliedOn: a.applied_on,
    maxScore: a.max_score,
    instructions: instructions.length ? instructions : DEFAULT_INSTRUCTIONS,
    versionLetter: a.version !== null && a.version !== undefined && (a.versions ?? 1) > 1 ? ("ABCD"[a.version] ?? null) : null,
  };
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Nome de arquivo seguro: "Avaliação de Matemática" → "avaliacao-de-matematica". */
export function fileSlug(s: string): string {
  return (
    s
      .replace(/º/g, "o")
      .replace(/ª/g, "a")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "avaliacao"
  );
}

export const QUESTION_LABEL = (n: number) => `QUESTÃO ${String(n).padStart(2, "0")}`;
