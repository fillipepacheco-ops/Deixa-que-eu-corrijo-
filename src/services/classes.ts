"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: boolean };

function readClass(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const year = Number(formData.get("year") || new Date().getFullYear());
  return {
    name,
    grade_level: String(formData.get("grade_level") ?? "").trim() || null,
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
    shift: String(formData.get("shift") ?? "").trim() || null,
    subject: String(formData.get("subject") ?? "").trim() || null,
  };
}

export async function createClass(_: FormState, formData: FormData): Promise<FormState> {
  const data = readClass(formData);
  if (!data.name) return { error: "Dê um nome para a turma (ex.: 9º A)." };
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("classes").insert(data).select("id").single();
  if (error) return { error: `Não foi possível salvar a turma. (${error.message})` };
  revalidatePath("/turmas");
  revalidatePath("/dashboard");
  redirect(`/turmas/${row.id}`);
}

export async function updateClass(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const data = readClass(formData);
  if (!data.name) return { error: "A turma precisa de um nome." };
  const supabase = await createClient();
  const { error } = await supabase.from("classes").update(data).eq("id", id);
  if (error) return { error: `Não foi possível salvar as alterações. (${error.message})` };
  revalidatePath(`/turmas/${id}`);
  revalidatePath("/turmas");
  return { ok: true };
}

export async function deleteClass(id: string) {
  const supabase = await createClient();
  await supabase.from("classes").delete().eq("id", id);
  await supabase.from("audit_log").insert({ entity: "class", entity_id: id, action: "delete" });
  revalidatePath("/turmas");
  redirect("/turmas");
}
