"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { columnText, combineScores, formatNumber, formatRaw, passes, sortStudents, tableText, type Combine, type DiaryFormat } from "@/lib/results/diary";
import { formatDateBR } from "@/lib/assessment/header";
import { FileButton } from "@/components/assessments/FileButton";
import { CopyButton } from "./CopyButton";
import { DiaryFormatCard } from "./DiaryFormatCard";

export interface ClassBoardAssessment {
  id: string;
  title: string;
  applied_on: string | null;
  max_score: number;
  term: number | null;
  scores: Record<string, number>;
}

export interface ClassBoardStudent {
  id: string;
  name: string;
  roll_number: number | null;
  registration: string | null;
}

export function ClassBoard({
  classId,
  className,
  school,
  initialFormat,
  formatsReady,
  assessments,
  students,
}: {
  classId: string;
  className: string;
  school: string;
  initialFormat: DiaryFormat;
  formatsReady: boolean;
  assessments: ClassBoardAssessment[];
  students: ClassBoardStudent[];
}) {
  const storeKey = `dqec:turma:${classId}`;
  const [fmt, setFmt] = useState(initialFormat);
  const [selected, setSelected] = useState<string[]>(assessments.map((a) => a.id));
  const [combine, setCombine] = useState<Combine>("soma");
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) ?? "null") as { ids?: string[]; combine?: Combine } | null;
      if (saved?.ids) setSelected(saved.ids.filter((id) => assessments.some((a) => a.id === id)));
      if (saved?.combine) setCombine(saved.combine);
    } catch {
      /* ignora */
    }
  }, [storeKey, assessments]);
  useEffect(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify({ ids: selected, combine }));
    } catch {
      /* ignora */
    }
  }, [storeKey, selected, combine]);

  const chosen = assessments.filter((a) => selected.includes(a.id));
  const terms = [...new Set(assessments.map((a) => a.term).filter((t): t is number => !!t))].sort();
  const ordered = useMemo(() => sortStudents(students, fmt.order), [students, fmt.order]);
  const num = (v: number) => formatRaw(v, fmt.decimal);
  const results = ordered.map((s) => combineScores(chosen.map((a) => ({ score: a.scores[s.id] ?? null, max: a.max_score })), combine, fmt));
  const resultMax = results[0]?.max ?? 0;
  const resultLabel = combine === "soma" ? `Soma (até ${num(resultMax)})` : `Média (0 a ${fmt.scale ?? 10})`;

  const fmtParam = encodeURIComponent(JSON.stringify(fmt));
  const query = `ids=${chosen.map((a) => a.id).join(",")}&juntar=${combine}&formato=${fmtParam}`;

  const resultColumn = () => columnText(results.map((r) => formatNumber(r.value, fmt)));
  const fullTable = () =>
    tableText([
      ["Nº", ...(fmt.showRegistration ? ["Matrícula"] : []), "Aluno", ...chosen.map((a) => a.title), resultLabel],
      ...ordered.map((s, i) => [
        s.roll_number ? String(s.roll_number) : "",
        ...(fmt.showRegistration ? [s.registration ?? ""] : []),
        s.name,
        ...chosen.map((a) => (a.scores[s.id] === undefined ? fmt.absent : num(a.scores[s.id]))),
        formatNumber(results[i].value, fmt),
      ]),
    ]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
        <h2 className="text-[17px] font-extrabold text-brand-900">1. Quais avaliações entram?</h2>
        {terms.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="self-center text-[13px] text-muted">Marcar o bimestre:</span>
            {terms.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelected(assessments.filter((a) => a.term === t).map((a) => a.id))}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-bold text-brand-900 hover:border-brand-200 active:scale-95"
              >
                {t}º bimestre
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {assessments.map((a) => (
            <label key={a.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-3 has-checked:border-brand-500 has-checked:bg-brand-50/60">
              <input
                type="checkbox"
                className="h-5 w-5 accent-brand-700"
                checked={selected.includes(a.id)}
                onChange={(e) => setSelected((s) => (e.target.checked ? [...s, a.id] : s.filter((x) => x !== a.id)))}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-brand-900">{a.title}</span>
                <span className="block text-[12px] text-muted">
                  {[formatDateBR(a.applied_on), `vale ${num(a.max_score)}`, `${Object.keys(a.scores).length} com nota`].filter(Boolean).join(" · ")}
                </span>
              </span>
            </label>
          ))}
        </div>
        <h2 className="mt-5 text-[17px] font-extrabold text-brand-900">2. Como juntar?</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ["soma", "Somar os pontos", "Ex.: 3 + 2 + 5 = 10"],
              ["media", "Fazer a média", `Resultado de 0 a ${fmt.scale ?? 10}`],
            ] as const
          ).map(([k, t, d]) => (
            <button
              key={k}
              type="button"
              onClick={() => setCombine(k)}
              className={`rounded-xl border px-3 py-3 text-left ${combine === k ? "border-brand-500 bg-brand-50/60" : "border-line"}`}
            >
              <span className="block font-bold text-brand-900">{t}</span>
              <span className="block text-[12px] text-muted">{d}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-muted">Quem não fez uma avaliação conta 0 nela.</p>
      </section>

      <DiaryFormatCard school={school} value={fmt} onChange={setFmt} ready={formatsReady} />

      <section className="rounded-2xl border border-line bg-white">
        <div className="space-y-3 p-4 sm:p-5">
          <h2 className="text-[19px] font-extrabold text-brand-900">3. Lançar no diário — Turma {className}</h2>
          {chosen.length === 0 ? (
            <p className="text-[14px] text-muted">Marque pelo menos uma avaliação acima.</p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <CopyButton primary text={resultColumn} label="Copiar só o resultado" hint="Uma nota por linha, na ordem da lista" />
              <CopyButton text={fullTable} label="Copiar a tabela inteira" hint="Cole numa planilha: cada coisa na sua coluna" />
              <FileButton
                href={`/api/resultados/turma/${classId}/arquivo?tipo=pdf&${query}`}
                filename={`notas-turma-${className}.pdf`.replace(/\s+/g, "-")}
                mime="application/pdf"
                title="Notas da turma (PDF)"
                subtitle="Para imprimir ou arquivar"
                icon={<FileText size={22} />}
              />
              <FileButton
                href={`/api/resultados/turma/${classId}/arquivo?tipo=planilha&${query}`}
                filename={`notas-turma-${className}.csv`.replace(/\s+/g, "-")}
                mime="text/csv"
                title="Planilha (Excel)"
                subtitle="Abre no Excel, Google Planilhas e Numbers"
                icon={<FileSpreadsheet size={22} />}
              />
            </div>
          )}
        </div>
        {chosen.length > 0 && (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-max text-[14px]">
              <thead>
                <tr className="bg-brand-50 text-left text-[12px] font-bold uppercase tracking-wide text-brand-800">
                  <th className="px-3 py-2.5 text-right">Nº</th>
                  <th className="sticky left-0 bg-brand-50 px-3 py-2.5">Aluno</th>
                  {chosen.map((a) => (
                    <th key={a.id} className="max-w-32 truncate px-3 py-2.5 text-center normal-case" title={a.title}>
                      {a.title}
                      <span className="block text-[11px] font-semibold text-muted">vale {num(a.max_score)}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center">{resultLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ordered.map((s, i) => {
                  const r = results[i];
                  const low = !passes(r.value, r.max, fmt);
                  return (
                    <tr key={s.id}>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-muted">{s.roll_number ?? "–"}</td>
                      <td className="sticky left-0 bg-white px-3 py-2.5 font-semibold text-brand-900">
                        {s.name}
                        {fmt.showRegistration && s.registration && <span className="block text-[11px] font-normal text-muted">Matr. {s.registration}</span>}
                      </td>
                      {chosen.map((a) => (
                        <td key={a.id} className="px-3 py-2.5 text-center tabular-nums">
                          {a.scores[s.id] === undefined ? <span className="text-gray-400">{fmt.absent || "—"}</span> : num(a.scores[s.id])}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <span className={`block rounded-lg px-2 py-1 text-center text-[17px] font-extrabold tabular-nums ${low ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-900"}`}>
                          {formatNumber(r.value, fmt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
