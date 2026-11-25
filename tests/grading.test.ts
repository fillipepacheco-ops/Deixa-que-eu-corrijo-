import { test } from "node:test";
import assert from "node:assert/strict";
import {
  diffAnswerKey,
  formatScore,
  gradeSubmission,
  regradeAll,
  type AnswerKeyItem,
} from "../src/lib/grading/grading";
import { analyzeQuestions, rankByDifficulty, scoreDistribution, summarizeScores } from "../src/lib/grading/stats";

const mc = (number: number, accepted: string[], weight = 1, annulled = false): AnswerKeyItem => ({
  number,
  type: "multiple_choice",
  accepted,
  weight,
  annulled,
});

const key10 = Array.from({ length: 10 }, (_, i) => mc(i + 1, ["ABCDE"[i % 5]]));

test("cálculo de nota: 8 de 10 certas = 8,0", () => {
  const answers: Record<number, string | null> = {};
  key10.forEach((k) => (answers[k.number] = k.accepted[0]));
  answers[3] = "A"; // errada (certa é C)
  answers[7] = null; // branco
  const r = gradeSubmission(key10, answers);
  assert.equal(r.score, 8);
  assert.equal(r.correctCount, 8);
  assert.equal(r.wrongCount, 1);
  assert.equal(r.blankCount, 1);
  assert.equal(r.needsReview, false);
});

test("pesos diferentes", () => {
  const key = [mc(1, ["A"], 2), mc(2, ["B"], 1), mc(3, ["C"], 1)];
  const r = gradeSubmission(key, { 1: "A", 2: "C", 3: "C" });
  assert.equal(r.earnedPoints, 3);
  assert.equal(r.possiblePoints, 4);
  assert.equal(r.score, 7.5);
});

test("anulação com ponto para todos", () => {
  const key = [mc(1, ["A"]), mc(2, ["B"], 1, true), mc(3, ["C"]), mc(4, ["D"])];
  const r = gradeSubmission(key, { 1: "A", 2: "E", 3: "B", 4: "D" });
  assert.equal(r.score, 7.5); // 3 de 4
  assert.equal(r.questions.find((q) => q.number === 2)!.status, "annulled");
});

test("anulação removendo a questão do cálculo", () => {
  const key = [mc(1, ["A"]), mc(2, ["B"], 1, true), mc(3, ["C"]), mc(4, ["D"])];
  const r = gradeSubmission(key, { 1: "A", 2: "E", 3: "B", 4: "D" }, { annulPolicy: "remove" });
  assert.equal(r.possiblePoints, 3);
  assert.equal(r.score, 6.67); // 2 de 3
});

test("aceitar mais de uma resposta", () => {
  const key = [mc(1, ["A", "C"])];
  assert.equal(gradeSubmission(key, { 1: "C" }).score, 10);
  assert.equal(gradeSubmission(key, { 1: "a" }).score, 10);
  assert.equal(gradeSubmission(key, { 1: "B" }).score, 0);
});

test("dupla marcação conta como erro, sem exigir revisão", () => {
  const r = gradeSubmission([mc(1, ["A"])], { 1: "*" });
  assert.equal(r.questions[0].status, "multiple");
  assert.equal(r.needsReview, false);
});

test("leitura incerta bloqueia o registro automático e explica o motivo", () => {
  const r = gradeSubmission(key10, { 8: "?" });
  assert.equal(r.needsReview, true);
  assert.deepEqual(r.reviewReasons, ["Não foi possível identificar com segurança a questão 8."]);
});

test("correção manual resolve a questão incerta", () => {
  const r = gradeSubmission([mc(1, ["A"]), mc(2, ["B"])], { 1: "A", 2: "?" }, { manualPoints: { 2: 1 } });
  assert.equal(r.needsReview, false);
  assert.equal(r.score, 10);
});

test("verdadeiro ou falso, resposta curta e discursiva", () => {
  const key: AnswerKeyItem[] = [
    { number: 1, type: "true_false", accepted: ["C"], weight: 1, annulled: false },
    { number: 2, type: "short_answer", accepted: ["Fotossíntese"], weight: 1, annulled: false },
    { number: 3, type: "essay", accepted: [], weight: 2, annulled: false },
  ];
  const r1 = gradeSubmission(key, { 1: "C", 2: "  fotossintese " });
  assert.equal(r1.questions[1].status, "correct");
  assert.equal(r1.questions[2].status, "pending_manual");
  assert.equal(r1.score, 5); // 2 de 4 até a discursiva ser corrigida
  const r2 = gradeSubmission(key, { 1: "C", 2: "fotossintese" }, { manualPoints: { 3: 1.5 } });
  assert.equal(r2.score, 8.75);
  // nota manual acima do peso é limitada
  const r3 = gradeSubmission(key, { 1: "C", 2: "x" }, { manualPoints: { 3: 99 } });
  assert.equal(r3.earnedPoints, 3);
});

test("alteração de gabarito recalcula todas as notas", () => {
  const subs = [{ answers: { 1: "A", 2: "B" } }, { answers: { 1: "C", 2: "B" } }];
  const before = [mc(1, ["A"]), mc(2, ["B"])];
  const after = [mc(1, ["C"]), mc(2, ["B"])];
  assert.deepEqual(regradeAll(before, subs).map((s) => s.result.score), [10, 5]);
  assert.deepEqual(regradeAll(after, subs).map((s) => s.result.score), [5, 10]);
  assert.deepEqual(diffAnswerKey(before, after), [{ number: 1, field: "accepted", from: ["A"], to: ["C"] }]);
});

test("registro de alterações do gabarito (peso e anulação)", () => {
  const before = [mc(1, ["A"], 1)];
  const after = [mc(1, ["A"], 2, true)];
  assert.deepEqual(
    diffAnswerKey(before, after).map((c) => c.field),
    ["weight", "annulled"],
  );
});

test("avaliação só com questões anuladas removidas não divide por zero", () => {
  const r = gradeSubmission([mc(1, ["A"], 1, true)], {}, { annulPolicy: "remove" });
  assert.equal(r.score, 0);
});

test("nota máxima diferente de 10", () => {
  const r = gradeSubmission([mc(1, ["A"]), mc(2, ["B"])], { 1: "A" }, { maxScore: 5 });
  assert.equal(r.score, 2.5);
});

test("formatação brasileira", () => {
  assert.equal(formatScore(7.5), "7,5");
  assert.equal(formatScore(null), "—");
});

test("estatísticas da turma", () => {
  const s = summarizeScores([9, 7.5, 4, 8]);
  assert.deepEqual(s, { count: 4, mean: 7.13, median: 7.75, min: 4, max: 9 });
  assert.equal(summarizeScores([]).mean, null);
  const d = scoreDistribution([0, 4, 4.9, 10, 9.99], 10, 10);
  assert.equal(d[0].count, 1);
  assert.equal(d[4].count, 2);
  assert.equal(d[9].count, 2);
});

test("análise por questão: percentual por alternativa", () => {
  const key = [mc(1, ["B"]), mc(2, ["A"])];
  const subs = [
    { 1: "B", 2: "A" },
    { 1: "B", 2: "C" },
    { 1: "A", 2: null },
    { 1: "C", 2: "*" },
    { 1: "?", 2: "C" }, // leitura incerta da Q1 fica fora
  ] as Record<number, string | null>[];
  const labels = { 1: ["A", "B", "C", "D"], 2: ["A", "B", "C", "D"] };
  const a = analyzeQuestions(key, subs, labels);
  assert.equal(a[0].total, 4);
  assert.equal(a[0].hitRate, 50);
  assert.deepEqual(
    a[0].distribution.map((x) => [x.option, x.percent, x.correct]),
    [["A", 25, false], ["B", 50, true], ["C", 25, false], ["D", 0, false]],
  );
  assert.equal(a[1].hitRate, 20);
  assert.ok(a[1].distribution.some((x) => x.option === "Em branco"));
  assert.ok(a[1].distribution.some((x) => x.option === "Dupla marcação"));
  assert.deepEqual(rankByDifficulty(a).map((q) => q.number), [2, 1]);
});
