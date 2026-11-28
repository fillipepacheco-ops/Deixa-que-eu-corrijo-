"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Loader2, Moon, Pencil, Sun, Trash2, X } from "lucide-react";
import { SwipeRow } from "@/components/ui/SwipeRow";

type State = { error?: string; ok?: boolean; message?: string };

const REASONS = ["Transferido", "Desistente", "Remanejado de turma", "Outro motivo"];
const brDate = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/**
 * Linha de um aluno: o lápis transforma a própria linha em campos (sem pular a tela),
 * com o nome largo e já selecionado para corrigir.
 */
export function StudentRow({
  student,
  save,
  remove,
  setActive,
}: {
  student: {
    id: string;
    name: string;
    roll_number: number | null;
    registration: string | null;
    active?: boolean | null;
    inactive_reason?: string | null;
    inactive_since?: string | null;
  };
  save: (state: State, formData: FormData) => Promise<State>;
  remove: () => Promise<void>;
  /** Hibernar (false + motivo) ou reativar (true). */
  setActive: (active: boolean, reason?: string) => Promise<void>;
}) {
  const inactive = student.active === false;
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const toggle = async (active: boolean, reason?: string) => {
    setBusy(true);
    try {
      await setActive(active, reason);
      setAsking(false);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <SwipeRow
        contentClassName={inactive ? "bg-gray-50" : "bg-white"}
        actions={[
          { label: "Editar", icon: "edit", tone: "brand", run: () => setEditing(true) },
          inactive
            ? { label: "Voltou", icon: "sun", tone: "brand", run: () => toggle(true) }
            : {
                label: "Saiu",
                icon: "moon",
                tone: "neutral",
                run: () => {
                  setEditing(true);
                  setAsking(true);
                },
              },
          {
            label: "Remover",
            icon: "delete",
            tone: "danger",
            confirm: `Remover ${student.name} da turma? As notas dele também serão apagadas. Se ele só saiu da escola, use “Saiu”.`,
            run: remove,
          },
        ]}
      >
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`flex w-full items-center gap-3 px-5 py-3 text-left ${inactive ? "bg-gray-50 hover:bg-gray-100" : "hover:bg-brand-50/50"}`}
      >
        <span className={`w-8 shrink-0 text-right text-[13px] font-bold tabular-nums ${inactive ? "text-gray-300" : "text-muted"}`}>{student.roll_number ?? "—"}</span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-medium ${inactive ? "text-gray-400 line-through decoration-gray-300" : ""}`}>{student.name}</span>
          {inactive && (
            <span className="flex items-center gap-1 text-[12px] font-semibold text-gray-500">
              <Moon size={12} /> Não frequenta mais · {student.inactive_reason || "inativo"}
              {student.inactive_since ? ` desde ${brDate(student.inactive_since)}` : ""}
            </span>
          )}
        </span>
        {student.registration && !inactive && <span className="hidden text-[12px] text-muted sm:inline">Mat. {student.registration}</span>}
        <Pencil size={15} className="shrink-0 text-muted" />
      </button>
      </SwipeRow>
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
        <span className="ml-auto flex flex-wrap gap-1">
          {inactive ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => toggle(true)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-[13px] font-semibold text-brand-700 hover:bg-brand-50"
            >
              <Sun size={14} /> Voltou a frequentar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAsking(!asking)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] font-bold text-gray-700 hover:bg-gray-100"
            >
              <Moon size={14} /> Não frequenta mais
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Remover ${student.name} da turma? As notas dele também serão apagadas. Se ele só saiu da escola, use “Não frequenta mais”.`)) remove();
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-[13px] font-semibold text-red-700 hover:bg-red-50"
          >
            <Trash2 size={14} /> Remover
          </button>
        </span>
      </div>
      {asking && !inactive && (
        <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-[13px] text-ink">
            <b>{student.name}</b> fica em cinza no lugar dele na chamada, sem prova, cartão, nota nem jogo. As notas que ele já tem continuam guardadas.
          </p>
          <p className="mt-2 text-[12px] font-bold text-muted">Motivo</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                disabled={busy}
                onClick={() => toggle(false, r)}
                className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
