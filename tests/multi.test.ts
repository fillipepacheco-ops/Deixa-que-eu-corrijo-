import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMultiQuestions, missingOf, slotProgress } from "../src/lib/multi/build";

const opts = (n: number) => ["A", "B", "C", "D", "E"].slice(0, n).map((l) => ({ label: l, text: `alt ${l}` }));
const slots = [
  { id: "m", position: 2, teacher_name: "Bia", discipline: "Matemática", question_count: 1 },
  { id: "p", position: 1, teacher_name: "Ana", discipline: "Português", question_count: 3 },
];

test("monta seções na ordem dos professores, com todos os tipos", () => {
  const qs = [
    { slot_id: "m", position: 1, type: "numeric" as const, statement: "M1", options: [], correct_answers: ["42"] },
    { slot_id: "p", position: 2, type: "essay" as const, statement: "P2", options: [] },
    { slot_id: "p", position: 1, statement: "P1", options: opts(4), correct: "A", image_path: "u/multi/p/x.jpg" },
  ];
  const r = buildMultiQuestions(slots, qs);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.short, ["Português (Ana): 2 de 3"]);
  assert.deepEqual(
    r.rows.map((q) => [q.position, q.section, q.type, q.statement, q.correct_answers.join(), q.multi_slot_id]),
    [
      [1, "Português", "multiple_choice", "P1", "A", "p"],
      [2, "Português", "essay", "P2", "", "p"],
      [3, "Matemática", "numeric", "M1", "42", "m"],
    ],
  );
  assert.equal(r.rows[0].image_path, "u/multi/p/x.jpg");
});

test("aponta o que falta", () => {
  assert.deepEqual(missingOf({ slot_id: "p", position: 1, statement: "", options: opts(1), correct_answers: [] }), ["enunciado", "alternativas", "gabarito"]);
  assert.deepEqual(missingOf({ slot_id: "p", position: 1, statement: "", image_path: "x.jpg", type: "true_false", options: [], correct_answers: ["C"] }), []);
  const qs = [{ slot_id: "p", position: 1, statement: "P1", options: opts(5), correct_answers: [] }];
  assert.match(buildMultiQuestions(slots, qs).problems[0], /questão 1: falta gabarito/);
  assert.deepEqual(slotProgress(slots[1], qs), { ready: 0, made: 1, total: 3, asked: 3 });
});
