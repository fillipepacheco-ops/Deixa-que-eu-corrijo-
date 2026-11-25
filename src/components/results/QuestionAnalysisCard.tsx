import type { QuestionAnalysis } from "@/lib/grading/stats";

function tone(rate: number) {
  if (rate >= 70) return { bar: "bg-brand-500", text: "text-brand-700" };
  if (rate >= 40) return { bar: "bg-amber-400", text: "text-amber-700" };
  return { bar: "bg-red-500", text: "text-red-700" };
}

/** Acerto por questão: mostra onde a turma foi mal (ajuda a decidir o que retomar). */
export function QuestionAnalysisCard({ analysis }: { analysis: QuestionAnalysis[] }) {
  const valid = analysis.filter((q) => !q.annulled && q.hitRate !== null);
  if (valid.length === 0) return null;
  const hardest = [...valid].sort((a, b) => a.hitRate! - b.hitRate!).slice(0, 3).filter((q) => q.hitRate! < 50);

  return (
    <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <h2 className="text-[17px] font-extrabold text-brand-900">Acerto por questão</h2>
      <p className="text-[13px] text-muted">Considera os cartões corrigidos pela câmera. Toque na questão para ver o que a turma marcou.</p>
      {hardest.length > 0 && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-800">
          Vale retomar: {hardest.map((q) => `questão ${q.number} (${Math.round(q.hitRate!)}%)`).join(", ")}.
        </p>
      )}
      <div className="mt-3 divide-y divide-line">
        {analysis.map((q) => {
          const rate = q.hitRate ?? 0;
          const t = tone(rate);
          return (
            <details key={q.number} className="group py-2">
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <span className="w-10 shrink-0 text-[13px] font-extrabold text-brand-900">Q{String(q.number).padStart(2, "0")}</span>
                {q.annulled ? (
                  <span className="text-[13px] text-muted">Anulada</span>
                ) : (
                  <>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-brand-50">
                      <span className={`block h-full rounded-full ${t.bar}`} style={{ width: `${rate}%` }} />
                    </span>
                    <span className={`w-12 shrink-0 text-right text-[13px] font-bold tabular-nums ${t.text}`}>{Math.round(rate)}%</span>
                  </>
                )}
              </summary>
              <div className="mt-2 flex flex-wrap gap-1.5 pl-13">
                {q.distribution.map((d) => (
                  <span
                    key={d.option}
                    className={`rounded-lg border px-2 py-1 text-[12px] font-semibold ${d.correct ? "border-brand-200 bg-brand-50 text-brand-800" : "border-line text-muted"}`}
                  >
                    {d.option}: {d.count} ({Math.round(d.percent)}%){d.correct ? " ✓" : ""}
                  </span>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
