"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { blankQuestion, parseQuestionForm } from "@/lib/assessment/question-form";
import { importedToRows } from "@/lib/import/to-rows";
import type { QuestionType } from "@/lib/models/types";
import type { FormState } from "./classes";

function readHeader(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const max = Number(s("max_score").replace(",", ".") || "10");
  return {
    title: s("title"),
    school_name: s("school_name") || null,
    school_logo_path: s("school_logo_path") || null,
    subject: s("subject") || null,
    grade_level: s("grade_level") || null,
    class_id: s("class_id") || null,
    teacher_name: s("teacher_name") || null,
    applied_on: s("applied_on") || null,
    instructions: s("instructions") || null,
    max_score: Number.isFinite(max) && max > 0 ? max : 10,
  };
}

/** Escola e logo usadas ficam como padrão para as próximas avaliações. */
async function rememberSchool(data: { school_name: string | null; school_logo_path: string | null }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").update({ school_name: data.school_name, school_logo_path: data.school_logo_path }).eq("id", user.id);
}

async function fillFromClass(data: ReturnType<typeof readHeader>) {
  if (!data.class_id || (data.subject && data.grade_level)) return;
  const supabase = await createClient();
  const { data: turma } = await supabase.from("classes").select("subject, grade_level").eq("id", data.class_id).maybeSingle();
  data.subject ??= turma?.subject ?? null;
  data.grade_level ??= turma?.grade_level ?? null;
}

function readImported(formData: FormData, userId: string) {
  if (!formData.has("imported")) return null;
  try {
    return importedToRows(JSON.parse(String(formData.get("imported") ?? "[]")), userId);
  } catch {
    return { ok: false as const, error: "Arquivo não lido. Escolha a prova de novo." };
  }
}

export async function createAssessment(_: FormState, formData: FormData): Promise<FormState> {
  const data = readHeader(formData);
  if (!data.title) return { error: "Dê um título para a avaliação." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre de novo." };
  // Prova importada de PDF/Word: as questões vêm prontas.
  const imported = readImported(formData, user.id);
  if (imported && !imported.ok) return { error: imported.error };
  // Disciplina e série em branco: usa as da turma escolhida.
  await fillFromClass(data);
  const { data: row, error } = await supabase
    .from("assessments")
    .insert({ ...data, template: "larga_escala" })
    .select("id")
    .single();
  if (error) return { error: `Não foi possível criar a avaliação. (${error.message})` };
  await rememberSchool(data);
  if (imported?.ok) {
    const { error: qErr } = await supabase
      .from("assessment_questions")
      .insert(imported.rows.map((q, i) => ({ ...q, assessment_id: row.id, position: i + 1 })));
    if (qErr) return { error: `A avaliação foi criada, mas as questões não foram salvas. (${qErr.message})` };
  } else {
    // Já começa com a primeira questão para o professor digitar.
    await supabase.from("assessment_questions").insert({ assessment_id: row.id, position: 1, ...blankQuestion("multiple_choice") });
  }
  revalidatePath("/avaliacoes");
  redirect(`/avaliacoes/${row.id}`);
}

export async function updateAssessment(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const data = readHeader(formData);
  if (!data.title) return { error: "A avaliação precisa de um título." };
  await fillFromClass(data);
  const supabase = await createClient();
  const { error } = await supabase.from("assessments").update(data).eq("id", id);
  if (error) return { error: `Não foi possível salvar. (${error.message})` };
  await rememberSchool(data);
  revalidatePath(`/avaliacoes/${id}`);
  revalidatePath("/avaliacoes");
  return { ok: true };
}

export async function deleteAssessment(id: string) {
  const supabase = await createClient();
  await supabase.from("assessments").delete().eq("id", id);
  await supabase.from("audit_log").insert({ entity: "assessment", entity_id: id, action: "delete" });
  revalidatePath("/avaliacoes");
  redirect("/avaliacoes");
}

async function questionIds(assessmentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessment_questions")
    .select("id, position")
    .eq("assessment_id", assessmentId)
    .order("position");
  return { supabase, rows: (data ?? []) as { id: string; position: number }[] };
}

/** Regrava as posições 1..n na ordem dada (em duas fases, por causa da posição única). */
async function renumber(assessmentId: string, orderedIds: string[]) {
  const supabase = await createClient();
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase.from("assessment_questions").update({ position: 10000 + i }).eq("id", orderedIds[i]).eq("assessment_id", assessmentId);
  }
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase.from("assessment_questions").update({ position: i + 1 }).eq("id", orderedIds[i]).eq("assessment_id", assessmentId);
  }
}

export async function addQuestion(assessmentId: string, type: QuestionType) {
  const { supabase, rows } = await questionIds(assessmentId);
  const position = (rows.at(-1)?.position ?? 0) + 1;
  await supabase.from("assessment_questions").insert({ assessment_id: assessmentId, position, ...blankQuestion(type) });
  revalidatePath(`/avaliacoes/${assessmentId}`);
}

export async function saveQuestion(assessmentId: string, questionId: string, _: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseQuestionForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const supabase = await createClient();

  // Registro de alterações do gabarito (resposta, peso, anulação).
  const { data: before } = await supabase
    .from("assessment_questions")
    .select("position, correct_answers, weight, annulled")
    .eq("id", questionId)
    .maybeSingle();

  const { error } = await supabase.from("assessment_questions").update(parsed.data).eq("id", questionId).eq("assessment_id", assessmentId);
  if (error) return { error: `Não foi possível salvar a questão. (${error.message})` };

  if (before) {
    const changes: { field: string; from: unknown; to: unknown }[] = [];
    const a = [...(before.correct_answers ?? [])].sort().join(",");
    const b = [...parsed.data.correct_answers].sort().join(",");
    if (a !== b) changes.push({ field: "correct_answers", from: before.correct_answers, to: parsed.data.correct_answers });
    if (Number(before.weight) !== parsed.data.weight) changes.push({ field: "weight", from: Number(before.weight), to: parsed.data.weight });
    if (before.annulled !== parsed.data.annulled) changes.push({ field: "annulled", from: before.annulled, to: parsed.data.annulled });
    if (changes.length) {
      await supabase
        .from("answer_key_changes")
        .insert(changes.map((change) => ({ assessment_id: assessmentId, question_position: before.position, change })));
    }
  }
  revalidatePath(`/avaliacoes/${assessmentId}`);
  return { ok: true };
}

export async function deleteQuestion(assessmentId: string, questionId: string) {
  const { supabase, rows } = await questionIds(assessmentId);
  await supabase.from("assessment_questions").delete().eq("id", questionId).eq("assessment_id", assessmentId);
  await renumber(
    assessmentId,
    rows.map((r) => r.id).filter((id) => id !== questionId),
  );
  revalidatePath(`/avaliacoes/${assessmentId}`);
}

export async function moveQuestion(assessmentId: string, questionId: string, direction: -1 | 1) {
  const { rows } = await questionIds(assessmentId);
  const ids = rows.map((r) => r.id);
  const i = ids.indexOf(questionId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await renumber(assessmentId, ids);
  revalidatePath(`/avaliacoes/${assessmentId}`);
}

export async function duplicateQuestion(assessmentId: string, questionId: string) {
  const { supabase, rows } = await questionIds(assessmentId);
  const { data: q } = await supabase
    .from("assessment_questions")
    .select("type, statement, options, correct_answers, weight, table_data, image_path")
    .eq("id", questionId)
    .maybeSingle();
  if (!q) return;
  const { data: copy } = await supabase
    .from("assessment_questions")
    .insert({ ...q, assessment_id: assessmentId, position: (rows.at(-1)?.position ?? 0) + 1 })
    .select("id")
    .single();
  // A cópia entra logo depois da original.
  if (copy) {
    const ids = rows.map((r) => r.id);
    ids.splice(ids.indexOf(questionId) + 1, 0, copy.id);
    await renumber(assessmentId, ids);
  }
  revalidatePath(`/avaliacoes/${assessmentId}`);
}

/** Acrescenta questões importadas de PDF/Word no fim de uma avaliação que já existe. */
export async function appendImportedQuestions(assessmentId: string, imported: unknown): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre de novo." };
  const parsed = importedToRows(imported, user.id);
  if (!parsed.ok) return { error: parsed.error };
  const { data: last } = await supabase
    .from("assessment_questions")
    .select("position, statement, options")
    .eq("assessment_id", assessmentId)
    .order("position", { ascending: false });
  // Se a avaliação só tem a questão em branco do começo, ela é substituída.
  const onlyBlank = (last ?? []).length === 1 && !String(last![0].statement ?? "").trim() && !(last![0].options as { text: string }[] | null)?.some((o) => o.text?.trim());
  if (onlyBlank) await supabase.from("assessment_questions").delete().eq("assessment_id", assessmentId);
  const start = onlyBlank ? 0 : (last?.[0]?.position ?? 0);
  const { error } = await supabase
    .from("assessment_questions")
    .insert(parsed.rows.map((q, i) => ({ ...q, assessment_id: assessmentId, position: start + i + 1 })));
  if (error) return { error: `Não foi possível salvar as questões. (${error.message})` };
  revalidatePath(`/avaliacoes/${assessmentId}`);
  return { ok: true };
}
