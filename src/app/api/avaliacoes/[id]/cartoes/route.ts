import { NextResponse } from "next/server";
import { toArrayBuffer } from "@/lib/bytes";
import { createClient } from "@/lib/supabase/server";
import { buildPrintPdf, PrintError } from "@/services/print";

export const runtime = "nodejs";

/** Cartões-resposta da turma toda (+ extras em branco) ou de um aluno (?aluno=<id>). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  try {
    const logoRes = await fetch(new URL("/brand/logo.png", request.url)).catch(() => null);
    const appLogo = logoRes?.ok ? new Uint8Array(await logoRes.arrayBuffer()) : null;
    const bytes = await buildPrintPdf(supabase, id, { doc: "cartao", studentIds: (new URL(request.url).searchParams.get("aluno") ?? "").split(",").filter(Boolean), appLogo });
    return new NextResponse(toArrayBuffer(bytes), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "no-store" },
    });
  } catch (e) {
    const status = e instanceof PrintError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao gerar os cartões." }, { status });
  }
}
