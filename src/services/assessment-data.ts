import type { SupabaseClient } from "@supabase/supabase-js";
import type { Assessment, AssessmentQuestion, QuestionOption, QuestionType } from "@/lib/models/types";

export interface AssessmentRow {
  id: string;
  class_id: string | null;
  title: string;
  subject: string | null;
  grade_level: string | null;
  teacher_name: string | null;
  school_name: string | null;
  school_logo_path: string | null;
  applied_on: string | null;
  instructions: string | null;
  template: Assessment["template"];
  max_score: number;
  annul_policy: Assessment["annul_policy"];
  status: string;
  classes: { name: string } | null;
}

export interface QuestionRow {
  id: string;
  position: number;
  type: QuestionType;
  statement: string;
  options: QuestionOption[];
  correct_answers: string[];
  weight: number;
  annulled: boolean;
  table_data: { rows: string[][] } | null;
}

export function toAssessment(row: AssessmentRow): Assessment {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    grade_level: row.grade_level,
    class_name: row.classes?.name ?? null,
    teacher_name: row.teacher_name,
    school_name: row.school_name,
    applied_on: row.applied_on,
    instructions: row.instructions,
    template: row.template,
    max_score: Number(row.max_score),
    annul_policy: row.annul_policy,
  };
}

export function toQuestion(row: QuestionRow): AssessmentQuestion {
  return {
    id: row.id,
    position: row.position,
    type: row.type,
    statement: row.statement,
    options: row.options ?? [],
    correct_answers: row.correct_answers ?? [],
    weight: Number(row.weight),
    annulled: row.annulled,
    table_data: row.table_data,
    image: null,
  };
}

/** Carrega a avaliação com a turma e as questões (o RLS garante que é do professor logado). */
export async function loadAssessment(supabase: SupabaseClient, id: string) {
  const { data: row } = await supabase
    .from("assessments")
    .select("*, classes(name)")
    .eq("id", id)
    .maybeSingle<AssessmentRow>();
  if (!row) return null;
  const { data: qs } = await supabase
    .from("assessment_questions")
    .select("id, position, type, statement, options, correct_answers, weight, annulled, table_data")
    .eq("assessment_id", id)
    .order("position");
  return {
    row,
    assessment: toAssessment(row),
    questions: ((qs ?? []) as QuestionRow[]).map(toQuestion),
  };
}

/** Baixa a logo da escola do Storage (bytes JPEG) para embutir no PDF/Word. */
export async function loadSchoolLogo(supabase: SupabaseClient, path: string | null | undefined): Promise<Uint8Array | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("school-logos").download(path);
  return data ? new Uint8Array(await data.arrayBuffer()) : null;
}

/** Link temporário para mostrar a logo no formulário. */
export async function schoolLogoUrl(supabase: SupabaseClient, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("school-logos").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

/** Alunos ativos da turma, na ordem de chamada. */
export async function loadStudents(supabase: SupabaseClient, classId: string | null) {
  if (!classId) return [] as { id: string; name: string; roll_number: number | null }[];
  const { data } = await supabase
    .from("students")
    .select("id, name, roll_number")
    .eq("class_id", classId)
    .eq("active", true)
    .order("roll_number", { ascending: true, nullsFirst: false })
    .order("name");
  return (data ?? []) as { id: string; name: string; roll_number: number | null }[];
}
