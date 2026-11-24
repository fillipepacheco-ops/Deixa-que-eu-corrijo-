import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Alunos" };

export default async function AlunosPage({ searchParams }: { searchParams: Promise<{ turma?: string; q?: string }> }) {
  const { turma, q } = await searchParams;
  const supabase = await createClient();

  const { data: classes } = await supabase.from("classes").select("id, name").order("name");
  let query = supabase
    .from("students")
    .select("id, name, registration, roll_number, class_id, classes(name)")
    .order("name")
    .limit(500);
  if (turma) query = query.eq("class_id", turma);
  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);
  const { data: students } = await query;

  return (
    <>
      <PageHeader title="Alunos" description="Todos os seus alunos. Para adicionar ou editar, abra a turma." />

      <form className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="field pl-9" name="q" defaultValue={q ?? ""} placeholder="Buscar por nome" aria-label="Buscar por nome" />
        </label>
        <select className="field sm:w-56" name="turma" defaultValue={turma ?? ""} aria-label="Turma">
          <option value="">Todas as turmas</option>
          {classes?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className={buttonClass("secondary")}>Filtrar</button>
      </form>

      {!classes?.length ? (
        <EmptyState
          title="Comece criando uma turma"
          text="Os alunos são cadastrados dentro das turmas."
          action={<Link className={buttonClass()} href="/turmas">Criar turma</Link>}
        />
      ) : !students?.length ? (
        <EmptyState title="Nenhum aluno encontrado" text="Ajuste a busca ou adicione alunos em uma turma." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-brand-50 text-[12px] uppercase tracking-wide text-brand-700">
              <tr>
                <th className="px-5 py-3 font-bold">Aluno</th>
                <th className="hidden px-5 py-3 font-bold sm:table-cell">Matrícula</th>
                <th className="px-5 py-3 font-bold">Turma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-brand-50/50">
                  <td className="px-5 py-3 font-medium">
                    {s.roll_number ? <span className="mr-2 text-muted tabular-nums">{s.roll_number}.</span> : null}
                    {s.name}
                  </td>
                  <td className="hidden px-5 py-3 text-muted sm:table-cell">{s.registration ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Link className="font-semibold text-brand-700 hover:underline" href={`/turmas/${s.class_id}`}>
                      {(s.classes as unknown as { name: string } | null)?.name ?? "—"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
