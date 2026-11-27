import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Cookie com a escola escolhida no topo do app ("" = todas). */
export const SCHOOL_COOKIE = "dqec_escola";

export interface SchoolRow {
  id: string;
  name: string;
  logo_path: string | null;
}

/** Escolas do professor (vazio se a atualização 0009 ainda não rodou). */
export async function loadSchools(supabase: SupabaseClient): Promise<SchoolRow[]> {
  const { data, error } = await supabase.from("schools").select("id, name, logo_path").order("name");
  if (error) {
    const { data: basic } = await supabase.from("schools").select("id, name").order("name");
    return ((basic ?? []) as { id: string; name: string }[]).map((s) => ({ ...s, logo_path: null }));
  }
  return (data ?? []) as SchoolRow[];
}

/** Escola em uso agora (validada contra as escolas do professor). */
export async function currentSchool(supabase: SupabaseClient): Promise<{ schools: SchoolRow[]; current: SchoolRow | null }> {
  const schools = await loadSchools(supabase);
  const id = (await cookies()).get(SCHOOL_COOKIE)?.value ?? "";
  return { schools, current: schools.find((s) => s.id === id) ?? null };
}

/** Turmas da escola em uso (null = sem filtro). */
export async function classIdsOfCurrent(supabase: SupabaseClient): Promise<string[] | null> {
  const { current } = await currentSchool(supabase);
  if (!current) return null;
  const { data } = await supabase.from("classes").select("id").eq("school_id", current.id);
  return (data ?? []).map((c) => c.id as string);
}
