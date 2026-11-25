"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseStudentList } from "@/lib/students/parse";
import type { FormState } from "./classes";

function refresh(classId: string) {
  revalidatePath(`/turmas/${classId}`);
  revalidatePath("/alunos");
  revalidatePath("/dashboard");
}

export async function addStudent(classId: string, _: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Informe o nome do aluno." };
  const roll = Number(formData.get("roll_number"));
  const supabase = await createClient();
  const { error } = await supabase.from("students").insert({
    class_id: classId,
    name,
    registration: String(formData.get("registration") ?? "").trim() || null,
    roll_number: Number.isInteger(roll) && roll > 0 ? roll : null,
  });
  if (error) return { error: `Não foi possível adicionar o aluno. (${error.message})` };
  refresh(classId);
  return { ok: true };
}

/** Cola uma lista (um aluno por linha, opcionalmente "nº;nome;matrícula"). */
export async function addStudentsBulk(classId: string, _: FormState, formData: FormData): Promise<FormState> {
  const rows = parseStudentList(String(formData.get("list") ?? ""));
  if (rows.length === 0) return { error: "Cole pelo menos um nome." };
  const supabase = await createClient();
  const { error } = await supabase.from("students").insert(rows.map((r) => ({ ...r, class_id: classId })));
  if (error) return { error: `Não foi possível importar a lista. (${error.message})` };
  refresh(classId);
  return { ok: true };
}

export async function updateStudent(id: string, classId: string, _: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "O nome não pode ficar vazio." };
  const roll = Number(formData.get("roll_number"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({
      name,
      registration: String(formData.get("registration") ?? "").trim() || null,
      roll_number: Number.isInteger(roll) && roll > 0 ? roll : null,
    })
    .eq("id", id);
  if (error) return { error: `Não foi possível salvar. (${error.message})` };
  refresh(classId);
  return { ok: true };
}

export async function removeStudent(id: string, classId: string) {
  const supabase = await createClient();
  await supabase.from("students").delete().eq("id", id);
  await supabase.from("audit_log").insert({ entity: "student", entity_id: id, action: "delete" });
  refresh(classId);
}
