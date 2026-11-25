import { NextResponse } from "next/server";
import { toArrayBuffer } from "@/lib/bytes";
import { createClient } from "@/lib/supabase/server";
import { loadAssessment, loadStudents } from "@/services/assessment-data";
import { generateAnswerSheetsPdf, type AnswerSheetCard } from "@/lib/pdf/answer-sheet-pdf";
import { sheetQuestionsFrom } from "@/lib/answer-sheet/layout";
import { examHeader, fileSlug } from "@/lib/assessment/header";

export const runtime = "nodejs";

/** Cartões em branco extras (aluno novo, cartão perdido). Sem turma/alunos: um lote em branco. */
const EXTRA_BLANK = 3;
const BLANK_WITHOUT_CLASS = 35;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const data = await loadAssessment(supabase, id);
  if (!data) return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });

  const questions = sheetQuestionsFrom(data.questions);
  if (questions.length === 0) {
    return NextResponse.json({ error: "Cadastre ao menos uma questão objetiva para gerar o cartão-resposta." }, { status: 400 });
  }

  const students = await loadStudents(supabase, data.row.class_id);

  // Reaproveita os cartões já criados (o número do cartão não muda entre downloads).
  const { data: existing } = await supabase
    .from("answer_sheets")
    .select("id, student_id, sheet_number")
    .eq("assessment_id", id)
    .order("sheet_number");
  const sheets = existing ?? [];
  const byStudent = new Map(sheets.filter((s) => s.student_id).map((s) => [s.student_id as string, s.sheet_number as number]));
  const blanks = sheets.filter((s) => !s.student_id).map((s) => s.sheet_number as number);

  const missingStudents = students.filter((s) => !byStudent.has(s.id));
  const blankNeeded = Math.max(0, (students.length ? EXTRA_BLANK : BLANK_WITHOUT_CLASS) - blanks.length);
  const toInsert = [
    ...missingStudents.map((s) => ({ assessment_id: id, student_id: s.id })),
    ...Array.from({ length: blankNeeded }, () => ({ assessment_id: id, student_id: null })),
  ];
  if (toInsert.length) {
    const { data: created, error } = await supabase.from("answer_sheets").insert(toInsert).select("student_id, sheet_number");
    if (error) return NextResponse.json({ error: `Não foi possível criar os cartões. (${error.message})` }, { status: 500 });
    for (const c of created ?? []) {
      if (c.student_id) byStudent.set(c.student_id, c.sheet_number);
      else blanks.push(c.sheet_number);
    }
  }

  const cards: AnswerSheetCard[] = [
    ...students.map((s) => ({ sheetNumber: byStudent.get(s.id)!, studentName: s.name, rollNumber: s.roll_number })),
    ...blanks.slice(0, students.length ? EXTRA_BLANK : BLANK_WITHOUT_CLASS).map((n) => ({ sheetNumber: n })),
  ];

  const h = examHeader(data.assessment);
  const logoRes = await fetch(new URL("/brand/logo.png", request.url)).catch(() => null);
  const logoPng = logoRes?.ok ? new Uint8Array(await logoRes.arrayBuffer()) : null;

  const bytes = await generateAnswerSheetsPdf({
    assessmentTitle: h.title,
    subject: h.subject,
    className: h.className,
    schoolName: h.schoolName,
    appliedOn: h.appliedOn,
    questions,
    cards,
    logoPng,
  });
  return new NextResponse(toArrayBuffer(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="cartoes-${fileSlug(h.title)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
