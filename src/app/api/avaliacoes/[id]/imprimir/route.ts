import { NextResponse } from "next/server";
import { toArrayBuffer } from "@/lib/bytes";
import { createClient } from "@/lib/supabase/server";
import { buildPrintPdf, PrintError, type PrintDoc } from "@/services/print";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * /api/avaliacoes/:id/imprimir?doc=prova|cartao|kit[&aluno=<id>][&branco=1]
 * Turma toda (sem "aluno") ou só os alunos escolhidos (aluno=id1,id2,...).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(request.url).searchParams;
  const doc = (["prova", "cartao", "kit"].includes(q.get("doc") ?? "") ? q.get("doc") : "prova") as PrintDoc;
  const supabase = await createClient();
  try {
    const logoRes = doc === "prova" ? null : await fetch(new URL("/brand/logo.png", request.url)).catch(() => null);
    const appLogo = logoRes?.ok ? new Uint8Array(await logoRes.arrayBuffer()) : null;
    const bytes = await buildPrintPdf(supabase, id, { doc, studentIds: (q.get("aluno") ?? "").split(",").filter(Boolean), blank: q.get("branco") === "1", appLogo });
    return new NextResponse(toArrayBuffer(bytes), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "no-store" },
    });
  } catch (e) {
    const status = e instanceof PrintError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao gerar o PDF." }, { status });
  }
}
