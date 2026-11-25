import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { hasMath, mathToPlain, parseMath } from "../src/lib/math/parse";
import { normalizeLatex, plainToMarkup } from "../src/lib/math/paste";
import { layoutRich } from "../src/lib/pdf/rich-text";
import { generateAssessmentDocx } from "../src/lib/docx/assessment-docx";
import { examHeader } from "../src/lib/assessment/header";
import { sampleAssessment, sampleQuestions } from "./fixtures/sample-assessment";

test("parser: expoente, índice, fração, raiz e símbolos", () => {
  assert.deepEqual(parseMath("x^{2}"), [{ t: "sup", base: [{ t: "text", s: "x" }], exp: [{ t: "text", s: "2" }] }]);
  assert.deepEqual(parseMath("2x^2+1")[0], { t: "text", s: "2" });
  assert.equal((parseMath("10^{-3}")[0] as { t: string }).t, "sup");
  assert.deepEqual(mathToPlain(parseMath("10^{-3}")), "10^(-3)");
  assert.equal(mathToPlain(parseMath("(a+b)^2")), "(a+b)²");
  assert.equal(mathToPlain(parseMath("a_{1} + a_n")), "a_1 + a_n");
  assert.equal(mathToPlain(parseMath("\\frac{1}{2}")), "1/2");
  assert.equal(mathToPlain(parseMath("\\sqrt[3]{27}")), "3√(27)");
  assert.equal(mathToPlain(parseMath("\\pi r^{2} \\le 2\\pi")), "π r² ≤ 2π");
  assert.equal(parseMath("\\frac{\\sqrt{x}}{2}^{2}")[0].t, "sup");
  assert.ok(hasMath("x^{2}") && hasMath("\\frac{a}{b}") && !hasMath("texto comum, sem fórmula."));
});

test("parser: entrada quebrada não trava nem perde texto", () => {
  assert.match(mathToPlain(parseMath("\\frac{1}{")), /frac.*1/);
  assert.equal(mathToPlain(parseMath("preço: R$ 10")), "preço: R$ 10");
  assert.equal(mathToPlain(parseMath("\\desconhecido{x}")), "\\desconhecidox");
});

test("colagem de texto puro: x², a₁, ½, √", () => {
  assert.equal(plainToMarkup("x² + y³ = 10⁻²"), "x^{2} + y^{3} = 10^{-2}");
  assert.equal(plainToMarkup("a₁ + a₁₀"), "a_{1} + a_{10}");
  assert.equal(plainToMarkup("½ de 10"), "\\frac{1}{2} de 10");
  assert.equal(plainToMarkup("√(x+1) e √25 e ∛8"), "\\sqrt{x+1} e \\sqrt{25} e \\sqrt[3]{8}");
});

test("LaTeX de sites é simplificado para o que o app desenha", () => {
  assert.equal(normalizeLatex("{\\displaystyle \\left(\\frac{a}{b}\\right)^{2}}"), "{ (\\frac{a}{b})^{2}}");
  assert.equal(normalizeLatex("\\text{área} = \\pi\\,r^2"), "área = \\pi r^2");
});

test("PDF: fração deixa a linha mais alta; texto simples mantém a altura", async () => {
  const doc = await PDFDocument.create();
  const fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), symbol: await doc.embedFont(StandardFonts.Symbol) };
  const simple = layoutRich("Texto simples", { fonts, size: 12, maxWidth: 300, lineHeight: 1.725, justify: true });
  const frac = layoutRich("Calcule \\frac{3}{4} + \\sqrt{16}", { fonts, size: 12, maxWidth: 300, lineHeight: 1.725, justify: true });
  assert.equal(simple.length, 1);
  assert.ok(Math.abs(simple[0].height - 12 * 1.725) < 0.5);
  assert.ok(frac[0].height > simple[0].height);
  // símbolos fora da Helvetica (≤, π, θ, ∞, √) não quebram
  const page = doc.addPage();
  layoutRich("π ≤ θ ≠ ∞ ≈ ∈ ∪ ⇒ ℝ", { fonts, size: 12, maxWidth: 300, lineHeight: 1.5, justify: false }).forEach((l) => l.draw(page, 40, 40));
  assert.ok((await doc.save()).length > 0);
});

test("Word: fração e raiz viram equações nativas; expoente vira sobrescrito", async () => {
  const bytes = await generateAssessmentDocx(examHeader(sampleAssessment("larga_escala")), sampleQuestions(7));
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")!.async("string");
  assert.match(xml, /<m:f>/); // fração
  assert.match(xml, /<m:rad>/); // raiz
  assert.match(xml, /<w:vertAlign w:val="superscript"\/>/); // x²
  assert.match(xml, /<w:vertAlign w:val="subscript"\/>/); // x₁
});
