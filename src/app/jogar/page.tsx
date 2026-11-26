import type { Metadata, Viewport } from "next";
import { GamePlayer } from "@/components/game/GamePlayer";

export const metadata: Metadata = { title: "Modo Game — entrar" };
export const viewport: Viewport = { themeColor: "#3b1477", width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover" };

/** Celular do aluno no modo game (não precisa de login). */
export default async function JogarPage({ searchParams }: { searchParams: Promise<{ pin?: string }> }) {
  const { pin } = await searchParams;
  return <GamePlayer initialPin={(pin ?? "").replace(/\D/g, "").slice(0, 6)} />;
}
