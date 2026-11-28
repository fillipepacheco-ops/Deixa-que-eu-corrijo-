"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { CheckCircle2, Loader2, Plus } from "lucide-react";
import { addBankQuestions } from "@/services/banco";

/**
 * Envolve a lista de questões (cada uma com um checkbox name="ids") e mostra,
 * fixa no rodapé, a barra para mandar as marcadas para uma avaliação.
 */
export function BankAddForm({
  assessments,
  defaultAssessment,
  children,
}: {
  assessments: { id: string; label: string }[];
  defaultAssessment?: string;
  children: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(addBankQuestions, {});
  const [count, setCount] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const recount = () => setCount(formRef.current?.querySelectorAll('input[name="ids"]:checked').length ?? 0);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await action(fd);
      }}
      onChange={recount}
      className="pb-32"
    >
      {children}

      <div className="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-6px_20px_rgba(0,0,0,0.06)] backdrop-blur lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          {state.ok && state.message ? (
            <span className="flex basis-full items-center gap-2 text-[13px] font-semibold text-brand-700">
              <CheckCircle2 size={16} /> {state.message}
              {state.assessmentId && (
                <Link href={`/avaliacoes/${state.assessmentId}`} className="underline">
                  Abrir a avaliação
                </Link>
              )}
            </span>
          ) : state.error ? (
            <span className="basis-full text-[13px] font-semibold text-red-700">{state.error}</span>
          ) : null}
          <span className="text-[14px] font-bold text-brand-900">
            {count} {count === 1 ? "marcada" : "marcadas"}
          </span>
          {assessments.length ? (
            <select name="assessment_id" defaultValue={defaultAssessment ?? ""} className="field min-w-0 flex-1 py-2!" aria-label="Avaliação">
              <option value="">Escolha a avaliação…</option>
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          ) : (
            <Link href="/avaliacoes/nova" className="flex-1 text-[13px] font-semibold text-brand-700 underline">
              Crie uma avaliação para receber as questões
            </Link>
          )}
          <button
            disabled={pending || !count}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-900 px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-40"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Adicionar à avaliação
          </button>
        </div>
      </div>
    </form>
  );
}
