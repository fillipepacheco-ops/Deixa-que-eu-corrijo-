/**
 * Modelos de domínio compartilhados (independentes do banco e da interface).
 * Os nomes seguem as entidades do Supabase (supabase/migrations).
 */

export type QuestionType = "multiple_choice" | "true_false" | "short_answer" | "essay";
export type Difficulty = "facil" | "medio" | "dificil";
export type PdfTemplate = "escolar" | "simulado" | "larga_escala" | "personalizado";
export type AnnulPolicy = "credit_all" | "remove";
export type AssessmentStatus = "draft" | "ready" | "applied" | "graded";
export type CouncilCategory = "esperado" | "atencao" | "acompanhamento" | "critica" | "sem_dados";

export interface QuestionOption {
  label: string; // "A", "B", ... ou "V"/"F"
  text: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  grade_level: string | null;
  year: number;
  shift: string | null;
  subject: string | null;
}

export interface Student {
  id: string;
  class_id: string;
  name: string;
  registration: string | null;
  roll_number: number | null;
  active: boolean;
}

export interface AssessmentQuestion {
  id?: string;
  position: number;
  type: QuestionType;
  statement: string;
  options: QuestionOption[];
  correct_answers: string[];
  weight: number;
  annulled: boolean;
  image?: { bytes: Uint8Array; kind: "png" | "jpg"; widthMm?: number } | null;
  table_data?: { rows: string[][] } | null;
}

export interface Assessment {
  id: string;
  title: string;
  subject: string | null;
  grade_level: string | null;
  class_name?: string | null;
  teacher_name: string | null;
  school_name: string | null;
  applied_on: string | null; // AAAA-MM-DD
  instructions: string | null;
  template: PdfTemplate;
  max_score: number;
  annul_policy: AnnulPolicy;
}

export const CATEGORY_LABELS: Record<CouncilCategory, string> = {
  esperado: "Dentro do esperado",
  atencao: "Atenção",
  acompanhamento: "Necessita acompanhamento",
  critica: "Situação crítica",
  sem_dados: "Sem dados suficientes",
};
