"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";

type State = { error?: string; ok?: boolean; message?: string };

/**
 * Linha de um aluno: o lápis transforma a própria linha em campos (sem pular a tela),
 * com o nome largo e já selecionado para corrigir.
 */
export function StudentRow({
  student,
  save,
  remove,
}: {
  student: { id: string; name: string; roll_number: number | null; registration: string | null };
  save: (state: State, formData: FormData) => Promise<State>;
  remove: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<State, FormData>(save, {});
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      const el = nameRef.current;
      el?.focus({ preventScroll: true });
      el?.select();
    }
  }, [editing]);
  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-brand-50/50">
        <span className="w-8 shrink-0 text-right text-[13px] font-bold tabular-nums text-muted">{student.roll_number ?? "—"}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{student.name}</span>
        {student.registration && <span className="hidden text-[12px] text-muted sm:inline">Mat. {student.registration}</span>}
        <Pencil size={15} className="shrink-0 text-muted" />
      </button>
    );
  }

  return (
    <form action={formAction} className="bg-brand-50/60 px-5 py-3">
      <div className="flex items-center gap-2">
        <input
          className="field w-16! shrink-0 px-2! text-center"
          name="roll_number"
          type="number"
          inputMode="numeric"
          placeholder="Nº"
          defaultValue={student.roll_number ?? ""}
          aria-label="Nº de chamada"
        />
        <input ref={nameRef} className="field min-w-0 flex-1" name="name" defaultValue={student.name} aria-label="Nome completo" required />
      </div>
      <input type="hidden" name="registration" value={student.registration ?? ""} />
      {state.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-900 px-3.5 py-2 text-[14px] font-bold text-white disabled:opacity-60">
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Salvar
        </button>
        <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 py-2 text-[14px] font-semibold text-brand-900">
          <X size={15} /> Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Remover ${student.name} da turma?`)) remove();
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-2 text-[13px] font-semibold text-red-700 hover:bg-red-50"
        >
          <Trash2 size={14} /> Remover
        </button>
      </div>
    </form>
  );
}
