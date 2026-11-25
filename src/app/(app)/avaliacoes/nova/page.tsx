import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAssessment } from "@/services/assessments";
import { Card, PageHeader } from "@/components/ui/PageHeader";
import { ActionForm } from "@/components/ui/ActionForm";
import { HeaderFields } from "@/components/assessments/HeaderFields";

export const metadata: Metadata = { title: "Nova avaliação" };

export default async function NovaAvaliacaoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: classes }, { data: profile }] = await Promise.all([
    supabase.from("classes").select("id, name, subject, grade_level").order("name"),
    supabase.from("profiles").select("full_name, school_name").eq("id", user!.id).maybeSingle(),
  ]);

  return (
    <>
      <Link href="/avaliacoes" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft size={16} /> Avaliações
      </Link>
      <PageHeader
        eyebrow="Passo 1 de 2 — Cabeçalho"
        title="Nova avaliação"
        description="Modelo de larga escala: capa com cabeçalho e instruções, Arial 12, texto justificado e espaçamento 1,5. Estes dados também saem nos cartões-resposta."
      />
      <Card className="max-w-3xl p-5 sm:p-6">
        <ActionForm action={createAssessment} submitLabel="Criar e adicionar questões" submitClassName="w-full sm:w-auto">
          <HeaderFields
            classes={classes ?? []}
            value={{ teacher_name: profile?.full_name ?? "", school_name: profile?.school_name ?? "" }}
          />
        </ActionForm>
      </Card>
    </>
  );
}
