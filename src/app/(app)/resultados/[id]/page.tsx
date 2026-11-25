import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateBR } from "@/lib/assessment/header";
import { loadAssessmentResults } from "@/services/results-data";
import { ResultsBoard, type BoardRow } from "@/components/results/ResultsBoard";
import { QuestionAnalysisCard } from "@/components/results/QuestionAnalysisCard";
import { EmptyState } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Resultado da avaliação" };

export default async function ResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const res = await loadAssessmentResults(supabase, id);
  if (!res) notFound();
  const a = res.assessment;

  const paths = res.rows.map((r) => r.proofPath).filter((p): p is string => !!p);
  const signed = paths.length ? ((await supabase.storage.from("answer-sheet-photos").createSignedUrls(paths, 60 * 60)).data ?? []) : [];
  const urlOf = new Map(signed.filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl]));
  const rows: BoardRow[] = res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    roll_number: r.roll_number,
    registration: r.registration,
    score: r.score,
    correct: r.correct,
    source: r.source,
    proofUrl: r.proofPath ? (urlOf.get(r.proofPath) ?? null) : null,
  }));

  return (
    <>
      <Link href="/resultados" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft size={16} /> Resultados
      </Link>
      <h1 className="mb-1 text-[24px] font-extrabold tracking-tight text-brand-900 sm:text-[28px]">{a.title}</h1>
      <p className="mb-5 text-[14px] text-muted">
        {[res.school || null, a.class_name, a.subject, a.applied_on ? formatDateBR(a.applied_on) : null, `vale ${String(a.max_score).replace(".", ",")}`].filter(Boolean).join(" · ")}
      </p>
      {res.regraded > 0 && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          O gabarito mudou depois da correção: {res.regraded} nota(s) foram recalculadas automaticamente.
        </p>
      )}
      {rows.length === 0 ? (
        <EmptyState title="A avaliação não tem turma com alunos" text="Escolha a turma no cabeçalho da avaliação para ver as notas por aluno." />
      ) : (
        <div className="space-y-6">
          <ResultsBoard
            assessmentId={id}
            title={a.title}
            maxScore={a.max_score}
            school={res.school}
            initialFormat={res.format}
            formatsReady={res.formatsReady}
            rows={rows}
          />
          <QuestionAnalysisCard analysis={res.analysis} />
        </div>
      )}
    </>
  );
}
