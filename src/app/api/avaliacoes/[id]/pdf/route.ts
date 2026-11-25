import { NextResponse } from "next/server";
import { toArrayBuffer } from "@/lib/bytes";
import { createClient } from "@/lib/supabase/server";
import { loadAssessment } from "@/services/assessment-data";
import { generateAssessmentPdf } from "@/lib/pdf/assessment-pdf";
import { fileSlug } from "@/lib/assessment/header";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const data = await loadAssessment(supabase, id);
  if (!data) return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });

  const { bytes } = await generateAssessmentPdf({ assessment: data.assessment, questions: data.questions });
  return new NextResponse(toArrayBuffer(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileSlug(data.assessment.title)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
