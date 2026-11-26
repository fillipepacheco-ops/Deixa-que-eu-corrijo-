/**
 * MODO GAME — tipos e chamadas compartilhadas entre o telão (professor) e o celular (aluno).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type GameStatus = "lobby" | "question" | "reveal" | "ranking" | "finished";

export interface GameQuestion {
  idx: number;
  type: "multiple_choice" | "true_false" | "numeric";
  statement: string;
  options: { label: string; text: string }[];
  image_url: string | null;
  time_limit: number;
}

export interface PlayerState {
  game_id: string;
  title: string;
  status: GameStatus;
  index: number;
  count: number;
  team_size: number;
  started_at: string | null;
  server_now: string;
  question: GameQuestion | null;
  correct: string[] | null;
  player: { name: string; members: string[]; score: number; locked: boolean; violations: number; rank: number; players: number };
  answer: { answer: string; correct?: boolean; points?: number } | null;
  top: { name: string; score: number }[] | null;
}

export const channelName = (gameId: string) => `jogo-${gameId}`;

/** Diferença entre o relógio do servidor e o do aparelho (ms), para o tempo ser igual para todos. */
export function clockOffset(serverNowIso: string, sentAt: number, receivedAt: number) {
  const server = new Date(serverNowIso).getTime();
  return server - (sentAt + receivedAt) / 2;
}

/** Segundos que faltam na questão, pelo relógio do servidor. */
export function remainingSeconds(startedAt: string | null, limit: number, offsetMs: number, now = Date.now()) {
  if (!startedAt) return limit;
  const elapsed = (now + offsetMs - new Date(startedAt).getTime()) / 1000;
  return Math.max(0, limit - elapsed);
}

/** Mensagem do banco sem o "prefixo técnico". */
export function rpcError(e: { message?: string } | null | undefined) {
  const m = e?.message ?? "Erro de conexão. Tente de novo.";
  if (/function .* does not exist|schema cache/i.test(m)) return "O modo game ainda não foi ativado no banco (atualização 0006).";
  return m;
}

export async function rpc<T>(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(rpcError(error));
  return data as T;
}
