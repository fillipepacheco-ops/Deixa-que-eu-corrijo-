"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OPTION_LETTERS, buildMultiQuestions, type MultiQuestion, type MultiSlot } from "@/lib/multi/build";
import type { FormState } from "./classes";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const clampInt = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};
const tableMissing = (m: string) => /multi_|schema cache|does not exist/i.test(m);
const MIGRATION = "Rode antes a migração 0011_prova_multi.sql no Supabase.";

function examFields(f: FormData) {
  return {
    title: str(f, "title"),
    school_id: str(f, "school_id") || null,
    class_ids: f.getAll("class_ids").map(String).filter(Boolean),
    applied_on: str(f, "applied_on") || null,
    term: ["1", "2", "3", "4"].includes(str(f, "term")) ? Number(str(f, "term")) : null,
    option_count: str(f, "option_count") === "4" ? 4 : 5,
    versions: clampInt(f.get("versions"), 1, 4, 4),
    max_score: Math.min(100, Math.max(0.5, Number(str(f, "max_score").replace(",", ".")) || 10)),
    instructions: str(f, "instructions") || null,
  };
}

/** Coordenação: nova Prova Multi. */
export async function createMultiExam(_: FormState, f: FormData): Promise<FormState> {
  const data = examFields(f);
  if (!data.title) return { error: "Dê um nome para a prova." };
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("multi_exams").insert(data).select("id").single();
  if (error) {
    if (tableMissing(error.message)) return { error: MIGRATION };
    if (/row-level security/i.test(error.message)) return { error: "A Prova Multi é do plano Direção. Fale com o suporte para mudar o seu plano." };
    return { error: error.message };
  }
  redirect(`/prova-multi/${row.id}`);
}

export async function updateMultiExam(id: string, _: FormState, f: FormData): Promise<FormState> {
  const data = examFields(f);
  if (!data.title) return { error: "Dê um nome para a prova." };
  const supabase = await createClient();
  const { error } = await supabase.from("multi_exams").update(data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/prova-multi/${id}`);
  return { ok: true, message: "Dados da prova salvos." };
}

export async function deleteMultiExam(id: string) {
  const supabase = await createClient();
  await supabase.from("multi_exams").delete().eq("id", id);
  revalidatePath("/prova-multi");
  redirect("/prova-multi");
}

/** Coordenação: cadastra um professor (nome, disciplina, e-mail de login, nº de questões). */
export async function addSlot(examId: string, _: FormState, f: FormData): Promise<FormState> {
  const teacher_name = str(f, "teacher_name");
  const discipline = str(f, "discipline");
  const email = str(f, "email").toLowerCase();
  if (!teacher_name || !discipline) return { error: "Informe o nome do professor e a disciplina." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Informe um e-mail válido: é o login do professor." };
  const supabase = await createClient();
  const { data: last } = await supabase.from("multi_slots").select("position").eq("exam_id", examId).order("position", { ascending: false }).limit(1);
  const { error } = await supabase.from("multi_slots").insert({
    exam_id: examId,
    teacher_name,
    discipline,
    email,
    question_count: clampInt(f.get("question_count"), 1, 40, 2),
    position: (last?.[0]?.position ?? 0) + 1,
  });
  if (error) return { error: error.message };
  revalidatePath(`/prova-multi/${examId}`);
  return { ok: true, message: `${teacher_name} cadastrado(a). Envie o link do convite.` };
}

export async function updateSlot(examId: string, slotId: string, _: FormState, f: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("multi_slots")
    .update({
      teacher_name: str(f, "teacher_name"),
      discipline: str(f, "discipline"),
      question_count: clampInt(f.get("question_count"), 1, 40, 2),
    })
    .eq("id", slotId);
  if (error) return { error: error.message };
  revalidatePath(`/prova-multi/${examId}`);
  return { ok: true, message: "Salvo." };
}

export async function removeSlot(examId: string, slotId: string) {
  const supabase = await createClient();
  await supabase.from("multi_slots").delete().eq("id", slotId);
  revalidatePath(`/prova-multi/${examId}`);
}

export async function moveSlot(examId: string, slotId: string, dir: -1 | 1) {
  const supabase = await createClient();
  const { data } = await supabase.from("multi_slots").select("id, position").eq("exam_id", examId).order("position");
  const list = data ?? [];
  const i = list.findIndex((s) => s.id === slotId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  for (const [k, s] of list.entries()) await supabase.from("multi_slots").update({ position: k + 1 }).eq("id", s.id);
  revalidatePath(`/prova-multi/${examId}`);
}

/** Professor (ou coordenação): salva uma questão da sua parte. */
export async function saveMultiQuestion(slotId: string, position: number, _: FormState, f: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: slot } = await supabase.from("multi_slots").select("id, exam_id, question_count, multi_exams(option_count, status)").eq("id", slotId).maybeSingle();
  if (!slot) return { error: "Convite não encontrado." };
  const exam = slot.multi_exams as unknown as { option_count: number; status: string } | null;
  if (position < 1 || position > slot.question_count) return { error: "Questão fora do combinado." };
  const count = exam?.option_count === 4 ? 4 : 5;
  const statement = String(f.get("statement") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 6000);
  const options = OPTION_LETTERS.slice(0, count).map((l) => ({ label: l, text: str(f, `opt_${l}`).slice(0, 1500) }));
  const correctRaw = str(f, "correct");
  const correct = (OPTION_LETTERS.slice(0, count) as readonly string[]).includes(correctRaw) ? correctRaw : null;
  const { error } = await supabase
    .from("multi_questions")
    .upsert({ slot_id: slotId, exam_id: slot.exam_id, position, statement, options, correct, updated_at: new Date().toISOString() }, { onConflict: "slot_id,position" });
  if (error) {
    if (exam?.status === "fechada" || /row-level security/i.test(error.message)) return { error: "A coordenação já fechou esta prova. Peça para reabrir se precisar mudar algo." };
    return { error: error.message };
  }
  revalidatePath(`/colaborar/${slotId}`);
  return { ok: true, message: `Questão ${position} salva.` };
}

/** Professor: "terminei" (ou desfaz). */
export async function submitSlot(slotId: string, done: boolean) {
  const supabase = await createClient();
  await supabase.rpc("submit_multi_slot", { p_slot: slotId, p_done: done });
  revalidatePath(`/colaborar/${slotId}`);
  revalidatePath("/colaborar");
}

/** Coordenação: reabre para os professores mexerem de novo. */
export async function reopenMulti(examId: string) {
  const supabase = await createClient();
  await supabase.from("multi_exams").update({ status: "aberta" }).eq("id", examId);
  revalidatePath(`/prova-multi/${examId}`);
}

/**
 * Coordenação: gera (ou atualiza) a avaliação de cada turma escolhida, com as seções por
 * disciplina e as versões. Fecha a edição dos professores.
 */
export async function generateMulti(examId: string, _: FormState, __: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: exam } = await supabase.from("multi_exams").select("*").eq("id", examId).maybeSingle();
  if (!exam) return { error: "Prova não encontrada." };
  if (!exam.class_ids?.length) return { error: "Escolha pelo menos uma turma nos dados da prova." };

  const [{ data: slots }, { data: qs }, { data: classes }, { data: school }, { data: auth }] = await Promise.all([
    supabase.from("multi_slots").select("*").eq("exam_id", examId).order("position"),
    supabase.from("multi_questions").select("*").eq("exam_id", examId),
    supabase.from("classes").select("id, name, grade_level").in("id", exam.class_ids),
    exam.school_id ? supabase.from("schools").select("*").eq("id", exam.school_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.auth.getUser(),
  ]);
  if (!slots?.length) return { error: "Cadastre os professores antes de gerar a prova." };
  const { rows, problems } = buildMultiQuestions(slots as MultiSlot[], (qs ?? []) as MultiQuestion[], exam.option_count);
  if (problems.length) {
    return { error: `Ainda falta completar ${problems.length === 1 ? "1 questão" : `${problems.length} questões`}:\n• ${problems.slice(0, 8).join("\n• ")}${problems.length > 8 ? "\n• …" : ""}` };
  }
  const { data: me } = await supabase.from("profiles").select("full_name").eq("id", auth.user?.id ?? "").maybeSingle();
  const sch = school as { name?: string; logo_path?: string | null } | null;

  // avaliações já geradas antes (atualiza em vez de duplicar)
  const { data: existing } = exam.assessment_ids?.length
    ? await supabase.from("assessments").select("id, class_id").in("id", exam.assessment_ids)
    : { data: [] as { id: string; class_id: string | null }[] };
  const byClass = new Map((existing ?? []).map((a) => [a.class_id, a.id]));

  const ids: string[] = [];
  const disciplines = [...new Set(rows.map((r) => r.section))];
  for (const turma of classes ?? []) {
    const header = {
      title: exam.title,
      class_id: turma.id,
      subject: disciplines.length > 1 ? "Multidisciplinar" : disciplines[0],
      grade_level: turma.grade_level,
      teacher_name: me?.full_name || null,
      school_name: sch?.name ?? null,
      school_logo_path: sch?.logo_path ?? null,
      applied_on: exam.applied_on,
      instructions: exam.instructions,
      template: "larga_escala",
      max_score: exam.max_score,
      versions: exam.versions,
      term: exam.term,
    };
    let id = byClass.get(turma.id);
    if (id) {
      const { error } = await supabase.from("assessments").update(header).eq("id", id);
      if (error) return { error: `Não foi possível atualizar a prova de ${turma.name}. (${error.message})` };
      await supabase.from("assessment_questions").delete().eq("assessment_id", id);
    } else {
      const { data: created, error } = await supabase.from("assessments").insert({ ...header, status: "draft" }).select("id").single();
      if (error || !created) return { error: `Não foi possível criar a prova de ${turma.name}. (${error?.message ?? "erro"})` };
      id = created.id as string;
    }
    const { error: qErr } = await supabase.from("assessment_questions").insert(rows.map((r) => ({ ...r, assessment_id: id })));
    if (qErr) return { error: `A prova de ${turma.name} foi criada, mas as questões não. (${qErr.message})` };
    ids.push(id!);
  }
  await supabase.from("multi_exams").update({ assessment_ids: ids, generated_at: new Date().toISOString(), status: "fechada" }).eq("id", examId);
  revalidatePath(`/prova-multi/${examId}`);
  revalidatePath("/avaliacoes");
  return {
    ok: true,
    message: `Prova gerada para ${ids.length} ${ids.length === 1 ? "turma" : "turmas"}, com ${rows.length} questões e ${exam.versions} ${exam.versions === 1 ? "versão" : "versões"}. A edição dos professores foi fechada.`,
  };
}
