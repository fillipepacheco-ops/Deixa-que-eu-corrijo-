import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { buildPrintPdf } from "../src/services/print";

/** Supabase falso: só o suficiente para montar a impressão. */
function fakeSupabase() {
  const tables: Record<string, unknown[]> = {
    assessments: [{ id: "a1", class_id: "c1", title: "Prova de Teste", subject: "Matemática", grade_level: "9º ano", teacher_name: "Prof", school_name: "Escola", school_logo_path: null, applied_on: "2026-12-01", instructions: null, template: "larga_escala", max_score: 10, annul_policy: "credit_all", status: "draft", classes: { name: "9º A" } }],
    assessment_questions: [
      { id: "q1", position: 1, type: "multiple_choice", statement: "Quanto é 2+2?", options: [{ label: "A", text: "3" }, { label: "B", text: "4" }], correct_answers: ["B"], weight: 1, annulled: false, table_data: null, image_path: null },
      { id: "q2", position: 2, type: "true_false", statement: "1 é primo.", options: [], correct_answers: ["E"], weight: 1, annulled: false, table_data: null, image_path: null },
    ],
    students: [
      { id: "s1", name: "Ana", roll_number: 1 },
      { id: "s2", name: "Bruno", roll_number: 2 },
    ],
    answer_sheets: [],
  };
  let seq = 1000;
  const query = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    let inserted: unknown[] | null = null;
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (col: string, val: unknown) => {
        rows = rows.filter((r) => (r as Record<string, unknown>)[col] === undefined || (r as Record<string, unknown>)[col] === val);
        return q;
      },
      order: () => q,
      maybeSingle: async () => ({ data: rows[0] ?? null }),
      single: async () => ({ data: (inserted ?? rows)[0] ?? null }),
      insert: (vals: Record<string, unknown>[]) => {
        inserted = vals.map((v) => ({ ...v, sheet_number: ++seq }));
        tables[table].push(...inserted);
        return q;
      },
      then: (res: (v: unknown) => void) => res({ data: inserted ?? rows, error: null }),
    };
    return q;
  };
  return { from: query, storage: { from: () => ({ download: async () => ({ data: null }) }) } } as never;
}

async function pages(bytes: Uint8Array) {
  return (await PDFDocument.load(bytes)).getPageCount();
}

test("impressão: turma toda e um aluno; prova, cartão e prova + cartão", async () => {
  const sb = fakeSupabase();
  const provaUm = await pages(await buildPrintPdf(sb, "a1", { doc: "prova", studentId: "s1" }));
  assert.ok(provaUm >= 2); // capa + questões
  assert.equal(await pages(await buildPrintPdf(sb, "a1", { doc: "prova" })), provaUm * 2);
  assert.equal(await pages(await buildPrintPdf(sb, "a1", { doc: "prova", blank: true })), provaUm);
  assert.equal(await pages(await buildPrintPdf(sb, "a1", { doc: "cartao", studentId: "s2" })), 1);
  assert.equal(await pages(await buildPrintPdf(sb, "a1", { doc: "cartao" })), 2 + 3); // 2 alunos + 3 em branco
  assert.equal(await pages(await buildPrintPdf(sb, "a1", { doc: "kit" })), (provaUm + 1) * 2);
  assert.equal(await pages(await buildPrintPdf(sb, "a1", { doc: "kit", studentId: "s1" })), provaUm + 1);
  await assert.rejects(() => buildPrintPdf(sb, "a1", { doc: "prova", studentId: "nao-existe" }), /Aluno não encontrado/);
});
