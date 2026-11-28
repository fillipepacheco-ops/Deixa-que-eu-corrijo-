import type { Metadata } from "next";
import Link from "next/link";
import { Eye, FilePlus2, FileUp, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { classIdsOfCurrent } from "@/services/school-context";
import { deleteAssessment } from "@/services/assessments";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { Card, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/button";
import { groupByTerm } from "@/lib/assessment/term";
import { TermFilter, TermHeading, visibleGroups } from "@/components/terms/TermFilter";
import { formatDateBR } from "@/lib/assessment/header";

export const metadata: Metadata = { title: "Avaliações" };

export default async function AvaliacoesPage({ searchParams }: { searchParams: Promise<{ bim?: string }> }) {
  const { bim } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessments")
    .select("*, classes(name), assessment_questions(count)")
    .order("applied_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  const only = await classIdsOfCurrent(supabase);
  const items = ((data ?? []) as ({ id: string; title: string; subject: string | null; applied_on: string | null; created_at: string; term?: number | null } & Record<string, unknown>)[]).filter(
    (a) => !only || only.includes(a.class_id as string),
  );
  const groups = groupByTerm(items);
  const { current, shown } = visibleGroups(groups, bim);

  return (
    <>
      <PageHeader
        title="Avaliações"
        description="Crie a prova uma vez: o sistema gera o PDF, o arquivo editável do Word e os cartões-resposta com o mesmo cabeçalho."
        actions={
          <>
            <Link href="/avaliacoes/nova" className={buttonClass()}>
              <FilePlus2 size={18} /> Nova avaliação
            </Link>
            <Link href="/avaliacoes/importar" className={buttonClass("secondary")}>
              <FileUp size={18} /> Importar prova (PDF ou Word)
            </Link>
          </>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          title="Nenhuma avaliação ainda"
          text="Comece pelo cabeçalho (escola, turma, data); depois é só digitar as questões."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/avaliacoes/nova" className={buttonClass()}>
                Criar primeira avaliação
              </Link>
              <Link href="/avaliacoes/importar" className={buttonClass("secondary")}>
                Importar de PDF ou Word
              </Link>
            </div>
          }
        />
      ) : (
        <>
        <TermFilter groups={groups} current={current} basePath="/avaliacoes" />
        {shown.map((g) => (
        <section key={g.key}>
        <TermHeading label={g.label} count={g.items.length} />
        <Card className="divide-y divide-line">
          {g.items.map((a) => {
            const n = (a.assessment_questions as unknown as { count: number }[])?.[0]?.count ?? 0;
            const turma = (a.classes as unknown as { name: string } | null)?.name;
            return (
              <SwipeRow
                key={a.id}
                actions={[
                  { label: "Ver", icon: "view", tone: "neutral", href: `/avaliacoes/${a.id}/ver` },
                  { label: "Editar", icon: "edit", tone: "brand", href: `/avaliacoes/${a.id}` },
                  { label: "Apagar", icon: "delete", tone: "danger", run: deleteAssessment.bind(null, a.id), confirm: `Apagar a avaliação "${a.title}"? As notas dela também serão apagadas.` },
                ]}
              >
              <div className="flex items-center gap-2 pr-3 sm:pr-4">
                <Link href={`/avaliacoes/${a.id}`} className="flex min-w-0 flex-1 items-center gap-4 px-5 py-4 transition hover:bg-brand-50/60 active:bg-brand-50">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    <FilePlus2 size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-brand-900">{a.title}</span>
                    <span className="block truncate text-[13px] text-muted">
                      {[a.subject, turma, formatDateBR(a.applied_on), `${n} ${n === 1 ? "questão" : "questões"}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
                <Link href={`/avaliacoes/${a.id}/ver`} className={`${buttonClass("secondary")} shrink-0 px-3!`} aria-label="Ver prova">
                  <Eye size={17} /> <span className="hidden sm:inline">Ver prova</span>
                </Link>
                <Link href={`/avaliacoes/${a.id}`} className={`${buttonClass("ghost")} shrink-0 px-3!`} aria-label="Editar prova">
                  <Pencil size={17} /> <span className="hidden sm:inline">Editar</span>
                </Link>
              </div>
              </SwipeRow>
            );
          })}
        </Card>
        </section>
        ))}
        </>
      )}
    </>
  );
}
