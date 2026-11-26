import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { sanitize } from "../src/lib/pdf/common";
import { tidyText } from "../src/lib/assessment/tidy-text";
import { groupByTerm, termFromDate, termFromTitle, termOf } from "../src/lib/assessment/term";

test("título com acento digitado separado não vira '?'", async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  assert.equal(sanitize(font, "AVALIAÇÃO 4° BIMESTRE"), "AVALIAÇÃO 4° BIMESTRE");
  assert.equal(sanitize(font, "Prova​ final 😀"), "Prova final ");
  assert.equal(sanitize(font, "Erdős"), "Erdos");
});

test("texto colado: junta quebras falsas, mantém versos e alternativas", () => {
  const colado = "Uma loja registrou, ao longo de cinco meses, a quantidade\nde unidades vendidas de um produto, conforme o gráfico.\nResponda:";
  assert.equal(tidyText(colado), "Uma loja registrou, ao longo de cinco meses, a quantidade de unidades vendidas de um produto, conforme o gráfico.\nResponda:");
  const verso = "Minha terra tem palmeiras,\nOnde canta o Sabiá;";
  assert.equal(tidyText(verso), verso);
  assert.equal(tidyText("\t  Texto   com espaços  \n\n\n\nfim"), "Texto com espaços\n\nfim");
  assert.equal(tidyText("Calcule o valor da expressão abaixo considerando que x vale\n2."), "Calcule o valor da expressão abaixo considerando que x vale 2.");
});

test("bimestre pelo escolhido, pelo título ou pela data", () => {
  assert.equal(termFromTitle("TEOREMA DE PITÁGORAS | AVALIAÇÃO 4° BIMESTRE"), 4);
  assert.equal(termFromTitle("Prova 2º bim"), 2);
  assert.equal(termFromTitle("Prova bimestral"), null);
  assert.equal(termFromDate("2026-03-10"), 1);
  assert.equal(termFromDate("2026-08-20"), 3);
  assert.equal(termOf({ term: 2, title: "4º bimestre", applied_on: "2026-11-30" }), 2);
  assert.equal(termOf({ title: "Prova", applied_on: "2026-11-30" }), 4);
  const g = groupByTerm([
    { title: "A", applied_on: "2026-03-01" },
    { title: "B 4º bimestre", applied_on: null, created_at: "2026-11-01" },
    { title: "C", applied_on: "2026-11-20" },
  ]);
  assert.deepEqual(g.map((x) => [x.label, x.items.length]), [["4º bimestre", 2], ["1º bimestre", 1]]);
});

import { isExactSubject } from "../src/lib/pdf/assessment-pdf";
test("rascunho só em exatas", () => {
  assert.equal(isExactSubject("Matemática"), true);
  assert.equal(isExactSubject("Física"), true);
  assert.equal(isExactSubject("Língua Portuguesa"), false);
  assert.equal(isExactSubject(null, "TEOREMA DE PITÁGORAS | AVALIAÇÃO"), true);
  assert.equal(isExactSubject("História", "Teorema"), false);
});
