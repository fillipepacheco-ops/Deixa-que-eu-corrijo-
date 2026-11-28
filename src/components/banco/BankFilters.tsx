"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";
import type { TaxDiscipline } from "@/lib/banco/enem";

export interface BankFilterValues {
  ano: string;
  area: string;
  d: string;
  t: string;
  s: string;
  q: string;
  anuladas: string;
  avaliacao: string;
}

/** Filtros do banco: ano, área, disciplina › tópico › subtópico, busca no texto. */
export function BankFilters({
  values,
  years,
  areas,
  taxonomy,
  counts,
}: {
  values: BankFilterValues;
  years: number[];
  areas: string[];
  taxonomy: TaxDiscipline[];
  /** quantidade por "disc", "disc|tópico" e "disc|tópico|sub" no recorte de ano/área */
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const [q, setQ] = useState(values.q);

  const go = (patch: Partial<BankFilterValues>) => {
    const next = { ...values, ...patch };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) sp.set(k, v);
    router.push(`/banco-de-questoes${sp.size ? `?${sp}` : ""}`);
  };

  // os números já vêm do recorte por ano/área: só aparecem disciplinas com questões nele
  const discs = taxonomy.filter((d) => (counts[d.d] ?? 0) > 0);
  const disc = taxonomy.find((d) => d.d === values.d);
  const topics = (disc?.topics ?? []).filter((t) => (counts[`${disc!.d}|${t.t}`] ?? 0) > 0);
  const topic = disc?.topics.find((t) => t.t === values.t);
  const subs = (topic?.subs ?? []).filter((s) => (counts[`${disc!.d}|${topic!.t}|${s}`] ?? 0) > 0);
  const n = (k: string) => (counts[k] ? ` (${counts[k]})` : "");

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: q.trim() });
        }}
      >
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="field pl-9!"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Palavra ou nº e ano (ex.: 2025 101, 2024 3 inglês, barroco)"
            enterKeyHint="search"
          />
        </div>
        <button className="rounded-xl bg-brand-900 px-4 text-[14px] font-bold text-white">Buscar</button>
      </form>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <select className="field" value={values.ano} onChange={(e) => go({ ano: e.target.value })} aria-label="Ano">
          <option value="">Todos os anos</option>
          {years.map((y) => (
            <option key={y} value={y}>
              ENEM {y}
            </option>
          ))}
        </select>
        <select className="field" value={values.area} onChange={(e) => go({ area: e.target.value, d: "", t: "", s: "" })} aria-label="Área">
          <option value="">Todas as áreas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select className="field" value={values.d} onChange={(e) => go({ d: e.target.value, t: "", s: "" })} aria-label="Disciplina">
          <option value="">Todas as disciplinas</option>
          {discs.map((d) => (
            <option key={d.d} value={d.d}>
              {d.d}
              {n(d.d)}
            </option>
          ))}
        </select>
        <select className="field" value={values.t} disabled={!disc} onChange={(e) => go({ t: e.target.value, s: "" })} aria-label="Conteúdo">
          <option value="">{disc ? "Todos os conteúdos" : "Conteúdo (escolha a disciplina)"}</option>
          {topics.map((t) => (
            <option key={t.t} value={t.t}>
              {t.t}
              {n(`${disc!.d}|${t.t}`)}
            </option>
          ))}
        </select>
        <select className="field" value={values.s} disabled={!topic} onChange={(e) => go({ s: e.target.value })} aria-label="Assunto">
          <option value="">{topic ? "Todos os assuntos" : "Assunto (escolha o conteúdo)"}</option>
          {subs.map((s) => (
            <option key={s} value={s}>
              {s}
              {n(`${disc!.d}|${topic!.t}|${s}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <label className="flex cursor-pointer items-center gap-2 font-semibold text-brand-900">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#137a1a]"
            checked={values.anuladas === "nao"}
            onChange={(e) => go({ anuladas: e.target.checked ? "nao" : "" })}
          />
          Esconder questões anuladas
        </label>
        {(values.ano || values.area || values.d || values.q || values.anuladas) && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              go({ ano: "", area: "", d: "", t: "", s: "", q: "", anuladas: "" });
            }}
            className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline"
          >
            <X size={14} /> Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
