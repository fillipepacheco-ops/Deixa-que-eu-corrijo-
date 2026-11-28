"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadAccess } from "./access";
import { canUseApp } from "@/lib/billing/plans";
import { ENEM_QUESTIONS, bankQuestionRow } from "@/lib/banco/enem";
import type { FormState } from "./classes";

/**
 * Copia as questões marcadas do Banco de Questões para o fim de uma avaliação.
 * Só para quem tem assinatura em dia (o professor convidado da Prova Multi não acessa o banco).
 */
export async function addBankQuestions(_: FormState, formData: FormData): Promise<FormState & { assessmentId?: string; added?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Entre na sua conta para usar o banco de questões." };
  const access = await loadAccess(supabase, user.id);
  if (!access.isAdmin && !canUseApp(access.state)) return { error: "O banco de questões é exclusivo para assinantes." };

  const assessmentId = String(formData.get("assessment_id") ?? "");
  const ids = [...new Set(formData.getAll("ids").map(String))];
  if (!assessmentId) return { error: "Escolha a avaliação que vai receber as questões." };
  if (!ids.length) return { error: "Marque pelo menos uma questão." };

  // a avaliação precisa ser do professor (o RLS só devolve as dele)
  const { data: assessment } = await supabase.from("assessments").select("id, title").eq("id", assessmentId).maybeSingle();
  if (!assessment) return { error: "Avaliação não encontrada." };

  const byId = new Map(ENEM_QUESTIONS.map((q) => [q.id, q]));
  const picked = ids.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => !!q);
  if (!picked.length) return { error: "Questões não encontradas no banco." };

  const { data: last } = await supabase
    .from("assessment_questions")
    .select("position")
    .eq("assessment_id", assessmentId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const start = (last?.position ?? 0) + 1;
  const rows = picked.map((q, i) => ({ assessment_id: assessmentId, position: start + i, ...bankQuestionRow(q) }));
  const { error } = await supabase.from("assessment_questions").insert(rows);
  if (error) return { error: `Não foi possível adicionar as questões. (${error.message})` };

  revalidatePath(`/avaliacoes/${assessmentId}`);
  const n = picked.length;
  return {
    ok: true,
    assessmentId,
    added: n,
    message: `${n} ${n === 1 ? "questão adicionada" : "questões adicionadas"} em “${assessment.title}”.`,
  };
}
