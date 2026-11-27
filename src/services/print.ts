/**
 * IMPRESSÃO — prova e cartão-resposta para a turma toda ou um aluno.
 * Usado pelas rotas de PDF (servidor).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { generateAnswerSheetsPdf, type AnswerSheetCard } from "@/lib/pdf/answer-sheet-pdf";
import { generateAssessmentPdf } from "@/lib/pdf/assessment-pdf";
import { LAYOUT_VERSION, sheetQuestionsFrom } from "@/lib/answer-sheet/layout";
import { examHeader } from "@/lib/assessment/header";
import { attachQuestionImages, loadAssessment, loadSchoolLogo, loadStudents } from "./assessment-data";
import { questionsForVersion, versionForIndex, versionLabel, versionOrders } from "@/lib/versions/versions";

/** Cartões em branco extras (aluno novo, cartão perdido). Sem turma: um lote em branco. */
export const EXTRA_BLANK = 3;
export const BLANK_WITHOUT_CLASS = 35;

export class PrintError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

type Student = { id: string; name: string; roll_number: number | null };

/** Garante um cartão (número fixo) por aluno e o lote de cartões em branco.
 *  Com versões, cada cartão guarda a versão da prova do aluno (A, B, C, D pela ordem de chamada). */
export async function ensureCards(
  supabase: SupabaseClient,
  assessmentId: string,
  students: Student[],
  blankCount: number,
  opts: { versions?: number; classOrder?: Student[] } = {},
): Promise<{ byStudent: Map<string, Card>; blanks: Card[] }> {
  const versions = opts.versions ?? 1;
  const order = opts.classOrder ?? students;
  const { data: existing } = await supabase
    .from("answer_sheets")
    .select("*")
    .eq("assessment_id", assessmentId)
    .order("sheet_number");
  type Row = { student_id: string | null; sheet_number: number; version?: number | null };
  const card = (r: Row): Card => ({ number: r.sheet_number, version: Math.min(versions - 1, Math.max(0, r.version ?? 0)) });
  const sheets = (existing ?? []) as Row[];
  const byStudent = new Map(sheets.filter((s) => s.student_id).map((s) => [s.student_id as string, card(s)]));
  const blanks = sheets.filter((s) => !s.student_id).map(card);

  const withVersion = <T extends object>(row: T, v: number) => ({ ...(versions > 1 ? { ...row, version: v } : row), layout_version: LAYOUT_VERSION });
  const missingBlanks = Math.max(0, blankCount - blanks.length);
  const toInsert = [
    ...students
      .filter((s) => !byStudent.has(s.id))
      .map((s) => withVersion({ assessment_id: assessmentId, student_id: s.id }, versionForIndex(Math.max(0, order.findIndex((o) => o.id === s.id)), versions))),
    ...Array.from({ length: missingBlanks }, (_, k) => withVersion({ assessment_id: assessmentId, student_id: null }, versionForIndex(blanks.length + k, versions))),
  ];
  if (toInsert.length) {
    const { data: created, error } = await supabase.from("answer_sheets").insert(toInsert).select("*");
    if (error) throw new PrintError(`Não foi possível criar os cartões. (${error.message})`, 500);
    for (const c of (created ?? []) as Row[]) {
      if (c.student_id) byStudent.set(c.student_id, card(c));
      else blanks.push(card(c));
    }
  }
  return { byStudent, blanks };
}

type Card = { number: number; version: number };

export type PrintDoc = "prova" | "cartao" | "kit";

/**
 * Monta o PDF pedido:
 *  - prova:  uma prova por aluno (nome na capa) — ou em branco se `blank` (uma de cada versão);
 *  - cartao: um cartão por aluno (+ extras em branco quando for a turma toda);
 *  - kit:    para cada aluno, a prova seguida do cartão (um pacote por aluno).
 * `studentId`/`studentIds` limitam aos alunos escolhidos.
 * Com versões (A–D), cada aluno recebe a prova e o cartão da sua versão.
 */
export async function buildPrintPdf(
  supabase: SupabaseClient,
  assessmentId: string,
  opts: { doc: PrintDoc; studentId?: string | null; studentIds?: string[] | null; blank?: boolean; appLogo?: Uint8Array | null; version?: number | null },
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

  // versões: ordem das questões de cada uma (A = original)
  const versions = data.assessment.versions ?? 1;
  const orders = versionOrders(data.questions, versions, assessmentId);
  const questionsOf = (v: number) => (versions > 1 ? questionsForVersion(data.questions, orders[v] ?? orders[0]) : data.questions);
  const assessmentOf = (v: number) =>
    versions > 1 ? { ...data.assessment, title: `${data.assessment.title} — Versão ${versionLabel(v)}`, version: v } : data.assessment;

  const needsExam = opts.doc === "prova" || opts.doc === "kit";
  const needsCards = opts.doc === "cartao" || opts.doc === "kit" || (versions > 1 && opts.doc === "prova" && !opts.blank && students.length > 0);

  const schoolLogo = await loadSchoolLogo(supabase, data.row.school_logo_path);
  let examFor: ((name: string | null, roll: number | null, v: number) => Promise<Uint8Array>) | null = null;
  if (needsExam) {
    await attachQuestionImages(supabase, data.questions);
    examFor = async (name, roll, v) =>
      (
        await generateAssessmentPdf({
          assessment: assessmentOf(v),
          questions: questionsOf(v),
          schoolLogo,
          student: name ? { name, rollNumber: roll } : null,
        })
      ).bytes;
  }

  const specs = sheetQuestionsFrom(data.questions);
  let cardsFor: ((cards: AnswerSheetCard[], v: number) => Promise<Uint8Array>) | null = null;
  let cardOf = new Map<string, Card>();
  let blanks: Card[] = [];
  const markPrinted = async (numbers: number[]) => {
    // estes cartões saem no desenho atual (v4): a câmera passa a ler neste desenho
    if (numbers.length) await supabase.from("answer_sheets").update({ layout_version: LAYOUT_VERSION }).eq("assessment_id", assessmentId).in("sheet_number", numbers);
  };
  if (needsCards) {
    if (!specs.length && opts.doc !== "prova") throw new PrintError("Cadastre ao menos uma questão objetiva para gerar o cartão-resposta.");
    const blankCount = opts.doc === "prova" ? 0 : wholeClass ? (all.length ? EXTRA_BLANK : BLANK_WITHOUT_CLASS) : 0;
    const r = await ensureCards(supabase, assessmentId, students, blankCount, { versions, classOrder: all });
    cardOf = r.byStudent;
    blanks = r.blanks.slice(0, blankCount);
    // O cartão é igual para todas as versões: o aluno pinta a VERSÃO DA PROVA que recebeu
    // (funciona com cópias xerox sem nome). Na prova com nome, a capa diz qual letra pintar.
    cardsFor = (cards, v) => {
      const h = examHeader(data.assessment);
      return generateAnswerSheetsPdf({
        assessmentTitle: h.title,
        subject: h.subject,
        className: h.className,
        schoolName: h.schoolName,
        appliedOn: h.appliedOn,
        questions: sheetQuestionsFrom(questionsOf(v)),
        versions,
        cards,
        logoPng: opts.appLogo ?? null,
        schoolLogo,
      });
    };
  }
  const versionOf = (studentId: string) => cardOf.get(studentId)?.version ?? 0;

  const merged = await PDFDocument.create();
  merged.setTitle(data.assessment.title);
  merged.setCreator("Deixa que eu Corrijo");
  const append = async (bytes: Uint8Array) => {
    const src = await PDFDocument.load(bytes);
    (await merged.copyPages(src, src.getPageIndices())).forEach((p) => merged.addPage(p));
  };
  /** Cartões em sequência, agrupando os vizinhos da mesma versão num só PDF. */
  const appendCards = async (list: { card: AnswerSheetCard; v: number }[]) => {
    for (let i = 0; i < list.length; ) {
      let j = i;
      while (j < list.length && list[j].v === list[i].v) j++;
      await append(await cardsFor!(list.slice(i, j).map((x) => x.card), list[i].v));
      i = j;
    }
  };

  if (opts.doc !== "prova") {
    await markPrinted([...students.map((s) => cardOf.get(s.id)?.number).filter((n): n is number => !!n), ...blanks.map((b) => b.number)]);
  }

  if (opts.doc === "prova") {
    if (opts.blank || students.length === 0) {
      const only = opts.version !== null && opts.version !== undefined && opts.version < versions ? [opts.version] : null;
      for (const v of only ?? Array.from({ length: versions }, (_, k) => k)) await append(await examFor!(null, null, v));
    } else for (const s of students) await append(await examFor!(s.name, s.roll_number, versionOf(s.id)));
  } else if (opts.doc === "cartao") {
    await appendCards([
      ...students.map((s) => ({ card: { sheetNumber: cardOf.get(s.id)!.number, studentName: s.name, rollNumber: s.roll_number }, v: versionOf(s.id) })),
      ...blanks.map((b) => ({ card: { sheetNumber: b.number }, v: b.version })),
    ]);
  } else {
    if (students.length === 0) throw new PrintError("A avaliação precisa de uma turma com alunos para montar prova + cartão por aluno.");
    for (const s of students) {
      const v = versionOf(s.id);
      await append(await examFor!(s.name, s.roll_number, v));
      await append(await cardsFor!([{ sheetNumber: cardOf.get(s.id)!.number, studentName: s.name, rollNumber: s.roll_number }], v));
    }
  }
  return merged.save();
}
