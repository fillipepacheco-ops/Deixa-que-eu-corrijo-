import { test } from "node:test";
import assert from "node:assert/strict";
import { answersToBase, keyForVersion, questionsForVersion, versionForIndex, versionOrders } from "../src/lib/versions/versions";

const mc = (position: number, section: string, n = 5) => ({ position, type: "multiple_choice", options: Array.from({ length: n }, (_, i) => ({ label: "ABCDE"[i] })), section });

test("versão A é a original e as outras são permutações dentro da seção", () => {
  const qs = [mc(1, "Port"), mc(2, "Port"), mc(3, "Port"), mc(4, "Mat"), mc(5, "Mat"), mc(6, "Mat")];
  const o = versionOrders(qs, 4, "abc");
  assert.equal(o.length, 4);
  assert.deepEqual(o[0], [1, 2, 3, 4, 5, 6]);
  for (const ord of o.slice(1)) {
    assert.deepEqual([...ord].sort(), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(ord.slice(0, 3).sort(), [1, 2, 3]); // Português continua no começo
    assert.deepEqual(ord.slice(3).sort(), [4, 5, 6]);
  }
  assert.notDeepEqual(o[1], o[0]);
  assert.deepEqual(versionOrders(qs, 4, "abc"), o); // sempre igual com a mesma semente
});

test("só troca questões do mesmo formato", () => {
  const qs = [mc(1, ""), { position: 2, type: "essay", options: [], section: "" }, mc(3, ""), mc(4, "", 4)];
  for (const ord of versionOrders(qs, 4, "x")) {
    assert.equal(ord[1], 2); // a discursiva fica no lugar
    assert.equal(ord[3], 4); // a de 4 alternativas fica no lugar
  }
});

test("gabarito e respostas convertem entre versão e original", () => {
  const order = [3, 1, 2];
  const key = [1, 2, 3].map((n) => ({ number: n, accepted: ["ABC"[n - 1]] }));
  const vk = keyForVersion(key, order);
  assert.deepEqual(vk.map((k) => [k.number, k.accepted[0]]), [[1, "C"], [2, "A"], [3, "B"]]);
  assert.deepEqual(answersToBase({ 1: "C", 2: "A", 3: "E" }, order), { 3: "C", 1: "A", 2: "E" });
  const qv = questionsForVersion([mc(1, ""), mc(2, ""), mc(3, "")].map((q, i) => ({ ...q, tag: i + 1 })), order);
  assert.deepEqual(qv.map((q) => [q.position, q.tag]), [[1, 3], [2, 1], [3, 2]]);
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => versionForIndex(i, 4)), [0, 1, 2, 3, 0]);
  assert.equal(versionForIndex(5, 1), 0);
});
