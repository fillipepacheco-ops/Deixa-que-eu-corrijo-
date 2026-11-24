import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createClass } from "@/services/classes";
import { Card, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { ActionForm } from "@/components/ui/ActionForm";
import { ClassFields } from "@/components/classes/ClassFields";

export const metadata: Metadata = { title: "Turmas" };

export default async function TurmasPage() {
  const supabase = await createClient();
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, grade_level, year, shift, subject, students(count)")
    .order("year", { ascending: false })
    .order("name");

  return (
    <>
      <PageHeader title="Turmas" description="Cadastre suas turmas uma vez. Elas alimentam provas, cartões-resposta, resultados e o Conselho de Classe." />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          {!classes?.length ? (
            <EmptyState title="Nenhuma turma ainda" text="Crie sua primeira turma ao lado e depois adicione os alunos." />
          ) : (
            <Card className="divide-y divide-line">
              {classes.map((c) => {
                const count = (c.students as unknown as { count: number }[])?.[0]?.count ?? 0;
                return (
                  <Link key={c.id} href={`/turmas/${c.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-brand-50/60">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-[15px] font-extrabold text-brand-900">
                      {c.name.slice(0, 3)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-brand-900">{c.name}</span>
                      <span className="block truncate text-[13px] text-muted">
                        {[c.subject, c.grade_level, c.shift, c.year].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="text-[13px] font-semibold text-muted">{count} {count === 1 ? "aluno" : "alunos"}</span>
                    <ChevronRight size={18} className="text-muted" />
                  </Link>
                );
              })}
            </Card>
          )}
        </div>

        <Card className="h-fit p-5">
          <h2 className="mb-4 text-[16px] font-bold text-brand-900">Nova turma</h2>
          <ActionForm action={createClass} submitLabel="Criar turma" submitClassName="w-full">
            <ClassFields compact />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
