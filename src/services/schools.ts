"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./classes";
import { SCHOOL_COOKIE } from "./school-context";


function readSchool(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").normalize("NFC").replace(/\s+/g, " ").trim(),
    logo_path: String(formData.get("logo_path") ?? "").trim() || null,
  };
}

const missing = (m: string) => /logo_path/.test(m) && /(column|schema cache)/i.test(m);
const MIGRATION = "Falta rodar a atualização 0009 do banco (escolas) no Supabase.";

export async function createSchool(_: FormState, formData: FormData): Promise<FormState> {
  const data = readSchool(formData);
  if (!data.name) return { error: "Digite o nome da escola." };
  const supabase = await createClient();
  const { error } = await supabase.from("schools").insert(data);
  if (error) return { error: missing(error.message) ? MIGRATION : `Não foi possível salvar a escola. (${error.message})` };
  revalidatePath("/escolas");
  revalidatePath("/turmas");
  return { ok: true, message: `Escola “${data.name}” criada.` };
}

/**
 * Atualiza nome/logo da escola e leva a mudança para as avaliações das turmas dela
 * (a logo aparece na prova, no cartão-resposta e nas listas de notas).
 */
export async function updateSchool(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const data = readSchool(formData);
  if (!data.name) return { error: "A escola precisa de um nome." };
  const supabase = await createClient();
  const { error } = await supabase.from("schools").update(data).eq("id", id);
  if (error) return { error: missing(error.message) ? MIGRATION : `Não foi possível salvar. (${error.message})` };
  const { data: classes } = await supabase.from("classes").select("id").eq("school_id", id);
  const ids = (classes ?? []).map((c) => c.id as string);
  if (ids.length) {
    await supabase.from("assessments").update({ school_name: data.name, school_logo_path: data.logo_path }).in("class_id", ids);
  }
  revalidatePath("/escolas");
  revalidatePath("/avaliacoes");
  return { ok: true, message: "Escola atualizada. As avaliações das turmas dela já usam o nome e a logo novos." };
}

export async function deleteSchool(id: string) {
  const supabase = await createClient();
  await supabase.from("schools").delete().eq("id", id);
  const jar = await cookies();
  if (jar.get(SCHOOL_COOKIE)?.value === id) jar.delete(SCHOOL_COOKIE);
  revalidatePath("/escolas");
  revalidatePath("/turmas");
}

/** Escola em que o professor está trabalhando agora ("" = todas). */
export async function chooseSchool(id: string) {
  const jar = await cookies();
  if (id) jar.set(SCHOOL_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true, secure: true });
  else jar.delete(SCHOOL_COOKIE);
  revalidatePath("/", "layout");
}
