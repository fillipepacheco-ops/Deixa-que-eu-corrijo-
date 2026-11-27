import { NextResponse } from "next/server";
import { toArrayBuffer } from "@/lib/bytes";
import { createClient } from "@/lib/supabase/server";
import { attachQuestionImages, loadAssessment, loadSchoolLogo } from "@/services/assessment-data";
import { generateAssessmentDocx } from "@/lib/docx/assessment-docx";
import { examHeader, fileSlug } from "@/lib/assessment/header";
import { parseVersion, questionsForVersion, versionLabel, versionOrders } from "@/lib/versions/versions";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const data = await loadAssessment(supabase, id);
  if (!data) return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });
  await attachQuestionImages(supabase, data.questions);

  const schoolLogo = await loadSchoolLogo(supabase, data.row.school_logo_path);
  // Com versões: ?versao=B baixa a versão B (padrão: A).
  const versions = data.assessment.versions ?? 1;
  const v = Math.min(versions - 1, parseVersion(new URL(request.url).searchParams.get("versao")) ?? 0);
  const assessment = versions > 1 ? { ...data.assessment, title: `${data.assessment.title} — Versão ${versionLabel(v)}`, version: v } : data.assessment;
  const questions = versions > 1 ? questionsForVersion(data.questions, versionOrders(data.questions, versions, id)[v]) : data.questions;
  const bytes = await generateAssessmentDocx(examHeader(assessment), questions, { schoolLogo });
  return new NextResponse(toArrayBuffer(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileSlug(assessment.title)}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
