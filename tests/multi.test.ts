import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMultiQuestions, missingOf, slotProgress } from "../src/lib/multi/build";

const opts = (n: number) => ["A", "B", "C", "D", "E"].slice(0, n).map((l) => ({ label: l, text: `alt ${l}` }));
const slots = [
  { id: "m", position: 2, teacher_name: "Bia", discipline: "Matemática", question_count: 1 },
  { id: "p", position: 1, teacher_name: "Ana", discipline: "Português", question_count: 2 },
];

test("monta seções na ordem dos professores", () => {
  const qs = [
    { slot_id: "m", position: 1, statement: "M1", options: opts(5), correct: "E" },
    { slot_id: "p", position: 2, statement: "P2", options: opts(5), correct: "B" },
    { slot_id: "p", position: 1, statement: "P1", options: opts(5), correct: "A" },
  ];
  const r = buildMultiQuestions(slots, qs, 5);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.rows.map((q) => [q.position, q.section, q.statement, q.correct_answers[0]]), [
    [1, "Português", "P1", "A"],
    [2, "Português", "P2", "B"],
    [3, "Matemática", "M1", "E"],
  ]);
});

test("aponta o que falta", () => {
  const qs = [{ slot_id: "p", position: 1, statement: "P1", options: opts(4), correct: null }];
  const r = buildMultiQuestions(slots, qs, 5);
  assert.equal(r.rows.length, 0);
  assert.equal(r.problems.length, 3);
  assert.match(r.problems[0], /alternativa E, gabarito/);
  assert.match(r.problems[1], /questão 2: falta enunciado/);
  assert.deepEqual(missingOf({ slot_id: "p", position: 1, statement: "x", options: opts(4), correct: "D" }, 4), []);
  assert.deepEqual(slotProgress(slots[1], qs, 4), { ready: 0, total: 2 });
});
