import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { decodeSheetNumber, encodeSheetNumber } from "../src/lib/answer-sheet/code";
import { MAX_QUESTIONS, sheetLayout, sheetQuestionsFrom } from "../src/lib/answer-sheet/layout";
import { generateAnswerSheetsPdf } from "../src/lib/pdf/answer-sheet-pdf";
import { readAnswerSheet } from "../src/lib/omr/reader";
import { gradeSubmission } from "../src/lib/grading/grading";
import { renderSheetPhoto } from "./helpers/render-sheet";

const q20 = Array.from({ length: 20 }, (_, i) => ({ number: i + 1, labels: ["A", "B", "C", "D", "E"] }));

test("código do cartão: ida e volta + CRC detecta erro", () => {
  for (const n of [0, 1, 1001, 123456, 16777215]) {
    assert.equal(decodeSheetNumber(encodeSheetNumber(n)), n);
  }
  const bits = encodeSheetNumber(4242);
  bits[5] ^= 1;
  assert.equal(decodeSheetNumber(bits), null);
  assert.throws(() => encodeSheetNumber(2 ** 24));
});

test("layout: bolhas dentro da folha e sem sobreposição", () => {
  const specs = Array.from({ length: MAX_QUESTIONS }, (_, i) => ({ number: i + 1, labels: ["A", "B", "C", "D", "E"] }));
  const l = sheetLayout(specs);
  assert.equal(l.bubbles.length, 400);
  for (const b of l.bubbles) {
    assert.ok(b.x - b.r > 5 && b.x + b.r < 205 && b.y - b.r > 100 && b.y + b.r < 275, `bolha fora da área: ${b.question}${b.label}`);
  }
  for (let i = 0; i < l.bubbles.length; i++) {
    for (let j = i + 1; j < l.bubbles.length; j++) {
      const a = l.bubbles[i], b = l.bubbles[j];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r + 1, "bolhas muito próximas");
    }
  }
  assert.throws(() => sheetLayout([...specs, { number: 81, labels: ["A"] }]));
});

test("só questões objetivas vão para o cartão, na ordem da prova", () => {
  const specs = sheetQuestionsFrom([
    { position: 2, type: "essay", options: [] },
    { position: 3, type: "true_false", options: [] },
    { position: 1, type: "multiple_choice", options: [{ label: "A" }, { label: "B" }, { label: "C" }, { label: "D" }] },
  ]);
  assert.deepEqual(specs, [
    { number: 1, labels: ["A", "B", "C", "D"] },
    { number: 3, labels: ["V", "F"] },
  ]);
});

test("geração do cartão-resposta em PDF (uma folha por aluno)", async () => {
  const bytes = await generateAnswerSheetsPdf({
    assessmentTitle: "Avaliação de Matemática — Funções",
    subject: "Matemática",
    className: "9º A",
    schoolName: "Escola Exemplo",
    appliedOn: "2026-11-30",
    questions: q20,
    cards: [
      { sheetNumber: 1001, studentName: "Ana Beatriz Souza", rollNumber: 1 },
      { sheetNumber: 1002, studentName: "João Pedro Lima", rollNumber: 2 },
      { sheetNumber: 1003 }, // em branco, com nº de chamada
    ],
  });
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 3);
  const { width, height } = doc.getPage(0).getSize();
  assert.ok(Math.abs(width - 595.28) < 1 && Math.abs(height - 841.89) < 1, "A4");
  await assert.rejects(() => generateAnswerSheetsPdf({ assessmentTitle: "x", questions: q20, cards: [] }));
});

test("leitura: foto reta identifica cartão, respostas, branco e dupla marcação", () => {
  const img = renderSheetPhoto({
    questions: q20,
    sheetNumber: 123456,
    marks: { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E", 6: ["A", "C"], 8: "B", 20: "E" },
  });
  const r = readAnswerSheet(img, q20);
  assert.equal(r.ok, true, r.error ?? "");
  assert.equal(r.sheetNumber, 123456);
  assert.equal(r.answers[1], "A");
  assert.equal(r.answers[5], "E");
  assert.equal(r.answers[6], "*");
  assert.equal(r.answers[7], null);
  assert.equal(r.answers[20], "E");
  assert.deepEqual(r.problems, []);
});

test("leitura: foto inclinada e em perspectiva, com pouca luz", () => {
  const img = renderSheetPhoto({
    questions: q20,
    sheetNumber: 2024,
    marks: { 1: "C", 10: "A", 15: "D", 19: "B" },
    width: 1000,
    height: 1300,
    pageCorners: [{ x: 120, y: 60 }, { x: 900, y: 110 }, { x: 960, y: 1240 }, { x: 60, y: 1180 }],
    paper: 175,
    ink: 60,
    noise: 18,
  });
  const r = readAnswerSheet(img, q20);
  assert.equal(r.ok, true, r.error ?? "");
  assert.equal(r.sheetNumber, 2024);
  assert.equal(r.answers[1], "C");
  assert.equal(r.answers[10], "A");
  assert.equal(r.answers[15], "D");
  assert.equal(r.answers[19], "B");
  assert.equal(r.answers[2], null);
});

test("leitura: marcação fraca/rasurada vira 'incerta' e bloqueia o registro automático", () => {
  const img = renderSheetPhoto({ questions: q20, sheetNumber: 5555, marks: { 1: "A" }, faintMarks: { 8: "C" } });
  const r = readAnswerSheet(img, q20);
  assert.equal(r.answers[8], "?");
  assert.ok(r.problems.includes("Não foi possível identificar com segurança a questão 8."));
  const key = q20.map((q) => ({ number: q.number, type: "multiple_choice" as const, accepted: ["A"], weight: 1, annulled: false }));
  assert.equal(gradeSubmission(key, r.answers).needsReview, true);
});

test("leitura: cartão em branco com nº de chamada", () => {
  const img = renderSheetPhoto({ questions: q20, sheetNumber: 7777, marks: { 3: "B" }, roll: 27 });
  const r = readAnswerSheet(img, q20);
  assert.equal(r.rollNumber, 27);
  assert.equal(r.answers[3], "B");
});

test("leitura: V/F e mais de 20 questões (várias colunas)", () => {
  const specs = [
    ...Array.from({ length: 30 }, (_, i) => ({ number: i + 1, labels: ["A", "B", "C", "D"] })),
    { number: 31, labels: ["V", "F"] },
    { number: 32, labels: ["V", "F"] },
  ];
  const img = renderSheetPhoto({ questions: specs, sheetNumber: 99, marks: { 21: "D", 30: "A", 31: "V", 32: "F" } });
  const r = readAnswerSheet(img, specs);
  assert.equal(r.answers[21], "D");
  assert.equal(r.answers[30], "A");
  assert.equal(r.answers[31], "V");
  assert.equal(r.answers[32], "F");
});

test("leitura: imagem sem cartão retorna orientação, não inventa resultado", () => {
  const img = { width: 300, height: 400, data: new Uint8Array(300 * 400).fill(200) };
  const r = readAnswerSheet(img, q20);
  assert.equal(r.ok, false);
  assert.match(r.error!, /quadrados pretos/);
  assert.deepEqual(r.answers, {});
});
