import type { SupabaseClient } from "@supabase/supabase-js";

const SKIP = new Set(["id", "created_at", "updated_at", "owner_id"]);
const copyRow = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).filter(([k]) => !SKIP.has(k)));

/**
 * Cópia de uma avaliação para outra turma (questões inclusas). Cada turma fica com
 * a sua cópia, com cartões e notas separados. Se a turma já tem uma cópia com o
 * mesmo título, devolve essa.
 */
export async function copyAssessmentToClass(
  supabase: SupabaseClient,
  assessmentId: string,
  classId: string,
  opts: { reuse?: boolean } = {},
): Promise<{ id: string; created: boolean } | { error: string }> {
  const { data: original } = await supabase.from("assessments").select("*").eq("id", assessmentId).maybeSingle();
  if (!original) return { error: "Avaliação não encontrada." };
  if (original.class_id === classId) return { id: assessmentId, created: false };
  const { data: turma } = await supabase.from("classes").select("id, name, subject, grade_level, school_id").eq("id", classId).maybeSingle();
  if (!turma) return { error: "Turma não encontrada." };

  if (opts.reuse) {
    const { data: same } = await supabase.from("assessments").select("id").eq("class_id", classId).eq("title", original.title).limit(1);
    if (same?.length) return { id: same[0].id as string, created: false };
  }
  // escola da turma de destino (nome e logo no cabeçalho)
  let school: { name?: string; logo_path?: string | null } | null = null;
  if (turma.school_id) {
    const { data } = await supabase.from("schools").select("*").eq("id", turma.school_id).maybeSingle();
    school = data as typeof school;
  }
  const { data: row, error } = await supabase
    .from("assessments")
    .insert({
      ...copyRow(original),
      class_id: turma.id,
      subject: original.subject ?? turma.subject,
      grade_level: original.grade_level ?? turma.grade_level,
      ...(school ? { school_name: school.name ?? original.school_name, school_logo_path: school.logo_path ?? original.school_logo_path } : {}),
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !row) return { error: `Não foi possível copiar a prova para ${turma.name}. (${error?.message ?? "erro"})` };
  const { data: questions } = await supabase.from("assessment_questions").select("*").eq("assessment_id", assessmentId).order("position");
  if (questions?.length) {
    const { error: qErr } = await supabase
      .from("assessment_questions")
      .insert(questions.map((q) => ({ ...copyRow(q), assessment_id: row.id, question_id: q.question_id ?? null })));
    if (qErr) return { error: `A cópia para ${turma.name} foi criada, mas as questões não. (${qErr.message})` };
  }
  return { id: row.id as string, created: true };
}
