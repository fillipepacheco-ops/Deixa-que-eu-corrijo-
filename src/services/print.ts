/**
 * IMPRESSÃO — prova e cartão-resposta para a turma toda ou um aluno.
 * Usado pelas rotas de PDF (servidor).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { generateAnswerSheetsPdf, type AnswerSheetCard } from "@/lib/pdf/answer-sheet-pdf";
import { generateAssessmentPdf } from "@/lib/pdf/assessment-pdf";
import { sheetQuestionsFrom } from "@/lib/answer-sheet/layout";
import { examHeader } from "@/lib/assessment/header";
import { attachQuestionImages, loadAssessment, loadSchoolLogo, loadStudents } from "./assessment-data";

/** Cartões em branco extras (aluno novo, cartão perdido). Sem turma: um lote em branco. */
export const EXTRA_BLANK = 3;
export const BLANK_WITHOUT_CLASS = 35;

export class PrintError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

type Student = { id: string; name: string; roll_number: number | null };

/** Garante um cartão (número fixo) por aluno e o lote de cartões em branco. */
export async function ensureCards(
  supabase: SupabaseClient,
  assessmentId: string,
  students: Student[],
  blankCount: number,
): Promise<{ byStudent: Map<string, number>; blanks: number[] }> {
  const { data: existing } = await supabase
    .from("answer_sheets")
    .select("student_id, sheet_number")
    .eq("assessment_id", assessmentId)
    .order("sheet_number");
  const sheets = existing ?? [];
  const byStudent = new Map(sheets.filter((s) => s.student_id).map((s) => [s.student_id as string, s.sheet_number as number]));
  const blanks = sheets.filter((s) => !s.student_id).map((s) => s.sheet_number as number);

  const toInsert = [
    ...students.filter((s) => !byStudent.has(s.id)).map((s) => ({ assessment_id: assessmentId, student_id: s.id })),
    ...Array.from({ length: Math.max(0, blankCount - blanks.length) }, () => ({ assessment_id: assessmentId, student_id: null })),
  ];
  if (toInsert.length) {
    const { data: created, error } = await supabase.from("answer_sheets").insert(toInsert).select("student_id, sheet_number");
    if (error) throw new PrintError(`Não foi possível criar os cartões. (${error.message})`, 500);
    for (const c of created ?? []) {
      if (c.student_id) byStudent.set(c.student_id, c.sheet_number);
      else blanks.push(c.sheet_number);
    }
  }
  return { byStudent, blanks };
}

export type PrintDoc = "prova" | "cartao" | "kit";

/**
 * Monta o PDF pedido:
 *  - prova:  uma prova por aluno (nome na capa) — ou em branco se `blank`;
 *  - cartao: um cartão por aluno (+ extras em branco quando for a turma toda);
 *  - kit:    para cada aluno, a prova seguida do cartão (um pacote por aluno).
 * `studentId`/`studentIds` limitam aos alunos escolhidos.
 */
export async function buildPrintPdf(
  supabase: SupabaseClient,
  assessmentId: string,
  opts: { doc: PrintDoc; studentId?: string | null; studentIds?: string[] | null; blank?: boolean; appLogo?: Uint8Array | null },
): Promise<Uint8Array> {
  const data = await loadAssessment(supabase, assessmentId);
  if (!data) throw new PrintError("Avaliação não encontrada.", 404);
  if (data.questions.length === 0) throw new PrintError("Adicione questões antes de imprimir.");

  const all = await loadStudents(supabase, data.row.class_id);
  // um aluno, alguns alunos escolhidos ou a turma toda
  const chosen = [...(opts.studentIds ?? []), ...(opts.studentId ? [opts.studentId] : [])].filter(Boolean);
  let students = all;
  if (chosen.length) {
    students = all.filter((s) => chosen.includes(s.id));
    if (!students.length) throw new PrintError("Aluno não encontrado nesta turma.");
  }
  const wholeClass = chosen.length === 0;

  const needsExam = opts.doc === "prova" || opts.doc === "kit";
  const needsCards = opts.doc === "cartao" || opts.doc === "kit";

  let examFor: ((name: string | null, roll: number | null) => Promise<Uint8Array>) | null = null;
  if (needsExam) {
    await attachQuestionImages(supabase, data.questions);
    const schoolLogo = await loadSchoolLogo(supabase, data.row.school_logo_path);
    examFor = async (name, roll) =>
      (
        await generateAssessmentPdf({
          assessment: data.assessment,
          questions: data.questions,
          schoolLogo,
          student: name ? { name, rollNumber: roll } : null,
        })
      ).bytes;
  }

  const specs = sheetQuestionsFrom(data.questions);
  let cardsFor: ((cards: AnswerSheetCard[]) => Promise<Uint8Array>) | null = null;
  let cardOf = new Map<string, number>();
  let blanks: number[] = [];
  if (needsCards) {
    if (!specs.length) throw new PrintError("Cadastre ao menos uma questão objetiva para gerar o cartão-resposta.");
    const blankCount = wholeClass ? (all.length ? EXTRA_BLANK : BLANK_WITHOUT_CLASS) : 0;
    const r = await ensureCards(supabase, assessmentId, students, blankCount);
    cardOf = r.byStudent;
    blanks = r.blanks.slice(0, blankCount);
    const h = examHeader(data.assessment);
    const schoolLogo = await loadSchoolLogo(supabase, data.row.school_logo_path);
    cardsFor = (cards) =>
      generateAnswerSheetsPdf({
        assessmentTitle: h.title,
        subject: h.subject,
        className: h.className,
        schoolName: h.schoolName,
        appliedOn: h.appliedOn,
        questions: specs,
        cards,
        logoPng: opts.appLogo ?? null,
        schoolLogo,
      });
  }

  const merged = await PDFDocument.create();
  merged.setTitle(data.assessment.title);
  merged.setCreator("Deixa que eu Corrijo");
  const append = async (bytes: Uint8Array) => {
    const src = await PDFDocument.load(bytes);
    (await merged.copyPages(src, src.getPageIndices())).forEach((p) => merged.addPage(p));
  };

  if (opts.doc === "prova") {
    if (opts.blank || students.length === 0) await append(await examFor!(null, null));
    else for (const s of students) await append(await examFor!(s.name, s.roll_number));
  } else if (opts.doc === "cartao") {
    await append(
      await cardsFor!([
        ...students.map((s) => ({ sheetNumber: cardOf.get(s.id)!, studentName: s.name, rollNumber: s.roll_number })),
        ...blanks.map((n) => ({ sheetNumber: n })),
      ]),
    );
  } else {
    if (students.length === 0) throw new PrintError("A avaliação precisa de uma turma com alunos para montar prova + cartão por aluno.");
    for (const s of students) {
      await append(await examFor!(s.name, s.roll_number));
      await append(await cardsFor!([{ sheetNumber: cardOf.get(s.id)!, studentName: s.name, rollNumber: s.roll_number }]));
    }
  }
  return merged.save();
}
