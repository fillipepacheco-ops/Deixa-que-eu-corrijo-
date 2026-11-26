"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { newPin } from "@/lib/game/scoring";
import { tidyText } from "@/lib/assessment/tidy-text";
import { loadAssessment } from "./assessment-data";

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
  const timeLimit = Math.min(300, Math.max(5, Number(formData.get("time_limit")) || 20));

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
