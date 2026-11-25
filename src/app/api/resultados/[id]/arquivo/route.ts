import { NextResponse } from "next/server";
import { toArrayBuffer } from "@/lib/bytes";
import { createClient } from "@/lib/supabase/server";
import { normalizeFormat } from "@/lib/results/diary";
import { exportAssessment } from "@/services/results-export";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ?tipo=pdf|planilha &formato=<json do formato do diário mostrado na tela> */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(request.url).searchParams;
  const kind = q.get("tipo") === "planilha" ? "planilha" : "pdf";
  let fmt = null;
  try {
    fmt = q.get("formato") ? normalizeFormat(JSON.parse(q.get("formato")!)) : null;
  } catch {
    fmt = null;
  }
  try {
    const file = await exportAssessment(await createClient(), id, kind, fmt);
    if (!file) return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });
    return new NextResponse(toArrayBuffer(file.bytes), {
      headers: { "Content-Type": file.mime, "Content-Disposition": `inline; filename="${file.filename}"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao gerar o arquivo." }, { status: 500 });
  }
}
