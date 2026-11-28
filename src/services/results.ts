"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeFormat, schoolKey, type DiaryFormat } from "@/lib/results/diary";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Salva o formato do diário de UMA escola (vale para todas as avaliações dela). */
export async function saveDiaryFormat(school: string, settings: DiaryFormat): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const { error } = await supabase.from("diary_formats").upsert(
    { owner_id: user.id, school_name: schoolKey(school), settings: normalizeFormat(settings), updated_at: new Date().toISOString() },
    { onConflict: "owner_id,school_name" },
  );
  if (error) {
    const missing = /diary_formats/.test(error.message) && /(does not exist|schema cache|not find)/i.test(error.message);
    return {
      ok: false,
      error: missing
        ? "Falta rodar a atualização 0004 do banco (formato do diário) no Supabase."
        : `Não foi possível salvar. (${error.message})`,
    };
  }
  revalidatePath("/resultados", "layout");
  return { ok: true };
}

/**
 * Nota lançada à mão (ex.: aluno fez a prova em outro dia, sem cartão).
 * score null = apaga a nota manual. Nunca apaga correção feita pela câmera.
 */
export async function saveManualScore(assessmentId: string, studentId: string, score: number | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: a } = await supabase.from("assessments").select("max_score").eq("id", assessmentId).maybeSingle();
  if (!a) return { ok: false, error: "Avaliação não encontrada." };
  const { data: st } = await supabase.from("students").select("active").eq("id", studentId).maybeSingle();
  if (st && st.active === false) return { ok: false, error: "Este aluno não frequenta mais a escola: não dá para lançar nota para ele." };
  const { data: existing } = await supabase
    .from("submissions")
    .select("id, source")
    .eq("assessment_id", assessmentId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (existing && existing.source !== "manual") return { ok: false, error: "Este aluno já foi corrigido pela câmera. Para mudar, corrija o cartão de novo." };

  if (score === null) {
    if (existing) await supabase.from("submissions").delete().eq("id", existing.id);
  } else {
    const max = Number(a.max_score);
    if (!Number.isFinite(score) || score < 0 || score > max) return { ok: false, error: `A nota precisa ficar entre 0 e ${String(max).replace(".", ",")}.` };
    const { error } = await supabase.from("submissions").upsert(
      {
        assessment_id: assessmentId,
        student_id: studentId,
        source: "manual",
        answers: {},
        status: "confirmed",
        score: Math.round(score * 100) / 100,
        correct_count: null,
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: "assessment_id,student_id" },
    );
    if (error) return { ok: false, error: `Não foi possível salvar. (${error.message})` };
  }
  revalidatePath(`/resultados/${assessmentId}`);
  revalidatePath("/resultados");
  revalidatePath(`/correcao/${assessmentId}`);
  return { ok: true };
}
