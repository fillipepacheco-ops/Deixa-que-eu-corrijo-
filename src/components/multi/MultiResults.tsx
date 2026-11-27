"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { formatScore, gradeSubmission, type AnswerKeyItem } from "@/lib/grading/grading";
import type { AnnulPolicy, QuestionType } from "@/lib/models/types";

export interface SlotResultClass {
  assessment_id: string;
  class_name: string | null;
  annul_policy: AnnulPolicy;
  questions: { position: number; type: QuestionType; correct_answers: string[]; weight: number; annulled: boolean }[];
  students: { id: string; name: string; roll: number | null; answers: Record<string, string | null> | null; manual: Record<string, number> | null; done: boolean }[];
}

/**
 * Notas da disciplina do professor na Prova Multi: só as questões dele contam,
 * na escala que ele usa no diário. A correção é feita uma vez pela coordenação.
 */
export function MultiResults({ data, discipline }: { data: SlotResultClass[]; discipline: string }) {
  const [max, setMax] = useState("10");
  const maxScore = Math.max(0.5, Number(max.replace(",", ".")) || 10);
  const [copied, setCopied] = useState("");

  const classes = useMemo(
    () =>
      data.map((c) => {
        const key: AnswerKeyItem[] = c.questions.map((q) => ({ number: q.position, type: q.type, accepted: q.correct_answers, weight: Number(q.weight), annulled: q.annulled }));
        const rows = c.students.map((s) => {
          if (!s.done || !key.length) return { ...s, score: null as number | null, hits: 0 };
          const answers: Record<number, string | null> = {};
          for (const [k, v] of Object.entries(s.answers ?? {})) answers[Number(k)] = v;
          const manual: Record<number, number> = {};
          for (const [k, v] of Object.entries(s.manual ?? {})) manual[Number(k)] = Number(v);
          const g = gradeSubmission(key, answers, { maxScore, annulPolicy: c.annul_policy, manualPoints: manual });
          return { ...s, score: g.score, hits: g.correctCount };
        });
        return { ...c, key, rows };
      }),
    [data, maxScore],
  );

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

  if (!data.length) return <p className="text-[14px] text-muted">As notas aparecem aqui depois que a coordenação gerar a prova e corrigir os cartões.</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        <span className="text-muted">Nota de {discipline} de 0 a</span>
        <input className="field w-20! py-1.5!" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} aria-label="Nota máxima" />
        <span className="text-[12px] text-muted">(use a escala do seu diário)</span>
      </div>
      {classes.map((c) => {
        const done = c.rows.filter((r) => r.score !== null).length;
        const text = c.rows.map((r) => (r.score === null ? "" : formatScore(r.score))).join("\n");
        return (
          <div key={c.assessment_id} className="overflow-hidden rounded-2xl border border-line bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <p className="flex-1 font-extrabold text-brand-900">
                {c.class_name ?? "Turma"} <span className="text-[13px] font-semibold text-muted">· {done} de {c.rows.length} corrigidos · {c.key.length} questões</span>
              </p>
              <button
                type="button"
                onClick={() => copy(c.assessment_id, text)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-900 px-3 py-1.5 text-[13px] font-bold text-white"
              >
                {copied === c.assessment_id ? <Check size={15} /> : <Copy size={15} />} {copied === c.assessment_id ? "Copiado!" : "Copiar notas (ordem de chamada)"}
              </button>
            </div>
            <table className="w-full text-[14px]">
              <tbody>
                {c.rows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0">
                    <td className="w-10 px-3 py-2 text-right text-muted">{r.roll ?? "—"}</td>
                    <td className="px-2 py-2 text-ink">{r.name}</td>
                    <td className="px-2 py-2 text-right text-[12px] text-muted">{r.score === null ? "" : `${r.hits}/${c.key.length}`}</td>
                    <td className="w-20 px-3 py-2 text-right font-extrabold text-brand-900">{r.score === null ? <span className="font-normal text-muted">—</span> : formatScore(r.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
