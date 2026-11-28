/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { School, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createSchool, deleteSchool, updateSchool } from "@/services/schools";
import { loadSchools } from "@/services/school-context";
import { schoolLogoUrl } from "@/services/assessment-data";
import { Card, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { LogoUpload } from "@/components/assessments/LogoUpload";

export const metadata: Metadata = { title: "Escolas" };

export default async function EscolasPage() {
  const supabase = await createClient();
  const [schools, { data: classes }] = await Promise.all([loadSchools(supabase), supabase.from("classes").select("id, name, school_id").order("name")]);
  const logos = await Promise.all(schools.map((s) => schoolLogoUrl(supabase, s.logo_path)));

  return (
    <>
      <PageHeader
        title="Escolas"
        description="Cada escola tem as suas turmas e a sua logo. A logo vai sozinha para a prova, o cartão-resposta e as listas de notas das turmas daquela escola."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {schools.length === 0 ? (
            <EmptyState title="Nenhuma escola ainda" text="Cadastre ao lado as escolas em que você trabalha." />
          ) : (
            schools.map((s, i) => {
              const own = (classes ?? []).filter((c) => c.school_id === s.id);
              return (
                <Card key={s.id} className="p-5">
                  <div className="flex items-center gap-4">
                    <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">
                      {logos[i] ? <img src={logos[i]!} alt="" className="h-full w-full object-contain" /> : <School className="text-brand-700" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[17px] font-extrabold leading-snug text-brand-900">{s.name}</p>
                      <p className="text-[13px] text-muted">
                        {own.length ? own.map((c) => c.name).join(" · ") : "Nenhuma turma ligada ainda"}
                      </p>
                    </div>
                    <ConfirmButton action={deleteSchool.bind(null, s.id)} message={`Apagar a escola "${s.name}"? As turmas continuam, só ficam sem escola.`}>
                      <Trash2 size={16} />
                    </ConfirmButton>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[14px] font-bold text-brand-700">Editar nome e logo</summary>
                    <ActionForm action={updateSchool.bind(null, s.id)} submitLabel="Salvar escola" className="mt-3 space-y-3">
                      <div>
                        <label className="label">Nome da escola</label>
                        <input className="field" name="name" defaultValue={s.name} required />
                      </div>
                      <div>
                        <label className="label">Logo (JPEG ou PNG)</label>
                        <LogoUpload name="logo_path" initialPath={s.logo_path} initialUrl={logos[i]} />
                      </div>
                    </ActionForm>
                  </details>
                </Card>
              );
            })
          )}
          <p className="text-[13px] text-muted">
            Para ligar uma turma a uma escola, abra a turma em <Link href="/turmas" className="font-semibold text-brand-700 underline">Turmas</Link> e escolha a escola.
          </p>
        </div>
        <Card className="h-fit p-5">
          <h2 className="mb-4 text-[16px] font-bold text-brand-900">Nova escola</h2>
          <ActionForm action={createSchool} submitLabel="Cadastrar escola" submitClassName="w-full" resetOnSuccess className="space-y-3">
            <div>
              <label className="label">Nome da escola</label>
              <input className="field" name="name" placeholder="Ex.: Escola Master" required />
            </div>
            <div>
              <label className="label">Logo (JPEG ou PNG)</label>
              <LogoUpload name="logo_path" />
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
