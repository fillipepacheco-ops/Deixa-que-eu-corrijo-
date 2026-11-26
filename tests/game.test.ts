import { test } from "node:test";
import assert from "node:assert/strict";
import { isCorrectAnswer, newPin, ranking, speedPoints } from "../src/lib/game/scoring";

test("pontos por rapidez: 1000 na hora, 500 no fim, 0 se errou", () => {
  assert.equal(speedPoints(true, 0, 20), 1000);
  assert.equal(speedPoints(true, 10000, 20), 750);
  assert.equal(speedPoints(true, 20000, 20), 500);
  assert.equal(speedPoints(true, 25000, 20), 500);
  assert.equal(speedPoints(false, 100, 20), 0);
  assert.equal(speedPoints(true, 300, 20), 993); // igual ao banco (round)
});

test("resposta certa: letra, certo/errado e Tipo B", () => {
  assert.equal(isCorrectAnswer("multiple_choice", "b", ["B"]), true);
  assert.equal(isCorrectAnswer("true_false", "E", ["C"]), false);
  assert.equal(isCorrectAnswer("numeric", "050", ["50"]), true);
  assert.equal(isCorrectAnswer("numeric", "5a", ["50"]), false);
  assert.equal(isCorrectAnswer("numeric", null, ["50"]), false);
});

test("ranking com empate e PIN", () => {
  const r = ranking([
    { id: "1", name: "A", score: 900 },
    { id: "2", name: "B", score: 1500 },
    { id: "3", name: "C", score: 900 },
  ]);
  assert.deepEqual(r.map((x) => [x.name, x.position]), [["B", 1], ["A", 2], ["C", 2]]);
  assert.match(newPin(), /^[1-9]\d{5}$/);
});
