import { NextResponse } from "next/server";
import { toArrayBuffer } from "@/lib/bytes";
import { createClient } from "@/lib/supabase/server";
import { normalizeFormat } from "@/lib/results/diary";
import { exportClass } from "@/services/results-export";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ?tipo=pdf|planilha &ids=a,b,c &juntar=soma|media &formato=<json> */
export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const q = new URL(request.url).searchParams;
  const kind = q.get("tipo") === "planilha" ? "planilha" : "pdf";
  const ids = q.get("ids") ? q.get("ids")!.split(",").filter(Boolean) : null;
  const combine = q.get("juntar") === "media" ? "media" : "soma";
  let fmt = null;
  try {
    fmt = q.get("formato") ? normalizeFormat(JSON.parse(q.get("formato")!)) : null;
  } catch {
    fmt = null;
  }
  try {
    const file = await exportClass(await createClient(), classId, ids, combine, kind, fmt);
    if (!file) return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 });
    return new NextResponse(toArrayBuffer(file.bytes), {
      headers: { "Content-Type": file.mime, "Content-Disposition": `inline; filename="${file.filename}"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao gerar o arquivo." }, { status: 500 });
  }
}
