import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadAssessment, loadStudents } from "@/services/assessment-data";
import { sheetQuestionsFrom } from "@/lib/answer-sheet/layout";
import { keyFromQuestions } from "@/lib/correction/key";
import { CorrectionStation } from "@/components/correction/CorrectionStation";
import { ProofList, type ProofRow } from "@/components/correction/ProofList";
import { EmptyState } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Corrigir pela câmera" };

export default async function CorrigirPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const data = await loadAssessment(supabase, id);
  if (!data) notFound();
  const { assessment, questions, row } = data;

  const specs = sheetQuestionsFrom(questions);
  const [students, { data: sheets }, { data: subs }] = await Promise.all([
    loadStudents(supabase, row.class_id),
    supabase.from("answer_sheets").select("sheet_number, student_id").eq("assessment_id", id),
    supabase.from("submissions").select("student_id, score, correct_count, confirmed_at, image_path").eq("assessment_id", id),
  ]);

  const paths = (subs ?? []).map((s) => s.image_path).filter((p): p is string => !!p);
  const signed = paths.length ? (await supabase.storage.from("answer-sheet-photos").createSignedUrls(paths, 60 * 60)).data ?? [] : [];
  const urlOf = new Map(signed.filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl]));
  const subOf = new Map((subs ?? []).map((s) => [s.student_id as string, s]));

  const rows: ProofRow[] = students.map((st) => {
    const sub = subOf.get(st.id);
    return {
      studentId: st.id,
      name: st.name,
      roll: st.roll_number,
      score: sub?.score !== undefined && sub?.score !== null ? Number(sub.score) : null,
      correct: sub?.correct_count ?? null,
      when: sub?.confirmed_at ? new Date(sub.confirmed_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : null,
      url: sub?.image_path ? (urlOf.get(sub.image_path) ?? null) : null,
    };
  });
  const corrected = Object.fromEntries(rows.filter((r) => r.score !== null).map((r) => [r.studentId, r.score as number]));

  return (
    <>
      <Link href="/correcao" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft size={16} /> Correção
      </Link>
      <h1 className="mb-1 text-[24px] font-extrabold tracking-tight text-brand-900 sm:text-[28px]">{assessment.title}</h1>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-muted">{[assessment.class_name, `${specs.length} questões no cartão`].filter(Boolean).join(" · ")}</p>
        <Link href={`/resultados/${id}`} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-[13px] font-bold text-brand-900 hover:border-brand-200">
          <BarChart3 size={16} /> Ver notas para o diário
        </Link>
      </div>

      {specs.length === 0 ? (
        <EmptyState title="Sem questões objetivas" text="Cadastre questões de múltipla escolha ou certo/errado para corrigir pelo cartão-resposta." />
      ) : students.length === 0 ? (
        <EmptyState title="A avaliação não tem turma com alunos" text="Escolha a turma no cabeçalho da avaliação para o app saber de quem é cada cartão." />
      ) : (
        <div className="space-y-8">
          <CorrectionStation
            assessmentId={id}
            assessmentTitle={assessment.title}
            maxScore={assessment.max_score}
            annulPolicy={assessment.annul_policy}
            answerKey={keyFromQuestions(questions)}
            specs={specs}
            sheets={(sheets ?? []) as { sheet_number: number; student_id: string | null }[]}
            students={students}
            corrected={corrected}
          />
          <ProofList rows={rows} total={students.length} />
        </div>
      )}
    </>
  );
}
