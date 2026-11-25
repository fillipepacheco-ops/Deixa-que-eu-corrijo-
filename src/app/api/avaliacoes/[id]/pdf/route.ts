import { NextResponse } from "next/server";
import { toArrayBuffer } from "@/lib/bytes";
import { createClient } from "@/lib/supabase/server";
import { buildPrintPdf, PrintError } from "@/services/print";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ?modo=alunos → uma prova por aluno (nome e nº na capa); &aluno=<id> → só esse aluno.
 * ?modo=branco → uma prova com o nome em branco.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(request.url).searchParams;
  const supabase = await createClient();
  try {
    const bytes = await buildPrintPdf(supabase, id, { doc: "prova", blank: q.get("modo") !== "alunos", studentId: q.get("aluno") });
    return new NextResponse(toArrayBuffer(bytes), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "no-store" },
    });
  } catch (e) {
    const status = e instanceof PrintError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao gerar a prova." }, { status });
  }
}
