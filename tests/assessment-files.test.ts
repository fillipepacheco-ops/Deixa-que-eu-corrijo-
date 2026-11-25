import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { generateAssessmentDocx } from "../src/lib/docx/assessment-docx";
import { DEFAULT_INSTRUCTIONS, examHeader, fileSlug, parseInstructions } from "../src/lib/assessment/header";
import { parseQuestionForm } from "../src/lib/assessment/question-form";
import { generateAssessmentPdf, generateExamCopiesPdf } from "../src/lib/pdf/assessment-pdf";
import { PDFDocument } from "pdf-lib";
import { readFileSync } from "node:fs";
import { sampleAssessment, sampleQuestions } from "./fixtures/sample-assessment";

function form(entries: [string, string][]) {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

test("Word: Arial 12, justificado, espaçamento 1,5, capa e numeração QUESTÃO 01", async () => {
  const h = examHeader({ ...sampleAssessment("larga_escala"), instructions: null });
  const bytes = await generateAssessmentDocx(h, sampleQuestions(6));
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")!.async("string");
  const styles = await zip.file("word/styles.xml")!.async("string");
  assert.match(styles, /w:ascii="Arial"/);
  assert.match(styles, /<w:sz w:val="24"\/>/); // 12 pt
  assert.match(xml, /<w:jc w:val="both"\/>/); // justificado
  assert.match(xml, /w:line="360"/); // 1,5
  assert.match(xml, /QUESTÃO 01/);
  assert.match(xml, /QUESTÃO 06/);
  assert.match(xml, /INSTRUÇÕES/);
  assert.match(xml, /Escola de Exemplo|ESCOLA DE EXEMPLO/);
  assert.match(xml, /02\/12\/2026/);
  assert.match(xml, /<w:cols[^>]*w:num="2"/); // questões em duas colunas
  for (const i of DEFAULT_INSTRUCTIONS) assert.ok(xml.includes(i.slice(0, 30)), "instrução padrão na capa");
});

test("Word personalizado: logo da escola e nome do aluno na capa", async () => {
  const h = examHeader(sampleAssessment("larga_escala"));
  const logo = new Uint8Array(readFileSync("tests/fixtures/logo-escola-exemplo.jpg"));
  const bytes = await generateAssessmentDocx(h, sampleQuestions(2), { schoolLogo: logo, student: { name: "Ana Beatriz Souza", rollNumber: 1 } });
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")!.async("string");
  assert.match(xml, /Ana Beatriz Souza/);
  assert.ok(Object.keys(zip.files).some((f) => f.startsWith("word/media/")), "logo embutida");
});

test("PDF: uma prova por aluno, com nome na capa, num único arquivo", async () => {
  const logo = new Uint8Array(readFileSync("tests/fixtures/logo-escola-exemplo.jpg"));
  const one = await generateAssessmentPdf({ assessment: sampleAssessment("larga_escala"), questions: sampleQuestions(4), schoolLogo: logo });
  const all = await generateExamCopiesPdf(
    { assessment: sampleAssessment("larga_escala"), questions: sampleQuestions(4), schoolLogo: logo },
    [{ name: "Ana", rollNumber: 1 }, { name: "João", rollNumber: 2 }, { name: "Maria", rollNumber: 3 }],
  );
  const doc = await PDFDocument.load(all.bytes);
  assert.equal(doc.getPageCount(), one.pageCount * 3);
});

test("PDF larga escala: capa + questões a partir da página 2", async () => {
  const r = await generateAssessmentPdf({ assessment: sampleAssessment("larga_escala"), questions: sampleQuestions(4) });
  assert.ok(r.pageCount >= 2);
  assert.equal(r.questionPages[1], 2);
});

test("capa e cartão usam os mesmos dados do cabeçalho", () => {
  const a = sampleAssessment("larga_escala");
  const h = examHeader(a);
  assert.equal(h.title, a.title);
  assert.equal(h.className, "9º A");
  assert.equal(h.schoolName, "Escola de Exemplo");
});

test("instruções: uma por linha, numeração removida se o professor digitar", () => {
  assert.deepEqual(parseInstructions("1. Leia tudo\n\n2) Use caneta\n- Não rasure"), ["Leia tudo", "Use caneta", "Não rasure"]);
  assert.equal(examHeader({ ...sampleAssessment("larga_escala"), instructions: "" }).instructions.length, DEFAULT_INSTRUCTIONS.length);
  assert.equal(fileSlug("Avaliação de Matemática — 9º A"), "avaliacao-de-matematica-9o-a");
});

test("formulário de questão: múltipla escolha re-rotula alternativas e mantém o gabarito", () => {
  const r = parseQuestionForm(
    form([
      ["type", "multiple_choice"], ["statement", "Quanto é 2+2?"], ["weight", "1,5"],
      ["opt_A", "3"], ["opt_B", ""], ["opt_C", "4"], ["opt_D", "5"], ["opt_E", ""],
      ["correct", "C"],
    ]),
  );
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.data.options.map((o) => o.label + o.text), ["A3", "B4", "C5"]);
  assert.deepEqual(r.data.correct_answers, ["B"]);
  assert.equal(r.data.weight, 1.5);
});

test("formulário de questão: validações e outros tipos", () => {
  assert.equal(parseQuestionForm(form([["type", "multiple_choice"], ["opt_A", "só uma"]])).ok, false);
  assert.equal(parseQuestionForm(form([["type", "xyz"]])).ok, false);
  const tf = parseQuestionForm(form([["type", "true_false"], ["correct_tf", "F"], ["annulled", "on"]]));
  assert.ok(tf.ok && tf.data.correct_answers[0] === "F" && tf.data.annulled);
  const sa = parseQuestionForm(form([["type", "short_answer"], ["expected", "fotossíntese; fotossintese"]]));
  assert.ok(sa.ok && sa.data.correct_answers.length === 2);
});
