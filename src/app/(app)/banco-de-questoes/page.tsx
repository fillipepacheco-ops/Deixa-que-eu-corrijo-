import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/PageHeader";
import { MathPreview } from "@/components/math/MathPreview";
import { BankFilters, type BankFilterValues } from "@/components/banco/BankFilters";
import { BankAddForm } from "@/components/banco/BankAddForm";
import { ENEM_AREAS, ENEM_DAY_COUNTS, ENEM_QUESTIONS, ENEM_YEARS, TAXONOMY, filterBank, numberLabel, sourceLabel, tagCounts } from "@/lib/banco/enem";

export const metadata: Metadata = { title: "Banco de Questões" };

const PER_PAGE = 12;

type SP = Partial<Record<keyof BankFilterValues | "pg", string>>;

export default async function BancoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const values: BankFilterValues = {
    ano: sp.ano ?? "",
    area: sp.area ?? "",
    d: sp.d ?? "",
    t: sp.t ?? "",
    s: sp.s ?? "",
    q: sp.q ?? "",
    anuladas: sp.anuladas ?? "",
    avaliacao: sp.avaliacao ?? "",
  };

  // recorte por ano/área: base dos números que aparecem nos filtros
  const base = filterBank(ENEM_QUESTIONS, { ano: Number(values.ano) || null, area: values.area || null, semAnuladas: values.anuladas === "nao" });
  const counts = tagCounts(base);
  const found = filterBank(base, { d: values.d || null, t: values.t || null, s: values.s || null, q: values.q || null });
  const pages = Math.max(1, Math.ceil(found.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(sp.pg) || 1));
  const shown = found.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const supabase = await createClient();
  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, title, classes(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const options = (assessments ?? []).map((a) => {
    const cls = (a.classes as { name?: string } | null)?.name;
    return { id: a.id as string, label: cls ? `${a.title} · ${cls}` : (a.title as string) };
  });

  const link = (pg: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(values)) if (v) p.set(k, v);
    if (pg > 1) p.set("pg", String(pg));
    return `/banco-de-questoes${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Banco de Questões"
        description="Questões das provas oficiais com texto, figuras e gabarito, prontas para entrar nas suas avaliações. Marque as que quiser e mande para a avaliação: o enunciado já sai com a origem e o ano."
      />

      <div className="mb-5 flex flex-wrap gap-2 text-[13px] font-bold">
        <span className="rounded-full bg-brand-900 px-3.5 py-1.5 text-white">ENEM · Linguagens e Humanas ({ENEM_DAY_COUNTS.d1})</span>
        <span className="rounded-full bg-brand-900 px-3.5 py-1.5 text-white">ENEM · Natureza e Matemática ({ENEM_DAY_COUNTS.d2})</span>
        <span className="rounded-full border border-line px-3.5 py-1.5 text-muted" title="Em preparação">
          PAS (por etapa) — em breve
        </span>
        <span className="rounded-full border border-line px-3.5 py-1.5 text-muted" title="Em preparação">
          Questões dos professores — em breve
        </span>
      </div>

      <div className="mb-5 rounded-2xl border border-line bg-white p-4">
        <BankFilters values={values} years={ENEM_YEARS} areas={ENEM_AREAS} taxonomy={TAXONOMY} counts={counts} />
      </div>

      <p className="mb-3 text-[13px] font-semibold text-muted">
        {found.length} {found.length === 1 ? "questão encontrada" : "questões encontradas"}
        {pages > 1 && ` · página ${page} de ${pages}`}
      </p>

      {found.length === 0 ? (
        <EmptyState title="Nenhuma questão com esses filtros" text="Tente outro conteúdo, outro ano ou uma palavra diferente na busca." />
      ) : (
        <BankAddForm assessments={options} defaultAssessment={values.avaliacao || undefined}>
          <div className="space-y-4">
            {shown.map((q) => (
              <article key={q.id} className="rounded-2xl border border-line bg-white has-checked:border-brand-500 has-checked:ring-2 has-checked:ring-brand-100">
                <label className="flex cursor-pointer items-start gap-3 border-b border-line px-4 py-3">
                  <input type="checkbox" name="ids" value={q.id} className="mt-0.5 h-5 w-5 shrink-0 accent-[#137a1a]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-extrabold text-brand-900">
                      {sourceLabel(q)} · {numberLabel(q)}
                      {q.nul && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold uppercase text-red-700">Anulada</span>}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {q.tags.map(([d, t, s]) => (
                        <span key={`${d}${t}${s}`} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                          {d} › {t} › {s}
                        </span>
                      ))}
                    </span>
                  </span>
                </label>
                <div className="px-4 py-3 text-[14px] leading-relaxed text-ink">
                  <MathPreview text={q.st} className="space-y-1.5" />
                  <div className="mt-3 space-y-1.5">
                    {q.op.map((o, i) =>
                      o.trim() ? (
                        <div key={i} className="flex gap-2">
                          <b className="w-6 shrink-0 text-brand-700">{"ABCDE"[i]}</b>
                          <MathPreview text={o} className="min-w-0 flex-1" />
                        </div>
                      ) : null,
                    )}
                  </div>
                  <details className="mt-3 text-[13px]">
                    <summary className="cursor-pointer font-semibold text-brand-700">Ver gabarito</summary>
                    <p className="mt-1 font-bold text-brand-900">{q.nul ? "Questão anulada pelo INEP (no app, a questão entra marcada como anulada)." : `Resposta: ${q.ans}`}</p>
                  </details>
                </div>
              </article>
            ))}
          </div>

          {pages > 1 && (
            <nav className="mt-5 flex items-center justify-center gap-2 text-[14px] font-semibold">
              {page > 1 && (
                <Link href={link(page - 1)} className="inline-flex items-center gap-1 rounded-xl border border-line bg-white px-3 py-2 text-brand-900">
                  <ChevronLeft size={16} /> Anterior
                </Link>
              )}
              <span className="px-2 text-muted">
                {page} / {pages}
              </span>
              {page < pages && (
                <Link href={link(page + 1)} className="inline-flex items-center gap-1 rounded-xl border border-line bg-white px-3 py-2 text-brand-900">
                  Próxima <ChevronRight size={16} />
                </Link>
              )}
            </nav>
          )}
        </BankAddForm>
      )}
    </>
  );
}
