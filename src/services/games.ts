"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { newPin } from "@/lib/game/scoring";
import { tidyText } from "@/lib/assessment/tidy-text";
import { loadAssessment } from "./assessment-data";
import { keyFromQuestions } from "@/lib/correction/key";
import { gradeSubmission, type GivenAnswer } from "@/lib/grading/grading";

type State = { error?: string };

const GAME_TYPES = new Set(["multiple_choice", "true_false", "numeric"]);
const missingTables = (m: string) => /(games|game_)/.test(m) && /(does not exist|schema cache|not find)/i.test(m);
const MIGRATION_MSG = "Falta rodar a atualização 0006 do banco (modo game) no Supabase.";

/** Cria um jogo ao vivo a partir das questões objetivas de uma avaliação. */
export async function createGame(assessmentId: string, _: State, formData: FormData): Promise<State> {
  const supabase = await createClient();
  const data = await loadAssessment(supabase, assessmentId);
  if (!data) return { error: "Avaliação não encontrada." };
  const teamSize = Math.min(3, Math.max(1, Number(formData.get("team_size")) || 1));
  const timeLimit = Math.min(480, Math.max(5, Number(formData.get("time_limit")) || 20)); // até 8 minutos

  const playable = [...data.questions]
    .sort((a, b) => a.position - b.position)
    .filter((q) => GAME_TYPES.has(q.type) && !q.annulled && q.correct_answers.length > 0);
  if (!playable.length) {
    return { error: "O jogo usa as questões de múltipla escolha, certo/errado e Tipo B que têm resposta no gabarito. Esta avaliação não tem nenhuma." };
  }

  // imagens das questões: link temporário (6 h) para aparecer no telão e no celular
  const paths = playable.map((q) => q.image_path).filter((p): p is string => !!p);
  const signed = paths.length ? ((await supabase.storage.from("question-images").createSignedUrls(paths, 6 * 3600)).data ?? []) : [];
  const urlOf = new Map(signed.filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl]));

  let gameId: string | null = null;
  for (let attempt = 0; attempt < 6 && !gameId; attempt++) {
    const { data: row, error } = await supabase
      .from("games")
      .insert({ assessment_id: assessmentId, title: data.assessment.title, pin: newPin(), team_size: teamSize, question_count: playable.length })
      .select("id")
      .single();
    if (row) gameId = row.id as string;
    else if (error && missingTables(error.message)) return { error: MIGRATION_MSG };
    else if (error && error.code !== "23505") return { error: `Não foi possível criar o jogo. (${error.message})` };
  }
  if (!gameId) return { error: "Não foi possível gerar um PIN livre. Tente de novo." };

  const { error: qErr } = await supabase.from("game_questions").insert(
    playable.map((q, idx) => ({
      game_id: gameId,
      idx,
      type: q.type,
      statement: tidyText(q.statement) || "(sem enunciado)",
      options: q.type === "multiple_choice" ? q.options.map((o) => ({ label: o.label, text: tidyText(o.text) })) : [],
      image_url: q.image_path ? (urlOf.get(q.image_path) ?? null) : null,
      time_limit: timeLimit,
      position: q.position,
    })),
  );
  const { error: kErr } = await supabase.from("game_keys").insert(playable.map((q, idx) => ({ game_id: gameId, idx, correct: q.correct_answers })));
  if (qErr || kErr) {
    await supabase.from("games").delete().eq("id", gameId);
    return { error: `Não foi possível montar o jogo. (${(qErr ?? kErr)!.message})` };
  }
  revalidatePath("/jogos");
  redirect(`/jogo/${gameId}`);
}

/** Formulário da página Modo game: a avaliação vem num campo. */
export async function createGameFromForm(state: State, formData: FormData): Promise<State> {
  const id = String(formData.get("assessment_id") ?? "");
  if (!id) return { error: "Escolha a avaliação." };
  return createGame(id, state, formData);
}

/** Libera o aluno/equipe que saiu da tela do jogo. */
export async function unlockAll(gameId: string) {
  const supabase = await createClient();
  await supabase.from("game_players").update({ locked: false }).eq("game_id", gameId);
  return { ok: true };
}

export async function unlockPlayer(playerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("game_players").update({ locked: false }).eq("id", playerId);
  return { ok: !error, error: error?.message };
}

export async function removePlayer(playerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("game_players").delete().eq("id", playerId);
  return { ok: !error, error: error?.message };
}

export async function deleteGame(gameId: string) {
  const supabase = await createClient();
  await supabase.from("games").delete().eq("id", gameId);
  revalidatePath("/jogos");
}

/**
 * Fim da partida: a nota de cada aluno (pelo peso das questões da prova) vai para
 * Resultados como correção on-line. Não substitui correção feita pela câmera ou à mão.
 */
export async function saveGameResults(gameId: string): Promise<{ ok: boolean; saved?: number; skipped?: number; error?: string }> {
  const supabase = await createClient();
  const { data: game } = await supabase.from("games").select("id, assessment_id").eq("id", gameId).maybeSingle();
  if (!game?.assessment_id) return { ok: false, error: "Este jogo não está ligado a uma avaliação." };
  const data = await loadAssessment(supabase, game.assessment_id);
  if (!data?.row.class_id) return { ok: false, error: "A avaliação não tem turma." };
  const [{ data: players }, { data: answers }, { data: gq }, { data: existing }] = await Promise.all([
    supabase.from("game_players").select("id, student_ids").eq("game_id", gameId),
    supabase.from("game_answers").select("player_id, idx, answer").eq("game_id", gameId),
    supabase.from("game_questions").select("idx, position").eq("game_id", gameId),
    supabase.from("submissions").select("student_id, source").eq("assessment_id", game.assessment_id),
  ]);
  const positionOf = new Map((gq ?? []).map((q) => [q.idx as number, (q.position as number | null) ?? (q.idx as number) + 1]));
  const key = keyFromQuestions(data.questions);
  const keep = new Set((existing ?? []).filter((s) => s.source === "camera" || s.source === "manual").map((s) => s.student_id as string));

  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const p of players ?? []) {
    const given: Record<number, GivenAnswer> = {};
    for (const a of (answers ?? []).filter((x) => x.player_id === p.id)) given[positionOf.get(a.idx as number) ?? 0] = (a.answer as string) || null;
    const g = gradeSubmission(key, given, { maxScore: data.assessment.max_score, annulPolicy: data.assessment.annul_policy });
    for (const sid of (p.student_ids as string[]) ?? []) {
      if (keep.has(sid)) {
        skipped++;
        continue;
      }
      rows.push({
        assessment_id: game.assessment_id,
        student_id: sid,
        source: "game",
        answers: Object.fromEntries(Object.entries(given).map(([k, v]) => [k, v ?? null])),
        status: "confirmed",
        score: g.score,
        correct_count: g.correctCount,
        confirmed_at: new Date().toISOString(),
      });
    }
  }
  if (rows.length) {
    const { error } = await supabase.from("submissions").upsert(rows, { onConflict: "assessment_id,student_id" });
    if (error) return { ok: false, error: `Não foi possível salvar as notas. (${error.message})` };
  }
  await supabase.from("games").update({ results_saved_at: new Date().toISOString() }).eq("id", gameId);
  revalidatePath("/resultados", "layout");
  return { ok: true, saved: rows.length, skipped };
}

/** Passo da cerimônia (0 = nada revelado, 1 = 3º, 2 = 2º, 3 = campeão). */
export async function setCeremonyStep(gameId: string, step: number) {
  const supabase = await createClient();
  await supabase.from("games").update({ ceremony_step: Math.max(0, Math.min(3, step)) }).eq("id", gameId);
}
