"use client";

import { useMemo, useState } from "react";
import { BarChart3, Check, Copy } from "lucide-react";
import { formatScore } from "@/lib/grading/grading";
import { BANDS, classResults, distribution, questionRates, type Scope, type SlotClass } from "@/lib/multi/stats";

export type SlotResultClass = SlotClass;

const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

/** Barra horizontal simples (uma cor por significado, rótulo em texto, dica ao passar o dedo). */
function Bar({ label, value, max, text, muted = false, hint }: { label: string; value: number; max: number; text: string; muted?: boolean; hint: string }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2 text-[13px]" title={hint}>
      <span className="w-24 shrink-0 truncate text-right font-semibold text-ink">{label}</span>
      <span className="relative h-5 flex-1 rounded-r-[4px] bg-brand-50/60">
        <span
          className={`absolute inset-y-0 left-0 rounded-r-[4px] ${muted ? "bg-gray-400" : "bg-brand-700"}`}
          style={{ width: `${w}%` }}
        />
      </span>
      <span className="w-12 shrink-0 text-right font-bold tabular-nums text-ink">{text}</span>
    </div>
  );
}

function ChartCard({ title, children, legend }: { title: string; children: React.ReactNode; legend?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="mb-3 text-[14px] font-extrabold text-brand-900">{title}</p>
      {legend}
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

/**
 * Resultados da Prova Multi para o professor: só a disciplina dele ou a prova inteira,
 * com gráficos de desempenho e notas para copiar (na escala do diário dele).
 */
export function MultiResults({ data, discipline }: { data: SlotResultClass[]; discipline: string }) {
  const [scope, setScope] = useState<Scope>("mine");
  const [max, setMax] = useState("10");
  const maxScore = Math.max(0.5, Number(max.replace(",", ".")) || 10);
  const [copied, setCopied] = useState("");

  const results = useMemo(() => classResults(data, scope, maxScore), [data, scope, maxScore]);
  const rates = useMemo(() => questionRates(results), [results]);
  const dist = useMemo(() => distribution(results, maxScore), [results, maxScore]);
  const graded = results.reduce((a, c) => a + c.graded, 0);
  const allScores = results.flatMap((c) => c.rows.map((r) => r.score).filter((x): x is number => x !== null));
  const average = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
  const answered = rates.reduce((a, q) => a + q.answered, 0);
  const hitRate = answered ? rates.reduce((a, q) => a + q.correct, 0) / answered : null;
  const hasOthers = data.some((c) => c.questions.some((q) => q.mine === false));

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(id);
    setTimeout(() => setCopied(""), 2000);
  }

  if (!data.length) return <p className="text-[14px] text-muted">Os resultados aparecem aqui depois que a coordenação gerar a prova e corrigir os cartões.</p>;

  const scopeName = scope === "mine" ? discipline : "prova inteira";

  return (
    <div className="space-y-5">
      {/* visão */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-brand-50 p-1">
          {(
            [
              ["mine", `Só ${discipline}`],
              ["all", "Prova inteira"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setScope(v)}
              disabled={v === "all" && !hasOthers}
              className={`rounded-lg px-3.5 py-2 text-[14px] font-bold disabled:opacity-40 ${scope === v ? "bg-brand-900 text-white shadow" : "text-brand-900"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto flex items-center gap-2 text-[13px] text-muted">
          Nota de 0 a
          <input className="field w-20! py-1.5!" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} aria-label="Nota máxima" />
        </span>
      </div>
      <p className="-mt-2 text-[13px] text-muted">
        {scope === "mine"
          ? `Conta só as questões de ${discipline}. Use para a nota da sua disciplina.`
          : "Conta todas as questões de todas as disciplinas. Use quando a escola lança a prova inteira como uma nota só."}
      </p>

      {/* números de cabeçalho */}
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Média", average === null ? "—" : formatScore(Math.round(average * 100) / 100)],
          ["Acerto", pct(hitRate)],
          ["Corrigidos", String(graded)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-white p-3 text-center ring-1 ring-line">
            <p className="text-[22px] font-extrabold tabular-nums text-brand-900">{v}</p>
            <p className="text-[12px] font-semibold text-muted">{k}</p>
          </div>
        ))}
      </div>

      {graded > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <ChartCard
            title={`Acerto por questão · ${scopeName}`}
            legend={
              scope === "all" ? (
                <div className="mb-2 flex flex-wrap gap-3 text-[12px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-brand-700" /> {discipline} (suas)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-gray-400" /> outras disciplinas
                  </span>
                </div>
              ) : undefined
            }
          >
            {rates.map((q) => (
              <Bar
                key={q.number}
                label={`Q${String(q.number).padStart(2, "0")}${scope === "all" && q.section ? ` ${q.section}` : ""}`}
                value={q.rate ?? 0}
                max={1}
                text={pct(q.rate)}
                muted={scope === "all" && !q.mine}
                hint={`Questão ${q.number}${q.section ? ` (${q.section})` : ""}: ${q.correct} de ${q.answered} acertaram`}
              />
            ))}
            <p className="pt-1 text-[12px] text-muted">As barras mais curtas mostram o conteúdo que precisa ser retomado.</p>
          </ChartCard>

          <div className="space-y-3">
            <ChartCard title="Distribuição das notas">
              {BANDS.map((b, i) => (
                <Bar key={b.label} label={b.label} value={dist[i]} max={Math.max(1, ...dist)} text={String(dist[i])} hint={`${dist[i]} aluno(s) com nota ${b.label.toLowerCase()} da nota máxima`} />
              ))}
            </ChartCard>
            {results.length > 1 && (
              <ChartCard title={`Média por turma (0 a ${formatScore(maxScore)})`}>
                {results.map((c) => (
                  <Bar
                    key={c.id}
                    label={c.name}
                    value={c.average ?? 0}
                    max={maxScore}
                    text={c.average === null ? "—" : formatScore(c.average)}
                    hint={`${c.name}: média ${c.average === null ? "—" : formatScore(c.average)} (${c.graded} corrigidos)`}
                  />
                ))}
              </ChartCard>
            )}
          </div>
        </div>
      )}

      {/* notas por turma */}
      {results.map((c) => {
        const text = c.rows.map((r) => (r.score === null ? "" : formatScore(r.score))).join("\n");
        const id = `${c.id}-${scope}`;
        return (
          <div key={id} className="overflow-hidden rounded-2xl border border-line bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <p className="flex-1 font-extrabold text-brand-900">
                {c.name}{" "}
                <span className="text-[13px] font-semibold text-muted">
                  · {c.graded} de {c.rows.length} corrigidos · {c.total} questões ({scope === "mine" ? discipline : "prova inteira"})
                </span>
              </p>
              <button type="button" onClick={() => copy(id, text)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-900 px-3 py-1.5 text-[13px] font-bold text-white">
                {copied === id ? <Check size={15} /> : <Copy size={15} />}
                {copied === id ? "Copiado!" : scope === "mine" ? `Copiar notas de ${discipline}` : "Copiar nota da prova inteira"}
              </button>
            </div>
            <table className="w-full text-[14px]">
              <tbody>
                {c.rows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0">
                    <td className="w-10 px-3 py-2 text-right text-muted">{r.roll ?? "—"}</td>
                    <td className="px-2 py-2 text-ink">{r.name}</td>
                    <td className="px-2 py-2 text-right text-[12px] text-muted">{r.score === null ? "" : `${r.hits}/${c.total}`}</td>
                    <td className="w-20 px-3 py-2 text-right font-extrabold text-brand-900">{r.score === null ? <span className="font-normal text-muted">—</span> : formatScore(r.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      <p className="flex items-center gap-1.5 text-[12px] text-muted">
        <BarChart3 size={14} /> As notas saem na ordem de chamada, uma por linha: é só colar na coluna do diário.
      </p>
    </div>
  );
}
