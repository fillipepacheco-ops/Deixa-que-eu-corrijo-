"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";

/** Caixa "Colar lista de alunos" + importar de Excel, CSV, Word ou PDF (o professor confere antes de salvar). */
export function StudentListField() {
  const area = useRef<HTMLTextAreaElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const { readRosterFile } = await import("@/lib/students/read-file");
      const lines = await readRosterFile(file);
      if (!lines.length) throw new Error("Não encontrei nomes de alunos neste arquivo. Confira se é a lista da turma.");
      const box = area.current!;
      box.value = [box.value.trim(), ...lines].filter(Boolean).join("\n");
      setMsg({
        ok: true,
        text: `${lines.length} ${lines.length === 1 ? "aluno encontrado" : "alunos encontrados"}. Confira a lista abaixo (apague o que não for aluno) e toque em “Importar lista”.`,
      });
      box.focus();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Não foi possível ler o arquivo." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-3 py-3 text-[14px] font-bold text-brand-900 hover:bg-brand-50 disabled:opacity-60"
      >
        {busy ? <Loader2 size={17} className="animate-spin" /> : <FileUp size={17} />}
        {busy ? "Lendo o arquivo…" : "Importar de Excel, Word ou PDF"}
      </button>
      <input
        ref={input}
        type="file"
        className="hidden"
        accept=".xlsx,.xlsm,.csv,.txt,.docx,.pdf,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      {msg && <p className={`rounded-lg px-3 py-2 text-[13px] ${msg.ok ? "bg-brand-50 text-brand-900" : "bg-red-50 text-red-800"}`}>{msg.text}</p>}
      <textarea
        ref={area}
        className="field min-h-36 font-mono text-[13px]"
        name="list"
        placeholder={"1 Ana Beatriz Souza\n2 João Pedro Lima\n3 Maria Clara Alves"}
      />
    </div>
  );
}
