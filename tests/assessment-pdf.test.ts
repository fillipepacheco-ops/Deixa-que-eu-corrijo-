import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { generateAssessmentPdf, TEMPLATES } from "../src/lib/pdf/assessment-pdf";
import type { PdfTemplate } from "../src/lib/models/types";
import { sampleAssessment, sampleQuestions } from "./fixtures/sample-assessment";

const templates: PdfTemplate[] = ["escolar", "simulado", "larga_escala", "personalizado"];

for (const t of templates) {
  test(`geração de PDF A4 — modelo ${t}`, async () => {
    const r = await generateAssessmentPdf({ assessment: sampleAssessment(t), questions: sampleQuestions(14) });
    const doc = await PDFDocument.load(r.bytes);
    assert.equal(doc.getPageCount(), r.pageCount);
    assert.ok(r.pageCount >= 1);
    for (const p of doc.getPages()) {
      const { width, height } = p.getSize();
      assert.ok(Math.abs(width - 595.28) < 1 && Math.abs(height - 841.89) < 1);
    }
    // Todas as 14 questões numeradas e em ordem de página.
    const pages = Object.entries(r.questionPages).map(([n, p]) => [+n, p]);
    assert.equal(pages.length, 14);
    for (let i = 1; i < pages.length; i++) assert.ok(pages[i][1] >= pages[i - 1][1]);
  });
}

test("prova longa quebra páginas sem perder questões", async () => {
  const r = await generateAssessmentPdf({ assessment: sampleAssessment("escolar"), questions: sampleQuestions(40) });
  assert.ok(r.pageCount >= 4, `páginas: ${r.pageCount}`);
  assert.equal(Object.keys(r.questionPages).length, 40);
});

test("2 colunas usa menos páginas que 1 coluna", async () => {
  const qs = sampleQuestions(30);
  const one = await generateAssessmentPdf({ assessment: sampleAssessment("escolar"), questions: qs });
  const two = await generateAssessmentPdf({ assessment: sampleAssessment("simulado"), questions: qs });
  assert.ok(two.pageCount < one.pageCount);
});

test("modelo personalizado aceita ajustes", async () => {
  const qs = sampleQuestions(10);
  const r = await generateAssessmentPdf({
    assessment: sampleAssessment("personalizado"),
    questions: qs,
    customTemplate: { columns: 2, fontSize: 9, showSignature: false },
  });
  assert.ok(r.pageCount >= 1);
  assert.equal(TEMPLATES.escolar.columns, 1, "padrão não foi alterado");
});

test("caracteres fora da fonte (símbolos, emoji) não quebram o PDF", async () => {
  const a = sampleAssessment("escolar");
  const r = await generateAssessmentPdf({
    assessment: { ...a, title: "Prova ≤ ≥ √ π 🚀 — ação, coração" },
    questions: [{
      position: 1, type: "multiple_choice", weight: 1, annulled: false, correct_answers: ["A"],
      statement: "Se x ≠ 0 e √x = π, então…", options: [{ label: "A", text: "∞" }, { label: "B", text: "−1" }],
    }],
  });
  assert.equal(r.pageCount, 1);
});

test("enunciado gigante (maior que a página) é quebrado em vez de travar", async () => {
  const huge = Array.from({ length: 400 }, () => "texto").join(" ");
  const r = await generateAssessmentPdf({
    assessment: sampleAssessment("escolar"),
    questions: [{ position: 1, type: "essay", weight: 1, annulled: false, correct_answers: [], options: [], statement: huge.repeat(4) }],
  });
  assert.ok(r.pageCount >= 2);
});
