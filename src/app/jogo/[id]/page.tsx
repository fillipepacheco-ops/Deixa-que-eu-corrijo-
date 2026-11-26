import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GameHost } from "@/components/game/GameHost";
import type { GameQuestion, GameStatus } from "@/lib/game/client";

export const metadata: Metadata = { title: "Modo Game — telão" };

/** Telão do professor (para o data show). */
export default async function JogoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("id, title, pin, team_size, status, current_index, question_started_at, question_count")
    .eq("id", id)
    .maybeSingle();
  if (!game) notFound();
  const [{ data: qs }, { data: ks }] = await Promise.all([
    supabase.from("game_questions").select("idx, type, statement, options, image_url, time_limit").eq("game_id", id).order("idx"),
    supabase.from("game_keys").select("idx, correct").eq("game_id", id),
  ]);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "deixa-que-eu-corrijo.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";

  return (
    <GameHost
      game={{ ...game, status: game.status as GameStatus } as Parameters<typeof GameHost>[0]["game"]}
      questions={(qs ?? []) as GameQuestion[]}
      keys={Object.fromEntries((ks ?? []).map((k) => [k.idx as number, k.correct as string[]]))}
      joinUrl={`${proto}://${host}/jogar`}
    />
  );
}
