import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStudentList } from "../src/lib/students/parse";

test("lista de alunos colada em vários formatos", () => {
  const r = parseStudentList(
    ["1 Ana Beatriz Souza", "2. João  Pedro Lima", "", "15;Maria Clara;2026001", "Pedro Henrique\t2026002", "Lucas"].join("\n"),
  );
  assert.deepEqual(r, [
    { name: "Ana Beatriz Souza", roll_number: 1, registration: null },
    { name: "João Pedro Lima", roll_number: 2, registration: null },
    { name: "Maria Clara", roll_number: 15, registration: "2026001" },
    { name: "Pedro Henrique", roll_number: null, registration: "2026002" },
    { name: "Lucas", roll_number: null, registration: null },
  ]);
  assert.deepEqual(parseStudentList("   \n\n"), []);
});
