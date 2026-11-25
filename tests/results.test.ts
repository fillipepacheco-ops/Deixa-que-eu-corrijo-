import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { loadAssessmentResults, loadClassResults } from "../src/services/results-data";
import { exportAssessment, exportClass } from "../src/services/results-export";
import { DEFAULT_FORMAT } from "../src/lib/results/diary";

/** Supabase falso com duas provas da mesma turma. */
function fakeSupabase(opts: { formats?: boolean } = {}) {
  const updates: unknown[] = [];
  const base = { subject: "Matemática", grade_level: "9º ano", teacher_name: "Prof", school_logo_path: null, instructions: null, template: "larga_escala", annul_policy: "credit_all", status: "draft", classes: { name: "9º A" } };
  const tables: Record<string, Record<string, unknown>[]> = {
    classes: [{ id: "c1", name: "9º A", subject: "Matemática" }],
    assessments: [
      { ...base, id: "a1", class_id: "c1", title: "Prova 1", school_name: "Escola Master", applied_on: "2026-10-01", max_score: 5, created_at: "1" },
      { ...base, id: "a2", class_id: "c1", title: "Prova 2", school_name: "Escola Master", applied_on: "2026-11-01", max_score: 5, created_at: "2" },
    ],
    assessment_questions: [
      { id: "q1", assessment_id: "a1", position: 1, type: "multiple_choice", statement: "x", options: [{ label: "A", text: "" }, { label: "B", text: "" }], correct_answers: ["B"], weight: 1, annulled: false, table_data: null, image_path: null },
      { id: "q2", assessment_id: "a1", position: 2, type: "multiple_choice", statement: "y", options: [{ label: "A", text: "" }, { label: "B", text: "" }], correct_answers: ["A"], weight: 1, annulled: false, table_data: null, image_path: null },
    ],
    students: [
      { id: "s1", class_id: "c1", name: "Carlos", roll_number: 2, registration: "123", active: true },
      { id: "s2", class_id: "c1", name: "Ana", roll_number: 1, registration: "456", active: true },
      { id: "s3", class_id: "c1", name: "Bia", roll_number: 3, registration: null, active: true },
    ],
    submissions: [
      // nota antiga (gabarito mudou): deve virar 5 (2 acertos de 2)
      { id: "x1", assessment_id: "a1", student_id: "s1", source: "camera", answers: { "1": "B", "2": "A" }, manual_points: {}, score: 2.5, correct_count: 1, image_path: "p/1.jpg" },
      { id: "x2", assessment_id: "a1", student_id: "s2", source: "camera", answers: { "1": "B", "2": "B" }, manual_points: {}, score: 2.5, correct_count: 1, image_path: null },
      { id: "x3", assessment_id: "a2", student_id: "s1", source: "manual", answers: {}, manual_points: {}, score: 3.75, correct_count: null, image_path: null },
    ],
    diary_formats: [{ school_name: "Escola Master", settings: { scale: 10, step: 0.5, rounding: "cima", absent: "F" } }],
  };
  const query = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    let error: unknown = null;
    if (table === "diary_formats" && opts.formats === false) {
      rows = [];
      error = { message: 'relation "diary_formats" does not exist' };
    }
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (col: string, val: unknown) => {
        rows = rows.filter((r) => r[col] === undefined || r[col] === val);
        return q;
      },
      order: () => q,
      update: (vals: unknown) => {
        updates.push(vals);
        return q;
      },
      maybeSingle: async () => ({ data: rows[0] ?? null }),
      then: (res: (v: unknown) => void) => res({ data: rows, error }),
    };
    return q;
  };
  return { sb: { from: query } as never, updates };
}

test("resultados: recalcula com o gabarito atual e ordena pela chamada", async () => {
  const { sb, updates } = fakeSupabase();
  const r = await loadAssessmentResults(sb, "a1");
  assert.ok(r);
  assert.equal(r.school, "Escola Master");
  assert.equal(r.format.scale, 10);
  assert.equal(r.format.absent, "F");
  assert.deepEqual(r.rows.map((x) => x.name), ["Ana", "Carlos", "Bia"]);
  assert.equal(r.rows[1].score, 5); // recalculada
  assert.equal(r.rows[0].score, 2.5);
  assert.equal(r.rows[2].score, null);
  assert.equal(r.regraded, 1);
  assert.equal(updates.length, 1);
  assert.equal(r.analysis.find((q) => q.number === 2)?.hitRate, 50);
});

test("resultados: sem a tabela de formatos, usa o padrão", async () => {
  const { sb } = fakeSupabase({ formats: false });
  const r = await loadAssessmentResults(sb, "a1");
  assert.equal(r?.formatsReady, false);
  assert.deepEqual(r?.format, DEFAULT_FORMAT);
});

test("lista de notas: planilha e PDF no formato da escola", async () => {
  const { sb } = fakeSupabase();
  const csv = await exportAssessment(sb, "a1", "planilha", null);
  const text = new TextDecoder().decode(csv!.bytes);
  // prova vale 5, diário 0–10, meio ponto para cima, falta = F
  assert.match(text, /Nº;Aluno;Nota \(0 a 10\)\r\n1;Ana;5,0\r\n2;Carlos;10,0\r\n3;Bia;F/);
  const pdf = await exportAssessment(sb, "a1", "pdf", { ...DEFAULT_FORMAT, showRegistration: true });
  assert.equal((await PDFDocument.load(pdf!.bytes)).getPageCount(), 1);
  writeFileSync("/tmp/notas-avaliacao.pdf", pdf!.bytes);
});

test("notas da turma: soma e média das provas escolhidas", async () => {
  const { sb } = fakeSupabase();
  const c = await loadClassResults(sb, "c1", null);
  assert.equal(c?.assessments.length, 2);
  const soma = new TextDecoder().decode((await exportClass(sb, "c1", null, "soma", "planilha", { ...DEFAULT_FORMAT, absent: "F" }))!.bytes);
  // Carlos: 5 + 3,75 = 8,75 → 8,8 (uma casa); Ana: 2,5 + 0 = 2,5
  assert.match(soma, /2;Carlos;5;3,75;8,8/);
  assert.match(soma, /1;Ana;2,5;F;2,5/);
  const media = new TextDecoder().decode((await exportClass(sb, "c1", ["a1"], "media", "planilha", DEFAULT_FORMAT))!.bytes);
  assert.match(media, /Média \(0 a 10\)/);
  assert.match(media, /2;Carlos;5;10,0/);
  const pdf = await exportClass(sb, "c1", null, "soma", "pdf", null);
  writeFileSync("/tmp/notas-turma.pdf", pdf!.bytes);
});
