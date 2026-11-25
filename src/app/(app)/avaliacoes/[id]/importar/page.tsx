import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { ImportExam } from "@/components/assessments/ImportExam";

export const metadata: Metadata = { title: "Importar questões" };

export default async function ImportarQuestoesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: a } = await supabase.from("assessments").select("id, title").eq("id", id).maybeSingle();
  if (!a) notFound();

  return (
    <div className="max-w-3xl">
      <Link href={`/avaliacoes/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft size={16} /> {a.title}
      </Link>
      <PageHeader title="Importar questões" description="As questões do arquivo entram no fim desta avaliação. Depois é só conferir no editor." />
      <ImportExam mode="append" assessmentId={id} />
    </div>
  );
}
