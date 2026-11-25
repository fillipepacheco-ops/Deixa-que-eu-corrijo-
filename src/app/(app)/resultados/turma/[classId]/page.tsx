import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadClassResults } from "@/services/results-data";
import { ClassBoard } from "@/components/results/ClassBoard";
import { EmptyState } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Notas da turma" };

export default async function NotasTurmaPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const res = await loadClassResults(await createClient(), classId, null);
  if (!res) notFound();

  return (
    <>
      <Link href="/resultados" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft size={16} /> Resultados
      </Link>
      <h1 className="mb-1 text-[24px] font-extrabold tracking-tight text-brand-900 sm:text-[28px]">Notas da turma {res.className}</h1>
      <p className="mb-5 text-[14px] text-muted">{[res.school || null, res.subject].filter(Boolean).join(" · ") || "Junte as avaliações para fechar o bimestre."}</p>
      {res.assessments.length === 0 || res.students.length === 0 ? (
        <EmptyState title="Nada para juntar ainda" text="Esta turma ainda não tem avaliações com alunos." />
      ) : (
        <ClassBoard
          classId={classId}
          className={res.className}
          school={res.school}
          initialFormat={res.format}
          formatsReady={res.formatsReady}
          students={res.students}
          assessments={res.assessments.map((a) => ({
            id: a.id,
            title: a.title,
            applied_on: a.applied_on,
            max_score: a.max_score,
            scores: Object.fromEntries(a.scores),
          }))}
        />
      )}
    </>
  );
}
