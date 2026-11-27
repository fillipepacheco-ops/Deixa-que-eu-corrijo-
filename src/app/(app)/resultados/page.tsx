import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, ChevronRight, School, Sigma } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { classIdsOfCurrent } from "@/services/school-context";
import { Card, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/button";
import { formatDateBR } from "@/lib/assessment/header";
import { schoolKey } from "@/lib/results/diary";
import { groupByTerm } from "@/lib/assessment/term";
import { TermFilter, visibleGroups } from "@/components/terms/TermFilter";

export const metadata: Metadata = { title: "Resultados" };

interface Item {
  id: string;
  title: string;
  applied_on: string | null;
  max_score: number;
  school_name: string | null;
  class_id: string | null;
  classes: { name: string; students: { count: number }[] } | null;
  submissions: { score: number | null }[];
  created_at: string;
  term?: number | null;
}

export default async function ResultadosPage({ searchParams }: { searchParams: Promise<{ bim?: string }> }) {
  const { bim } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessments")
    .select("*, classes(name, students(count)), submissions(score)")
    .order("applied_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  const only = await classIdsOfCurrent(supabase);
  const all = ((data ?? []) as unknown as Item[]).filter((a) => !only || (a.class_id && only.includes(a.class_id)));
  // filtro por bimestre
  const termGroups = groupByTerm(all);
  const { current, shown } = visibleGroups(termGroups, bim);
  const items = shown.flatMap((g) => g.items);

  // agrupa por escola (cada escola tem o seu formato de diário)
  const groups = new Map<string, Item[]>();
  for (const a of items) {
    const k = schoolKey(a.school_name);
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  const schools = [...groups.entries()].sort((a, b) => (a[0] ? (b[0] ? a[0].localeCompare(b[0], "pt-BR") : -1) : 1));

  // turmas que têm avaliação, para juntar notas
  const classes = new Map<string, string>();
  for (const a of items) if (a.class_id && a.classes) classes.set(a.class_id, a.classes.name);

  return (
    <>
      <PageHeader
        title="Resultados"
        description="As notas de cada prova, organizadas e no formato do diário de cada escola — prontas para copiar, imprimir ou lançar."
      />
      {all.length === 0 ? (
        <EmptyState
          title="Ainda não há resultados"
          text="Crie uma avaliação e corrija os cartões pela câmera. As notas aparecem aqui."
          action={
            <Link href="/avaliacoes/nova" className={buttonClass()}>
              Nova avaliação
            </Link>
          }
        />
      ) : (
        <div className="space-y-7">
          <TermFilter groups={termGroups} current={current} basePath="/resultados" />
          {schools.map(([school, list]) => (
            <section key={school || "-"}>
              <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-extrabold text-brand-900">
                <School size={18} className="text-brand-700" /> {school || "Escola não informada"}
              </h2>
              <Card className="divide-y divide-line">
                {groupByTerm(list).flatMap((tg) => [
                  <p key={`h-${tg.key}`} className="bg-brand-50/60 px-5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-brand-700">
                    {tg.label}
                  </p>,
                  ...tg.items.map((a) => {
                  const total = a.classes?.students?.[0]?.count ?? 0;
                  const scores = (a.submissions ?? []).map((s) => s.score).filter((s): s is number => s !== null).map(Number);
                  const done = scores.length;
                  const mean = done ? scores.reduce((x, y) => x + y, 0) / done : null;
                  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
                  return (
                    <Link key={a.id} href={`/resultados/${a.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-brand-50/60 active:bg-brand-50">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-700 to-brand-900 text-white">
                        <BarChart3 size={21} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-brand-900">{a.title}</span>
                        <span className="block truncate text-[13px] text-muted">{[a.classes?.name, formatDateBR(a.applied_on)].filter(Boolean).join(" · ")}</span>
                        {total > 0 && (
                          <span className="mt-1.5 flex items-center gap-2">
                            <span className="h-1.5 w-28 overflow-hidden rounded-full bg-brand-50">
                              <span className="block h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                            </span>
                            <span className="text-[12px] font-semibold text-muted">
                              {done}/{total} com nota
                            </span>
                          </span>
                        )}
                      </span>
                      {mean !== null && (
                        <span className="shrink-0 text-right">
                          <span className="block text-[11px] font-bold uppercase text-muted">Média</span>
                          <span className="block text-[18px] font-extrabold tabular-nums text-brand-900">
                            {(Math.round(mean * 10) / 10).toFixed(1).replace(".", ",")}
                            <span className="text-[12px] font-semibold text-muted">/{String(Number(a.max_score)).replace(".", ",")}</span>
                          </span>
                        </span>
                      )}
                      <ChevronRight size={18} className="shrink-0 text-muted" />
                    </Link>
                  );
                  }),
                ])}
              </Card>
            </section>
          ))}

          {classes.size > 0 && (
            <section>
              <h2 className="mb-1 flex items-center gap-2 text-[15px] font-extrabold text-brand-900">
                <Sigma size={18} className="text-brand-700" /> Notas da turma (juntar provas)
              </h2>
              <p className="mb-2.5 text-[13px] text-muted">Some ou tire a média de várias avaliações — para fechar o bimestre.</p>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {[...classes.entries()]
                  .sort((a, b) => a[1].localeCompare(b[1], "pt-BR", { numeric: true }))
                  .map(([id, name]) => (
                    <Link key={id} href={`/resultados/turma/${id}`} className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3.5 font-bold text-brand-900 hover:border-brand-200 hover:shadow-md active:scale-[0.98]">
                      Turma {name} <ChevronRight size={18} className="text-muted" />
                    </Link>
                  ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
