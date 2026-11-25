import { NextResponse } from "next/server";
import { toArrayBuffer } from "@/lib/bytes";
import { createClient } from "@/lib/supabase/server";
import { loadAssessment } from "@/services/assessment-data";
import { generateAssessmentDocx } from "@/lib/docx/assessment-docx";
import { examHeader, fileSlug } from "@/lib/assessment/header";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const data = await loadAssessment(supabase, id);
  if (!data) return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });

  const bytes = await generateAssessmentDocx(examHeader(data.assessment), data.questions);
  return new NextResponse(toArrayBuffer(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileSlug(data.assessment.title)}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
