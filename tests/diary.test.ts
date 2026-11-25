import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FORMAT,
  combineScores,
  decimalsOf,
  diaryText,
  diaryValue,
  normalizeFormat,
  passes,
  roundTo,
  sortStudents,
  tableText,
  toCsv,
  type DiaryFormat,
} from "../src/lib/results/diary";

const f = (p: Partial<DiaryFormat>): DiaryFormat => ({ ...DEFAULT_FORMAT, ...p });

test("arredondamento: próximo, para cima, para baixo, meio ponto", () => {
  assert.equal(roundTo(7.25, 0.5), 7.5);
  assert.equal(roundTo(7.24, 0.5), 7);
  assert.equal(roundTo(7.01, 0.5, "cima"), 7.5);
  assert.equal(roundTo(7.0, 0.5, "cima"), 7); // exato não sobe
  assert.equal(roundTo(7.49, 0.5, "baixo"), 7);
  assert.equal(roundTo(6.666, 0.1), 6.7);
  assert.equal(roundTo(6.65, 0.1), 6.7); // sem erro de ponto flutuante
  assert.equal(roundTo(8.125, 0.25), 8.25);
  assert.equal(roundTo(8.4, 1), 8);
  assert.equal(decimalsOf(0.25), 2);
  assert.equal(decimalsOf(1), 0);
});

test("nota como vai no diário: vírgula, escala, falta", () => {
  assert.equal(diaryText(7.5, 10, f({})), "7,5");
  assert.equal(diaryText(7, 10, f({})), "7,0");
  assert.equal(diaryText(7, 10, f({ step: 1 })), "7");
  assert.equal(diaryText(7.5, 10, f({ decimal: "." })), "7.5");
  // prova valendo 5, diário em 0–10
  assert.equal(diaryText(3.5, 5, f({ scale: 10 })), "7,0");
  // prova valendo 10, diário em 0–100
  assert.equal(diaryText(6.75, 10, f({ scale: 100, step: 1 })), "68");
  // lança no valor da prova
  assert.equal(diaryText(3.5, 5, f({})), "3,5");
  assert.equal(diaryText(null, 10, f({ absent: "F" })), "F");
  assert.equal(diaryText(undefined, 10, f({})), "");
  assert.equal(diaryValue(9.99, 10, f({ step: 0.5, rounding: "cima" })), 10);
});

test("aprovação pela média da escola", () => {
  assert.equal(passes(6, 10, f({ passPercent: 60 })), true);
  assert.equal(passes(5.9, 10, f({ passPercent: 60 })), false);
  assert.equal(passes(50, 100, f({ passPercent: 50 })), true);
});

test("formato salvo é validado", () => {
  const n = normalizeFormat({ scale: "10", step: 0.3, rounding: "x", decimal: ".", absent: 5, order: "alfabetica", passPercent: 500 });
  assert.equal(n.scale, 10);
  assert.equal(n.step, DEFAULT_FORMAT.step);
  assert.equal(n.rounding, "proximo");
  assert.equal(n.decimal, ".");
  assert.equal(n.absent, "");
  assert.equal(n.order, "alfabetica");
  assert.equal(n.passPercent, 60);
  assert.equal(normalizeFormat(null).scale, null);
});

test("ordem de chamada e alfabética", () => {
  const list = [
    { id: "1", name: "Bruna", roll_number: 2 },
    { id: "2", name: "Álvaro", roll_number: null },
    { id: "3", name: "Carlos", roll_number: 1 },
  ];
  assert.deepEqual(sortStudents(list, "chamada").map((s) => s.id), ["3", "1", "2"]);
  assert.deepEqual(sortStudents(list, "alfabetica").map((s) => s.id), ["2", "1", "3"]);
});

test("notas da turma: soma e média, falta conta zero", () => {
  const items = [
    { score: 4, max: 5 },
    { score: 2.5, max: 3 },
    { score: null, max: 2 },
  ];
  assert.deepEqual(combineScores(items, "soma", f({})), { value: 6.5, max: 10 });
  assert.deepEqual(combineScores(items, "media", f({})), { value: 6.5, max: 10 });
  assert.deepEqual(combineScores([{ score: 7, max: 10 }, { score: 8, max: 10 }], "media", f({ step: 0.5 })), { value: 7.5, max: 10 });
  assert.deepEqual(combineScores([{ score: 7, max: 10 }, { score: 8, max: 10 }], "soma", f({})), { value: 15, max: 20 });
});

test("copiar para planilha e CSV em português", () => {
  assert.equal(tableText([["1", "Ana\tMaria", "7,5"]]), "1\tAna Maria\t7,5");
  const csv = toCsv([["Nº", "Aluno", "Nota"], ["1", 'Ana "Bia"', "7,5"]]);
  assert.ok(csv.startsWith("﻿Nº;Aluno;Nota\r\n"));
  assert.ok(csv.includes('1;"Ana ""Bia""";7,5'));
});
