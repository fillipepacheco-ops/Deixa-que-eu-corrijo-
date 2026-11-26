import { termOf } from "@/lib/assessment/term";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gradeSubmission, type GivenAnswer } from "@/lib/grading/grading";
import { analyzeQuestions, summarizeScores } from "@/lib/grading/stats";
import { keyFromQuestions } from "@/lib/correction/key";
import { sheetQuestionsFrom } from "@/lib/answer-sheet/layout";
import { DEFAULT_FORMAT, normalizeFormat, schoolKey, sortStudents, type DiaryFormat } from "@/lib/results/diary";
import { loadAssessment } from "./assessment-data";

export interface ResultStudent {
  id: string;
  name: string;
  roll_number: number | null;
  registration: string | null;
}

export interface ResultRow extends ResultStudent {
  score: number | null; // na escala da prova
  correct: number | null;
  source: string | null; // camera | manual | ...
  proofPath: string | null;
}

/** Formatos de diário salvos, por escola. Se a tabela ainda não existir, usa o padrão. */
export async function loadDiaryFormats(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("diary_formats").select("school_name, settings");
  const map = new Map<string, DiaryFormat>();
  for (const r of data ?? []) map.set(schoolKey(r.school_name as string), normalizeFormat(r.settings));
  return { map, ready: !error };
}

export function formatFor(map: Map<string, DiaryFormat>, school: string | null | undefined) {
  return map.get(schoolKey(school)) ?? DEFAULT_FORMAT;
}

export async function loadClassStudents(supabase: SupabaseClient, classId: string | null): Promise<ResultStudent[]> {
  if (!classId) return [];
  const { data } = await supabase.from("students").select("id, name, roll_number, registration").eq("class_id", classId).eq("active", true);
  return (data ?? []) as ResultStudent[];
}

/**
 * Notas de uma avaliação, sempre conferidas com o gabarito ATUAL:
 * se o professor mudou o gabarito ou anulou questão depois de corrigir,
 * a nota é recalculada (e atualizada no banco).
 */
export async function loadAssessmentResults(supabase: SupabaseClient, id: string) {
  const data = await loadAssessment(supabase, id);
  if (!data) return null;
  const { assessment, questions, row } = data;
  const key = keyFromQuestions(questions);
  const [students, { data: subs }, formats] = await Promise.all([
    loadClassStudents(supabase, row.class_id),
    supabase.from("submissions").select("id, student_id, source, answers, manual_points, score, correct_count, image_path").eq("assessment_id", id),
    loadDiaryFormats(supabase),
  ]);

  const fixes: { id: string; score: number; correct_count: number }[] = [];
  const answersList: Record<number, GivenAnswer>[] = [];
  const subOf = new Map<string, { score: number; correct: number | null; source: string; proofPath: string | null }>();
  for (const s of subs ?? []) {
    let score = s.score === null ? null : Number(s.score);
    let correct = s.correct_count as number | null;
    if (s.source !== "manual" && key.length) {
      const answers: Record<number, GivenAnswer> = {};
      for (const [k, v] of Object.entries((s.answers ?? {}) as Record<string, GivenAnswer>)) answers[Number(k)] = v;
      const manualPoints: Record<number, number> = {};
      for (const [k, v] of Object.entries((s.manual_points ?? {}) as Record<string, number>)) manualPoints[Number(k)] = Number(v);
      const g = gradeSubmission(key, answers, { maxScore: assessment.max_score, annulPolicy: assessment.annul_policy, manualPoints });
      answersList.push(answers);
      if (score === null || Math.abs(g.score - score) > 0.001 || g.correctCount !== correct) {
        fixes.push({ id: s.id as string, score: g.score, correct_count: g.correctCount });
      }
      score = g.score;
      correct = g.correctCount;
    }
    if (score === null) continue;
    subOf.set(s.student_id as string, { score, correct, source: s.source as string, proofPath: (s.image_path as string | null) ?? null });
  }
  if (fixes.length) {
    await Promise.all(fixes.map((f) => supabase.from("submissions").update({ score: f.score, correct_count: f.correct_count }).eq("id", f.id)));
  }

  const school = schoolKey(row.school_name);
  const format = formatFor(formats.map, school);
  const rows: ResultRow[] = sortStudents<ResultStudent>(students, format.order).map((st) => {
    const sub = subOf.get(st.id);
    return { ...st, score: sub?.score ?? null, correct: sub?.correct ?? null, source: sub?.source ?? null, proofPath: sub?.proofPath ?? null };
  });

  const specs = sheetQuestionsFrom(questions);
  const optionLabels = Object.fromEntries(specs.map((s) => [s.number, s.labels]));
  const analysis = analyzeQuestions(
    key.filter((k) => specs.some((s) => s.number === k.number)),
    answersList,
    optionLabels,
  );

  return {
    assessment,
    row,
    school,
    format,
    formatsReady: formats.ready,
    rows,
    summary: summarizeScores(rows.filter((r) => r.score !== null).map((r) => r.score as number)),
    analysis,
    regraded: fixes.length,
  };
}

export interface ClassAssessmentScores {
  id: string;
  title: string;
  applied_on: string | null;
  max_score: number;
  school: string;
  logoPath: string | null;
  term: number | null;
  scores: Map<string, number>; // aluno → nota
}

/**
 * Notas da turma em todas as avaliações (ou só nas escolhidas), na ordem de aplicação.
 * A escola da turma é a que aparece nas avaliações dela.
 */
export async function loadClassResults(supabase: SupabaseClient, classId: string, ids: string[] | null) {
  const { data: cls } = await supabase.from("classes").select("id, name, subject").eq("id", classId).maybeSingle();
  if (!cls) return null;
  const { data: list } = await supabase
    .from("assessments")
    .select("id, applied_on, created_at")
    .eq("class_id", classId)
    .order("applied_on", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  const all = (list ?? []).map((a) => a.id as string);
  const chosen = ids ? all.filter((id) => ids.includes(id)) : all;
  const [students, formats, results] = await Promise.all([
    loadClassStudents(supabase, classId),
    loadDiaryFormats(supabase),
    Promise.all(chosen.map((id) => loadAssessmentResults(supabase, id))),
  ]);
  const assessments: ClassAssessmentScores[] = results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((r) => ({
      id: r.assessment.id,
      title: r.assessment.title,
      applied_on: r.assessment.applied_on,
      max_score: r.assessment.max_score,
      school: r.school,
      logoPath: (r.row.school_logo_path as string | null) ?? null,
      term: termOf(r.assessment),
      scores: new Map(r.rows.filter((x) => x.score !== null).map((x) => [x.id, x.score as number])),
    }));
  // escola mais frequente entre as avaliações da turma
  const count = new Map<string, number>();
  for (const a of assessments) count.set(a.school, (count.get(a.school) ?? 0) + 1);
  const school = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const format = formatFor(formats.map, school);
  return {
    classId,
    className: cls.name as string,
    subject: (cls.subject as string | null) ?? null,
    school,
    format,
    formatsReady: formats.ready,
    students: sortStudents<ResultStudent>(students, format.order),
    // logo da escola: a da avaliação mais recente que tiver
    logoPath: [...assessments].reverse().find((a) => a.logoPath)?.logoPath ?? null,
    allIds: all,
    assessments,
  };
}
