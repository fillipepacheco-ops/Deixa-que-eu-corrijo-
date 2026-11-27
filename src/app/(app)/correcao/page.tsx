import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ScanLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { classIdsOfCurrent } from "@/services/school-context";
import { Card, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/button";
import { formatDateBR } from "@/lib/assessment/header";
import { groupByTerm } from "@/lib/assessment/term";
import { TermFilter, TermHeading, visibleGroups } from "@/components/terms/TermFilter";

export const metadata: Metadata = { title: "Correção" };

export default async function CorrecaoPage({ searchParams }: { searchParams: Promise<{ bim?: string }> }) {
  const { bim } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessments")
    .select("*, classes(name, students(count)), submissions(count)")
    .order("applied_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  const only = await classIdsOfCurrent(supabase);
  const items = ((data ?? []) as ({ id: string; title: string; applied_on: string | null; created_at: string; term?: number | null } & Record<string, unknown>)[]).filter(
    (a) => !only || only.includes(a.class_id as string),
  );
  const groups = groupByTerm(items);
  const { current, shown } = visibleGroups(groups, bim);

  return (
    <>
      <PageHeader title="Corrigir pela câmera" description="Escolha a avaliação, aponte a câmera para o cartão-resposta e o app corrige, dá a nota e guarda a foto como comprovante." />
      {items.length === 0 ? (
        <EmptyState
          title="Nenhuma avaliação para corrigir"
          text="Crie uma avaliação e imprima os cartões-resposta primeiro."
          action={
            <Link href="/avaliacoes/nova" className={buttonClass()}>
              Nova avaliação
            </Link>
          }
        />
      ) : (
        <>
        <TermFilter groups={groups} current={current} basePath="/correcao" />
        {shown.map((g) => (
        <section key={g.key}>
        <TermHeading label={g.label} count={g.items.length} />
        <Card className="divide-y divide-line">
          {g.items.map((a) => {
            const turma = a.classes as unknown as { name: string; students: { count: number }[] } | null;
            const total = turma?.students?.[0]?.count ?? 0;
            const done = (a.submissions as unknown as { count: number }[])?.[0]?.count ?? 0;
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <Link key={a.id} href={`/correcao/${a.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-brand-50/60 active:bg-brand-50">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-700 to-brand-900 text-white">
                  <ScanLine size={21} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-brand-900">{a.title}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {[turma?.name, formatDateBR(a.applied_on)].filter(Boolean).join(" · ")}
                  </span>
                  {total > 0 && (
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="h-1.5 w-32 overflow-hidden rounded-full bg-brand-50">
                        <span className="block h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="text-[12px] font-semibold text-muted">
                        {done}/{total} corrigidas
                      </span>
                    </span>
                  )}
                </span>
                <ChevronRight size={18} className="text-muted" />
              </Link>
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
