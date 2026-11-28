import { test } from "node:test";
import assert from "node:assert/strict";
import { splitInline, inlineImageSources, stripInline, isAllowedInlineSrc } from "@/lib/assessment/inline-images";
import { tidyText } from "@/lib/assessment/tidy-text";
import { ENEM_QUESTIONS, bankQuestionRow, filterBank, tagCounts } from "@/lib/banco/enem";

test("separa texto e figuras", () => {
  const s = splitInline("Veja a figura\n[[img:/banco/enem/2025/q101-1.png|62.5]]\nResponda.");
  assert.deepEqual(s.map((x) => x.t), ["text", "img", "text"]);
  assert.equal((s[1] as { wmm: number }).wmm, 62.5);
  assert.equal(stripInline("a [[img:/banco/x.png|3]] b", ""), "a b");
  assert.ok(isAllowedInlineSrc("/banco/enem/2025/q101-1.png"));
  assert.ok(!isAllowedInlineSrc("https://evil.com/x.png"));
});

test("tidyText não junta nem altera a marcação de figura", () => {
  const t = tidyText("Uma linha bem comprida que não termina com ponto final de jeito nenhum\n[[img:/banco/enem/2025/q101-1.png|62.5]]\nx² + 1");
  assert.ok(t.includes("\n[[img:/banco/enem/2025/q101-1.png|62.5]]\n"));
  assert.ok(t.endsWith("x^{2} + 1"));
});

test("banco do ENEM: 810 questões completas, com gabarito e classificação", () => {
  assert.equal(ENEM_QUESTIONS.length, 810);
  for (const q of ENEM_QUESTIONS) {
    assert.equal(q.op.filter((o) => o.trim()).length, 5, q.id);
    assert.ok(q.st.trim(), q.id);
    assert.ok(q.nul ? q.ans === null : /^[A-E]$/.test(q.ans ?? ""), q.id);
    assert.ok(q.tags.length >= 1, q.id);
    for (const src of inlineImageSources({ statement: q.st, options: q.op.map((text) => ({ text })) })) assert.ok(isAllowedInlineSrc(src), src);
  }
  assert.equal(ENEM_QUESTIONS.filter((q) => q.nul).length, 10);
});

test("questão vai para a avaliação com origem e ano no enunciado", () => {
  const q = ENEM_QUESTIONS.find((x) => x.id === "enem-2025-091")!;
  const row = bankQuestionRow(q);
  assert.ok(row.statement.startsWith("(ENEM 2025) "));
  assert.equal(row.options.length, 5);
  assert.deepEqual(row.correct_answers, ["C"]);
  const fig = ENEM_QUESTIONS.find((x) => x.st.startsWith("[[img:"))!;
  assert.ok(bankQuestionRow(fig).statement.startsWith(`(ENEM ${fig.y})\n[[img:`));
});

test("filtros: subtópico, ano e busca sem acento", () => {
  const soma = filterBank(ENEM_QUESTIONS, { d: "Matemática", t: "Sequências" });
  assert.ok(soma.length > 0);
  assert.ok(filterBank(ENEM_QUESTIONS, { ano: 2025 }).every((q) => q.y === 2025));
  assert.ok(filterBank(ENEM_QUESTIONS, { q: "fotossintese" }).length > 0);
  const c = tagCounts(ENEM_QUESTIONS);
  assert.ok(c["Matemática"] >= 405);
});
