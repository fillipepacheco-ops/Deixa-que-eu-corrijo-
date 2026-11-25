"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { ChevronDown, Share2 } from "lucide-react";
import { formatScore } from "@/lib/grading/grading";

export interface ProofRow {
  studentId: string;
  name: string;
  roll: number | null;
  score: number | null;
  correct: number | null;
  when: string | null;
  url: string | null;
}

async function shareProof(url: string, name: string) {
  try {
    const blob = await (await fetch(url)).blob();
    const file = new File([blob], `comprovante-${name.toLowerCase().replace(/\s+/g, "-")}.jpg`, { type: "image/jpeg" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `Comprovante de correção — ${name}` });
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
  } catch {
    /* cancelado */
  }
}

/** Alunos da turma com a nota e o comprovante (foto corrigida). */
export function ProofList({ rows, total }: { rows: ProofRow[]; total: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const done = rows.filter((r) => r.score !== null).length;
  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="font-bold text-brand-900">Corrigidas</h2>
        <span className="text-[13px] font-semibold text-muted">
          {done} de {total}
        </span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.studentId}>
            <button
              type="button"
              disabled={!r.url}
              onClick={() => setOpen(open === r.studentId ? null : r.studentId)}
              className="flex w-full items-center gap-3 px-5 py-3 text-left disabled:cursor-default"
            >
              <span className="w-7 text-right text-[12px] font-bold tabular-nums text-muted">{r.roll ?? ""}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.name}</span>
                {r.when && <span className="block text-[11px] text-muted">corrigida em {r.when}</span>}
              </span>
              {r.score !== null ? (
                <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-[15px] font-extrabold tabular-nums text-brand-900">{formatScore(r.score)}</span>
              ) : (
                <span className="text-[12px] font-semibold text-muted">pendente</span>
              )}
              {r.url && <ChevronDown size={16} className={`text-muted transition ${open === r.studentId ? "rotate-180" : ""}`} />}
            </button>
            {open === r.studentId && r.url && (
              <div className="px-5 pb-4">
                <img src={r.url} alt={`Comprovante de ${r.name}`} className="w-full rounded-xl border border-line" />
                <button
                  type="button"
                  onClick={() => shareProof(r.url!, r.name)}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand-900 px-4 py-2.5 text-[14px] font-bold text-white"
                >
                  <Share2 size={17} /> Enviar comprovante
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
