import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDateBR, fileSlug } from "@/lib/assessment/header";
import { combineScores, diaryMax, diaryText, diaryValue, formatNumber, formatRaw, passes, sortStudents, toCsv, type Combine, type DiaryFormat } from "@/lib/results/diary";
import { generateGradesPdf, type GradesColumn } from "@/lib/pdf/grades-pdf";
import { loadAssessmentResults, loadClassResults } from "./results-data";

export interface ExportFile {
  bytes: Uint8Array;
  filename: string;
  mime: string;
}

const enc = (s: string) => new TextEncoder().encode(s);

/** Lista de notas de UMA avaliação, já no formato do diário da escola. */
export async function exportAssessment(supabase: SupabaseClient, id: string, kind: "pdf" | "planilha", fmtOverride: DiaryFormat | null): Promise<ExportFile | null> {
  const res = await loadAssessmentResults(supabase, id);
  if (!res) return null;
  const fmt = fmtOverride ?? res.format;
  const a = res.assessment;
  const rows = sortStudents(res.rows, fmt.order);
  const max = diaryMax(a.max_score, fmt);
  const head = ["Nº", ...(fmt.showRegistration ? ["Matrícula"] : []), "Aluno", `Nota (0 a ${formatNumber(max, { step: max % 1 ? 0.1 : 1, decimal: fmt.decimal })})`];
  const body = rows.map((r) => [r.roll_number ? String(r.roll_number) : "", ...(fmt.showRegistration ? [r.registration ?? ""] : []), r.name, diaryText(r.score, a.max_score, fmt)]);
  const base = fileSlug(`notas ${a.title} ${a.class_name ?? ""}`);

  if (kind === "planilha") return { bytes: enc(toCsv([head, ...body])), filename: `${base}.csv`, mime: "text/csv" };

  const graded = rows.filter((r) => r.score !== null);
  const values = graded.map((r) => diaryValue(r.score as number, a.max_score, fmt));
  const mean = values.length ? values.reduce((x, y) => x + y, 0) / values.length : null;
  const below = graded.filter((r) => !passes(diaryValue(r.score as number, a.max_score, fmt), max, fmt)).length;
  const columns: GradesColumn[] = [
    { label: "Nº", width: 1, align: "center" },
    ...(fmt.showRegistration ? [{ label: "Matrícula", width: 2.4 } as GradesColumn] : []),
    { label: "Aluno", width: 9 },
    { label: head[head.length - 1], width: 2.6, align: "center" },
  ];
  const bytes = await generateGradesPdf({
    title: a.title,
    info: [a.school_name ?? "", [a.class_name, a.subject].filter(Boolean).join(" · "), a.applied_on ? `Aplicada em ${formatDateBR(a.applied_on)}` : ""],
    columns,
    rows: body,
    highlight: rows.map((r) => r.score !== null && !passes(diaryValue(r.score, a.max_score, fmt), max, fmt)),
    notes: [
      `Corrigidas: ${graded.length} de ${rows.length}` + (mean !== null ? ` · Média da turma: ${formatNumber(Math.round(mean * 100) / 100, { step: 0.01, decimal: fmt.decimal })}` : ""),
      `Abaixo da média (${fmt.passPercent}%): ${below} aluno(s), em destaque.` + (fmt.absent ? ` · "${fmt.absent}" = não fez a prova.` : ""),
    ],
  });
  return { bytes, filename: `${base}.pdf`, mime: "application/pdf" };
}

/** Notas da turma: uma coluna por avaliação + resultado (soma ou média). */
export async function exportClass(
  supabase: SupabaseClient,
  classId: string,
  ids: string[] | null,
  combine: Combine,
  kind: "pdf" | "planilha",
  fmtOverride: DiaryFormat | null,
): Promise<ExportFile | null> {
  const res = await loadClassResults(supabase, classId, ids);
  if (!res) return null;
  const fmt = fmtOverride ?? res.format;
  const students = sortStudents(res.students, fmt.order);
  const resultLabel = combine === "soma" ? "Soma" : `Média (0 a ${fmt.scale ?? 10})`;
  const head = [
    "Nº",
    ...(fmt.showRegistration ? ["Matrícula"] : []),
    "Aluno",
    ...res.assessments.map((a) => `${a.title} (${formatRaw(a.max_score, fmt.decimal)})`),
    resultLabel,
  ];
  const body = students.map((s) => {
    const items = res.assessments.map((a) => ({ score: a.scores.get(s.id) ?? null, max: a.max_score }));
    const total = combineScores(items, combine, fmt);
    return [
      s.roll_number ? String(s.roll_number) : "",
      ...(fmt.showRegistration ? [s.registration ?? ""] : []),
      s.name,
      ...items.map((i) => (i.score === null ? fmt.absent : formatRaw(i.score, fmt.decimal))),
      formatNumber(total.value, fmt),
    ];
  });
  const base = fileSlug(`notas turma ${res.className}`);
  if (kind === "planilha") return { bytes: enc(toCsv([head, ...body])), filename: `${base}.csv`, mime: "text/csv" };

  const bytes = await generateGradesPdf({
    title: `Notas da turma ${res.className}`,
    info: [res.school, `${res.assessments.length} avaliação(ões) · resultado: ${combine === "soma" ? "soma dos pontos" : "média"}`],
    columns: [
      { label: "Nº", width: 1, align: "center" },
      ...(fmt.showRegistration ? [{ label: "Matrícula", width: 2.2 } as GradesColumn] : []),
      { label: "Aluno", width: 7 },
      ...res.assessments.map((a) => ({ label: a.title, width: 2, align: "center" }) as GradesColumn),
      { label: resultLabel, width: 2.2, align: "center" },
    ],
    rows: body,
    landscape: res.assessments.length > 3,
    notes: [fmt.absent ? `"${fmt.absent}" = não fez a avaliação (conta 0 no resultado).` : "Em branco = não fez a avaliação (conta 0 no resultado)."],
  });
  return { bytes, filename: `${base}.pdf`, mime: "application/pdf" };
}
