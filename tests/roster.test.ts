import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, rosterFromLines, rosterFromRows, tidyName } from "../src/lib/students/roster";
import { parseStudentList } from "../src/lib/students/parse";

test("planilha com cabeçalho (Excel/CSV)", () => {
  const rows = [
    ["Centro de Ensino Fundamental 01", "", ""],
    ["Nº", "Nome do aluno", "Matrícula"],
    ["1", "ANA BEATRIZ DE SOUZA", "2023001"],
    ["2", "João Pedro Lima", "2023002"],
    ["", "", ""],
  ];
  const out = rosterFromRows(rows);
  assert.deepEqual(out, ["1;Ana Beatriz de Souza;2023001", "2;João Pedro Lima;2023002"]);
  assert.deepEqual(parseStudentList(out.join("\n"))[0], { name: "Ana Beatriz de Souza", roll_number: 1, registration: "2023001" });
});

test("planilha sem cabeçalho", () => {
  assert.deepEqual(rosterFromRows([["01", "Maria Clara Alves"], ["02", "Pedro Henrique"]]), ["1;Maria Clara Alves", "2;Pedro Henrique"]);
});

test("texto de PDF/Word: tira cabeçalhos e separa nº e matrícula", () => {
  const out = rosterFromLines([
    "ESCOLA MASTER — LISTA DE ALUNOS",
    "Turma: 9º ano A   Professor: Fillipe",
    "01 - ANA BEATRIZ SOUZA 2023001",
    "2. João Pedro Lima",
    "Maria Clara Alves",
    "Página 1 de 2",
  ]);
  assert.deepEqual(out, ["1;Ana Beatriz Souza;2023001", "2;João Pedro Lima", "Maria Clara Alves"]);
  assert.deepEqual(parseStudentList(out.join("\n")).map((s) => s.name), ["Ana Beatriz Souza", "João Pedro Lima", "Maria Clara Alves"]);
});

test("CSV com ; e aspas; nomes", () => {
  assert.deepEqual(parseCsv('nome;matricula\n"Silva, Ana";123\n'), [["nome", "matricula"], ["Silva, Ana", "123"]]);
  assert.equal(tidyName("MARIA DAS DORES DOS SANTOS"), "Maria das Dores dos Santos");
  assert.equal(tidyName("Ana McDonald"), "Ana McDonald");
});
