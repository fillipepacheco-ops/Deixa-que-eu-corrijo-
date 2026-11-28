import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, School } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createClass, deleteClass } from "@/services/classes";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { currentSchool } from "@/services/school-context";
import { Card, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { ActionForm } from "@/components/ui/ActionForm";
import { ClassFields } from "@/components/classes/ClassFields";

export const metadata: Metadata = { title: "Turmas" };

interface Row {
  id: string;
  name: string;
  grade_level: string | null;
  year: number;
  shift: string | null;
  subject: string | null;
  school_id: string | null;
  students: { count: number }[];
}

export default async function TurmasPage() {
  const supabase = await createClient();
  const [{ data }, { schools, current }] = await Promise.all([
    supabase.from("classes").select("id, name, grade_level, year, shift, subject, school_id, students(count)").order("year", { ascending: false }).order("name"),
    currentSchool(supabase),
  ]);
  const classes = ((data ?? []) as unknown as Row[]).filter((c) => !current || c.school_id === current.id);

  // separadas por escola (a escola em uso primeiro)
  const groups = [
    ...schools.filter((s) => !current || s.id === current.id).map((s) => ({ id: s.id, name: s.name, items: classes.filter((c) => c.school_id === s.id) })),
    { id: "", name: "Sem escola", items: classes.filter((c) => !c.school_id || !schools.some((s) => s.id === c.school_id)) },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader
        title={current ? `Turmas · ${current.name}` : "Turmas"}
        description="Cadastre suas turmas uma vez, cada uma na sua escola. Elas alimentam provas, cartões-resposta, resultados e o modo game."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {!groups.length ? (
            <EmptyState title="Nenhuma turma ainda" text="Crie sua primeira turma ao lado e depois adicione os alunos." />
          ) : (
            groups.map((g) => (
              <section key={g.id || "sem"}>
                <h2 className="mb-2 flex items-center gap-2 text-[15px] font-extrabold text-brand-900">
                  <School size={18} className="text-brand-700" /> {g.name}
                </h2>
                <Card className="divide-y divide-line">
                  {g.items.map((c) => {
                    const count = c.students?.[0]?.count ?? 0;
                    return (
                      <SwipeRow
                        key={c.id}
                        actions={[
                          { label: "Abrir", icon: "edit", tone: "brand", href: `/turmas/${c.id}` },
                          { label: "Excluir", icon: "delete", tone: "danger", run: deleteClass.bind(null, c.id), confirm: `Excluir a turma ${c.name}? Os alunos dela também serão removidos.` },
                        ]}
                      >
                      <Link href={`/turmas/${c.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-brand-50/60">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-[15px] font-extrabold text-brand-900">{c.name.slice(0, 3)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold text-brand-900">{c.name}</span>
                          <span className="block truncate text-[13px] text-muted">{[c.subject, c.grade_level, c.shift, c.year].filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className="text-[13px] font-semibold text-muted">
                          {count} {count === 1 ? "aluno" : "alunos"}
                        </span>
                        <ChevronRight size={18} className="text-muted" />
                      </Link>
                      </SwipeRow>
                    );
                  })}
                </Card>
              </section>
            ))
          )}
        </div>

        <Card className="h-fit p-5">
          <h2 className="mb-4 text-[16px] font-bold text-brand-900">Nova turma</h2>
          <ActionForm action={createClass} submitLabel="Criar turma" submitClassName="w-full">
            <ClassFields compact schools={schools} defaultSchool={current?.id} />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
