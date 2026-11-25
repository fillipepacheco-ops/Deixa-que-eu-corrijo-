import { NextResponse } from "next/server";
import { toArrayBuffer } from "@/lib/bytes";
import { createClient } from "@/lib/supabase/server";
import { loadAssessment, loadSchoolLogo, loadStudents } from "@/services/assessment-data";
import { generateAssessmentPdf, generateExamCopiesPdf } from "@/lib/pdf/assessment-pdf";
import { fileSlug } from "@/lib/assessment/header";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ?modo=alunos → uma prova por aluno da turma (nome e nº na capa), num só PDF.
 * ?modo=branco → uma prova com o nome em branco.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const modo = new URL(request.url).searchParams.get("modo") ?? "branco";
  const supabase = await createClient();
  const data = await loadAssessment(supabase, id);
  if (!data) return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });

  const schoolLogo = await loadSchoolLogo(supabase, data.row.school_logo_path);
  const base = { assessment: data.assessment, questions: data.questions, schoolLogo };
  const slug = fileSlug(data.assessment.title);

  let bytes: Uint8Array;
  let filename = `${slug}.pdf`;
  if (modo === "alunos") {
    const students = await loadStudents(supabase, data.row.class_id);
    if (students.length === 0) {
      return NextResponse.json({ error: "A turma desta avaliação não tem alunos cadastrados." }, { status: 400 });
    }
    bytes = (await generateExamCopiesPdf(base, students.map((s) => ({ name: s.name, rollNumber: s.roll_number })))).bytes;
    filename = `${slug}-por-aluno.pdf`;
  } else {
    bytes = (await generateAssessmentPdf(base)).bytes;
  }

  return new NextResponse(toArrayBuffer(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
