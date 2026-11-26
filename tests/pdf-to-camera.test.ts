/**
 * Teste de ponta a ponta do fluxo principal, sem papel:
 * gera o PDF real do cartão → "aluno" marca bolhas no PDF → rasteriza como
 * uma foto (pdftoppm) → leitor por câmera → nota.
 * É pulado se o computador não tiver pdftoppm (poppler-utils).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import { sheetLayout } from "../src/lib/answer-sheet/layout";
import { generateAnswerSheetsPdf } from "../src/lib/pdf/answer-sheet-pdf";
import { readAnswerSheet, type GrayImage } from "../src/lib/omr/reader";
import { gradeSubmission } from "../src/lib/grading/grading";
import { A4, mm } from "../src/lib/pdf/common";

function hasPdftoppm() {
  try {
    execFileSync("pdftoppm", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Lê PGM binário (P5) gerado pelo pdftoppm -gray. */
function readPgm(buf: Buffer): GrayImage {
  let pos = 0;
  const tokens: string[] = [];
  while (tokens.length < 4) {
    while (/\s/.test(String.fromCharCode(buf[pos]))) pos++;
    if (buf[pos] === 0x23) { while (buf[pos] !== 0x0a) pos++; continue; }
    let t = "";
    while (!/\s/.test(String.fromCharCode(buf[pos]))) t += String.fromCharCode(buf[pos++]);
    tokens.push(t);
  }
  pos++;
  const [magic, w, h] = tokens;
  assert.equal(magic, "P5");
  return { width: +w, height: +h, data: new Uint8Array(buf.subarray(pos, pos + +w * +h)) };
}

test("ponta a ponta: PDF do cartão → marcações → foto → leitura → nota", { skip: !hasPdftoppm() }, async () => {
  const questions = Array.from({ length: 25 }, (_, i) => ({ number: i + 1, labels: ["A", "B", "C", "D", "E"] }));
  const pdfBytes = await generateAnswerSheetsPdf({
    assessmentTitle: "Simulado 3º bimestre",
    subject: "Matemática",
    className: "9º B",
    questions,
    cards: [{ sheetNumber: 31337, studentName: "Maria Souza", rollNumber: 14 }],
    logoPng: readFileSync("public/brand/logo.png"), // a logo não pode atrapalhar a leitura
    schoolLogo: readFileSync("tests/fixtures/logo-escola-exemplo.jpg"), // nem a logo da escola
  });

  // O "aluno" preenche: caneta azul-escura.
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPage(0);
  const layout = sheetLayout(questions);
  const marks: Record<number, string> = { 1: "B", 2: "B", 3: "D", 7: "A", 12: "E", 21: "C", 25: "A" };
  for (const b of layout.bubbles) {
    if (marks[b.question] === b.label) {
      page.drawCircle({ x: mm(b.x), y: A4.h - mm(b.y), size: mm(b.r * 0.92), color: rgb(0.1, 0.12, 0.35) });
    }
  }
  const dir = mkdtempSync(join(tmpdir(), "dqec-"));
  writeFileSync(join(dir, "marcado.pdf"), await doc.save());
  execFileSync("pdftoppm", ["-gray", "-r", "110", "-singlefile", join(dir, "marcado.pdf"), join(dir, "foto")]);
  const img = readPgm(readFileSync(join(dir, "foto.pgm")));

  const r = readAnswerSheet(img, questions);
  assert.equal(r.ok, true, r.error ?? "");
  assert.equal(r.sheetNumber, 31337);
  for (const q of questions) assert.equal(r.answers[q.number], marks[q.number] ?? null, `questão ${q.number}`);
  assert.deepEqual(r.problems, []);

  const key = questions.map((q) => ({ number: q.number, type: "multiple_choice" as const, accepted: ["B"], weight: 1, annulled: false }));
  const g = gradeSubmission(key, r.answers);
  assert.equal(g.correctCount, 2);
  assert.equal(g.score, 0.8);
});
