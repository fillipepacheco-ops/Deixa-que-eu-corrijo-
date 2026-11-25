import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExam, type TextBlock } from "../src/lib/import/parse-questions";

const docx = (...lines: string[]): TextBlock[] => lines.map((text) => ({ text, newParagraph: true }));
const pdf = (...lines: string[]): TextBlock[] => lines.map((text) => ({ text }));

test("Word: cabeçalho ignorado, múltipla escolha, certo/errado, discursiva e gabarito", () => {
  const r = parseExam(
    docx(
      "ESCOLA MASTER",
      "Instruções:",
      "1. Use caneta azul ou preta.",
      "2. Não rasure.",
      "1) Quanto é 2 + 2?",
      "a) 3",
      "b) 4",
      "c) 5",
      "d) 6",
      "02 - O número 1 é primo.",
      "(   ) Certo     (   ) Errado",
      "QUESTÃO 3",
      "Explique a fotossíntese.",
      "______________________________",
      "______________________________",
      "4. Qual é a capital do Brasil?",
      "(A) Rio (B) Brasília (C) Salvador",
      "GABARITO: 1-B 2-E 4-B",
    ),
  );
  assert.equal(r.questions.length, 4);
  const [q1, q2, q3, q4] = r.questions;
  assert.equal(q1.statement, "Quanto é 2 + 2?");
  assert.equal(q1.type, "multiple_choice");
  assert.deepEqual(q1.options.map((o) => o.text), ["3", "4", "5", "6"]);
  assert.deepEqual(q1.correct_answers, ["B"]);
  assert.equal(q2.type, "true_false");
  assert.deepEqual(q2.correct_answers, ["E"]);
  assert.equal(q3.type, "essay");
  assert.equal(q3.statement, "Explique a fotossíntese.");
  assert.deepEqual(q4.options.map((o) => o.text), ["Rio", "Brasília", "Salvador"]);
  assert.deepEqual(q4.correct_answers, ["B"]);
  assert.equal(r.withAnswer, 3);
  assert.deepEqual(r.warnings, []);
});

test("PDF: linhas quebradas juntam no enunciado e na alternativa; texto de apoio vai para a próxima", () => {
  const r = parseExam(
    pdf(
      "1. Um carro percorre 120 km em",
      "2 horas. Qual a velocidade média?",
      "A) 40 km/h",
      "B) 60 km/h, considerando que a",
      "velocidade foi constante",
      "C) 80 km/h",
      "Leia o texto para responder à questão 2.",
      "O Sol é uma estrela.",
      "2. Segundo o texto, o Sol é:",
      "A) um planeta  B) uma estrela  C) um cometa",
      "Resposta: B",
      "Página 1",
    ),
  );
  assert.equal(r.questions.length, 2);
  assert.equal(r.questions[0].statement, "Um carro percorre 120 km em 2 horas. Qual a velocidade média?");
  assert.equal(r.questions[0].options[1].text, "60 km/h, considerando que a velocidade foi constante");
  assert.equal(r.questions[0].options[2].text, "80 km/h");
  assert.match(r.questions[1].statement, /^Leia o texto para responder à questão 2\. O Sol é uma estrela\.\nSegundo o texto/);
  assert.deepEqual(r.questions[1].options.map((o) => o.text), ["um planeta", "uma estrela", "um cometa"]);
  assert.deepEqual(r.questions[1].correct_answers, ["B"]);
});

test("números no meio do texto não viram questão; fórmulas e imagens", () => {
  const r = parseExam([
    { text: "1) Calcule x² + ½ quando:", newParagraph: true },
    { text: "3. x vale 2", newParagraph: true }, // não é a questão 2
    { text: "", newParagraph: true, images: ["img1"] },
    { text: "a) 4,5", newParagraph: true },
    { text: "b) 5", newParagraph: true },
    { text: "2) Outra questão", newParagraph: true },
    { text: "a) sim", newParagraph: true },
    { text: "b) não", newParagraph: true },
    { text: "4) Pulou a 3", newParagraph: true }, // fora de sequência: continua na 2
  ]);
  assert.equal(r.questions.length, 2);
  assert.equal(r.questions[0].statement, "Calcule x^{2} + \\frac{1}{2} quando:\n3. x vale 2");
  assert.deepEqual(r.questions[0].images, ["img1"]);
  assert.equal(r.questions[1].options.length, 2);
});

test("sem questões: avisa", () => {
  const r = parseExam(docx("Só um texto qualquer", "sem números"));
  assert.equal(r.questions.length, 0);
  assert.equal(r.warnings.length, 1);
});

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { importedToRows } from "../src/lib/import/to-rows";
import { extractPdf } from "../src/lib/import/pdf-extract";
import { generateAssessmentPdf } from "../src/lib/pdf/assessment-pdf";
import { sampleAssessment, sampleQuestions } from "./fixtures/sample-assessment";

test("gravação: confere tipos, alternativas, gabarito e imagem do próprio professor", () => {
  const r = importedToRows(
    [
      { type: "multiple_choice", statement: "Q", options: [{ text: "a" }, { text: "b" }], correct_answers: ["B"], image_path: "u1/x.jpg" },
      { type: "multiple_choice", statement: "Só uma", options: [{ text: "a" }], correct_answers: ["A"] },
      { type: "true_false", statement: "TF", correct_answers: ["X"], image_path: "outro/x.jpg" },
      { type: "hack", statement: 5 },
    ],
    "u1",
  );
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.rows[0].correct_answers, ["B"]);
  assert.equal(r.rows[0].image_path, "u1/x.jpg");
  assert.equal(r.rows[1].type, "essay");
  assert.deepEqual(r.rows[1].correct_answers, []);
  assert.deepEqual(r.rows[2].correct_answers, []);
  assert.equal(r.rows[2].image_path, null);
  assert.equal(r.rows[3].type, "essay");
  assert.equal(r.rows[3].statement, "");
  assert.equal(importedToRows([], "u1").ok, false);
});

test("PDF gerado pelo app volta com todas as questões (2 colunas, várias páginas)", async () => {
  const req = createRequire(import.meta.url);
  let file: string;
  try {
    file = req.resolve("pdfjs-dist/legacy/build/pdf.mjs", { paths: [process.env.NODE_PATH ?? "", process.cwd()] });
  } catch {
    return; // pdf.js não instalado neste ambiente
  }
  const pdfjs = await import(pathToFileURL(file).href);
  const qs = sampleQuestions(14);
  const out = await generateAssessmentPdf({ assessment: sampleAssessment("larga_escala"), questions: qs });
  const bytes = out.bytes;
  const blocks = await extractPdf(pdfjs, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const r = parseExam(blocks);
  assert.equal(r.questions.length, 14);
  assert.deepEqual(
    r.questions.map((q) => q.type),
    qs.map((q) => q.type),
  );
  assert.equal(r.questions[4].statement.startsWith("Explique"), true); // "(2 pontos)" sai do enunciado
  assert.equal(r.questions[0].options[2].text, "As vendas cresceram em todos os meses do período analisado.");
});
