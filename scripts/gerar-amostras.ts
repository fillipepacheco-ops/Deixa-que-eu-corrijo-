/**
 * Gera PDFs de amostra em ./amostras (prova nos 4 modelos + cartões-resposta).
 * Uso: npm run samples
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { generateAssessmentPdf, generateExamCopiesPdf } from "../src/lib/pdf/assessment-pdf";
import { generateAnswerSheetsPdf } from "../src/lib/pdf/answer-sheet-pdf";
import { sheetQuestionsFrom } from "../src/lib/answer-sheet/layout";
import type { PdfTemplate } from "../src/lib/models/types";
import { sampleAssessment, sampleQuestions } from "../tests/fixtures/sample-assessment";
import { generateAssessmentDocx } from "../src/lib/docx/assessment-docx";
import { examHeader } from "../src/lib/assessment/header";

async function main() {
  mkdirSync("amostras", { recursive: true });
  const questions = sampleQuestions(14);
  for (const t of ["escolar", "simulado", "larga_escala", "personalizado"] as PdfTemplate[]) {
    const r = await generateAssessmentPdf({ assessment: sampleAssessment(t), questions });
    writeFileSync(`amostras/prova-${t}.pdf`, r.bytes);
    console.log(`prova-${t}.pdf — ${r.pageCount} página(s)`);
  }
  const larga = sampleAssessment("larga_escala");
  const logoEscola = readFileSync("tests/fixtures/logo-escola-exemplo.jpg");
  writeFileSync(
    "amostras/prova-larga_escala.docx",
    await generateAssessmentDocx(examHeader({ ...larga, instructions: null }), questions, { schoolLogo: logoEscola }),
  );
  const porAluno = await generateExamCopiesPdf({ assessment: { ...larga, instructions: null }, questions, schoolLogo: logoEscola }, [
    { name: "Ana Beatriz Souza", rollNumber: 1 },
    { name: "João Pedro Lima", rollNumber: 2 },
  ]);
  writeFileSync("amostras/provas-por-aluno.pdf", porAluno.bytes);
  console.log("provas-por-aluno.pdf");
  console.log("prova-larga_escala.docx");
  const a = sampleAssessment("escolar");
  const cards = await generateAnswerSheetsPdf({
    assessmentTitle: a.title,
    subject: a.subject,
    className: a.class_name,
    schoolName: a.school_name,
    appliedOn: a.applied_on,
    questions: sheetQuestionsFrom(questions),
    logoPng: readFileSync("public/brand/logo.png"),
    cards: [
      { sheetNumber: 1001, studentName: "Ana Beatriz Souza", rollNumber: 1 },
      { sheetNumber: 1002 },
    ],
  });
  writeFileSync("amostras/cartoes-resposta.pdf", cards);
  console.log("cartoes-resposta.pdf — 2 cartões");
}

main();
