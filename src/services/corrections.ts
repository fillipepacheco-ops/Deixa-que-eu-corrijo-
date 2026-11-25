"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { gradeSubmission, type GivenAnswer } from "@/lib/grading/grading";
import { keyFromQuestions } from "@/lib/correction/key";
import { loadAssessment } from "./assessment-data";

export interface SaveCorrectionInput {
  studentId: string;
  sheetNumber: number | null;
  answers: Record<string, GivenAnswer>;
  readDetails: unknown;
  imagePath: string | null;
}

export type SaveCorrectionResult = { ok: true; score: number } | { ok: false; error: string };

/**
 * Salva a correção de um aluno. A nota é recalculada aqui no servidor,
 * a partir do gabarito oficial atual (não confia no número vindo da tela).
 */
export async function saveCorrection(assessmentId: string, input: SaveCorrectionInput): Promise<SaveCorrectionResult> {
  const supabase = await createClient();
  const data = await loadAssessment(supabase, assessmentId);
  if (!data) return { ok: false, error: "Avaliação não encontrada." };

  const answers: Record<number, GivenAnswer> = {};
  for (const [k, v] of Object.entries(input.answers ?? {})) answers[Number(k)] = v;
  const grade = gradeSubmission(keyFromQuestions(data.questions), answers, {
    maxScore: data.assessment.max_score,
    annulPolicy: data.assessment.annul_policy,
  });
  if (grade.needsReview) return { ok: false, error: "Ainda há questão com leitura incerta. Escolha a resposta antes de salvar." };

  let answerSheetId: string | null = null;
  if (input.sheetNumber !== null) {
    const { data: sheet } = await supabase
      .from("answer_sheets")
      .select("id")
      .eq("assessment_id", assessmentId)
      .eq("sheet_number", input.sheetNumber)
      .maybeSingle();
    answerSheetId = sheet?.id ?? null;
  }

  const { error } = await supabase.from("submissions").upsert(
    {
      assessment_id: assessmentId,
      student_id: input.studentId,
      answer_sheet_id: answerSheetId,
      source: "camera",
      answers: input.answers,
      read_details: input.readDetails ?? null,
      image_path: input.imagePath,
      status: "confirmed",
      score: grade.score,
      correct_count: grade.correctCount,
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: "assessment_id,student_id" },
  );
  if (error) return { ok: false, error: `Não foi possível salvar. (${error.message})` };

  revalidatePath(`/correcao/${assessmentId}`);
  revalidatePath("/correcao");
  revalidatePath("/dashboard");
  return { ok: true, score: grade.score };
}
