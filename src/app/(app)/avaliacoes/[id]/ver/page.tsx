import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, Pencil, ScanLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PdfViewer } from "@/components/viewer/PdfViewer";
import { FileButton } from "@/components/assessments/FileButton";
import { buttonClass } from "@/components/ui/button";
import { fileSlug } from "@/lib/assessment/header";
import { PrintPanel } from "@/components/assessments/PrintPanel";
import { loadAssessment, loadStudents } from "@/services/assessment-data";
import { sheetQuestionsFrom } from "@/lib/answer-sheet/layout";

export const metadata: Metadata = { title: "Ver prova" };

export default async function VerProvaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const { id } = await params;
  const { doc } = await searchParams;
  const supabase = await createClient();
  const data = await loadAssessment(supabase, id);
  if (!data) notFound();
  const a = data.assessment;
  const students = await loadStudents(supabase, data.row.class_id);

  const isCard = doc === "cartao";
  const src = isCard ? `/api/avaliacoes/${id}/cartoes` : `/api/avaliacoes/${id}/pdf?modo=branco`;
  const slug = fileSlug(a.title);
  const tab = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[14px] font-semibold transition ${
      active ? "bg-white text-brand-900 shadow-sm" : "text-brand-700 hover:bg-white/60"
    }`;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/avaliacoes/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
          <ArrowLeft size={16} /> Voltar para a edição
        </Link>
        <Link href={`/avaliacoes/${id}`} className={buttonClass("secondary")}>
          <Pencil size={16} /> Editar prova
        </Link>
      </div>

      <h1 className="mb-4 text-[24px] font-extrabold tracking-tight text-brand-900 sm:text-[28px]">{a.title}</h1>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-brand-50 p-1">
          <Link href={`/avaliacoes/${id}/ver`} className={tab(!isCard)} replace>
            <FileDown size={16} /> Prova
          </Link>
          <Link href={`/avaliacoes/${id}/ver?doc=cartao`} className={tab(isCard)} replace>
            <ScanLine size={16} /> Cartão-resposta
          </Link>
        </div>
        <div className="w-full sm:w-80">
          <FileButton
            key={src}
            href={src}
            filename={isCard ? `cartoes-${slug}.pdf` : `${slug}.pdf`}
            mime="application/pdf"
            icon={<FileDown size={24} />}
            title="Imprimir ou salvar"
            subtitle="Gera o arquivo desta visualização"
          />
          <a href="#imprimir" className="mt-2 block text-center text-[13px] font-semibold text-brand-700 underline">
            Imprimir só para alguns alunos
          </a>
        </div>
      </div>

      <div className="rounded-3xl bg-[#e9eee9] px-2 py-6 sm:px-6">
        <PdfViewer key={src} src={src} />
      </div>

      {/* Imprimir para a turma toda ou só para os alunos escolhidos */}
      <div className="mt-6">
        <PrintPanel
          assessmentId={id}
          slug={slug}
          students={students}
          className={a.class_name ?? null}
          hasQuestions={data.questions.length > 0}
          hasObjective={sheetQuestionsFrom(data.questions).length > 0}
        />
      </div>
    </>
  );
}
