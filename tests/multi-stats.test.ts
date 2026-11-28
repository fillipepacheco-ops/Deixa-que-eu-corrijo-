import { test } from "node:test";
import assert from "node:assert/strict";
import { classResults, distribution, questionRates } from "../src/lib/multi/stats";

const q = (position: number, mine: boolean, correct = "A") => ({ position, type: "multiple_choice" as const, correct_answers: [correct], weight: 1, annulled: false, section: mine ? "Mat" : "Port", mine });
const data = [
  {
    assessment_id: "a1",
    class_name: "9A",
    annul_policy: "credit_all" as const,
    questions: [q(1, false), q(2, false), q(3, true), q(4, true)],
    students: [
      { id: "s1", name: "Ana", roll: 1, answers: { "1": "A", "2": "A", "3": "A", "4": "B" }, manual: null, done: true },
      { id: "s2", name: "Bia", roll: 2, answers: { "1": "B", "2": "A", "3": "A", "4": "A" }, manual: null, done: true },
      { id: "s3", name: "Caio", roll: 3, answers: null, manual: null, done: false },
    ],
  },
];

test("só a disciplina do professor × prova inteira", () => {
  const mine = classResults(data, "mine", 10)[0];
  assert.equal(mine.total, 2);
  assert.deepEqual(mine.rows.map((r) => r.score), [5, 10, null]);
  const all = classResults(data, "all", 10)[0];
  assert.equal(all.total, 4);
  assert.deepEqual(all.rows.map((r) => r.score), [7.5, 7.5, null]);
  assert.equal(all.average, 7.5);
  const rates = questionRates([all]);
  assert.deepEqual(rates.map((r) => [r.number, r.rate, r.mine]), [[1, 0.5, false], [2, 1, false], [3, 1, true], [4, 0.5, true]]);
  assert.deepEqual(distribution([mine], 10), [0, 1, 0, 1]);
});

test("dados antigos (sem 'mine') contam como do professor", () => {
  const old = [{ ...data[0], questions: data[0].questions.map(({ mine: _m, ...rest }) => rest) }];
  assert.equal(classResults(old, "mine", 10)[0].total, 4);
});
