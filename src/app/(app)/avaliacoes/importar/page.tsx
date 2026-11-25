import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAssessment } from "@/services/assessments";
import { schoolLogoUrl } from "@/services/assessment-data";
import { Card, PageHeader } from "@/components/ui/PageHeader";
import { ActionForm } from "@/components/ui/ActionForm";
import { HeaderFields } from "@/components/assessments/HeaderFields";
import { ImportExam } from "@/components/assessments/ImportExam";

export const metadata: Metadata = { title: "Importar prova" };

export default async function ImportarProvaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: classes }, { data: profile }] = await Promise.all([
    supabase.from("classes").select("id, name, subject, grade_level").order("name"),
    supabase.from("profiles").select("full_name, school_name, school_logo_path").eq("id", user!.id).maybeSingle(),
  ]);

  return (
    <>
      <Link href="/avaliacoes" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft size={16} /> Avaliações
      </Link>
      <PageHeader
        title="Importar prova"
        description="Traga uma prova que você já tem em PDF ou Word. Ela ganha o modelo do app (capa, 2 colunas, Arial 12) e os cartões-resposta."
      />
      <ActionForm action={createAssessment} submitLabel="Criar avaliação com as questões importadas" submitClassName="w-full sm:w-auto" className="max-w-3xl space-y-6">
        <section>
          <h2 className="mb-2 text-[15px] font-extrabold text-brand-900">1. Arquivo da prova</h2>
          <ImportExam mode="new" />
        </section>
        <section>
          <h2 className="mb-2 text-[15px] font-extrabold text-brand-900">2. Cabeçalho</h2>
          <Card className="p-5 sm:p-6">
            <HeaderFields
              classes={classes ?? []}
              value={{
                teacher_name: profile?.full_name ?? "",
                school_name: profile?.school_name ?? "",
                school_logo_path: profile?.school_logo_path ?? null,
              }}
              logoUrl={await schoolLogoUrl(supabase, profile?.school_logo_path)}
            />
          </Card>
        </section>
      </ActionForm>
    </>
  );
}
