"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, NotebookPen, Settings2 } from "lucide-react";
import { formatNumber, type DiaryFormat, type Rounding } from "@/lib/results/diary";
import { saveDiaryFormat } from "@/services/results";

const STEP_LABEL: Record<string, string> = {
  "0.01": "duas casas (7,25)",
  "0.1": "uma casa (7,3)",
  "0.25": "quarto de ponto (7,25 · 7,5)",
  "0.5": "meio ponto (7,0 · 7,5)",
  "1": "nota inteira (7 · 8)",
};
const ROUND_LABEL: Record<Rounding, string> = { proximo: "para o mais próximo", cima: "sempre para cima", baixo: "sempre para baixo" };

export function describeFormat(f: DiaryFormat, maxScore?: number) {
  const scale = f.scale ? `de 0 a ${f.scale}` : maxScore !== undefined ? `no valor da prova (até ${formatNumber(maxScore, { step: maxScore % 1 ? 0.1 : 1, decimal: f.decimal })})` : "no valor da prova";
  return [
    scale,
    STEP_LABEL[String(f.step)]?.split(" (")[0],
    `arredonda ${ROUND_LABEL[f.rounding]}`,
    f.decimal === "," ? "vírgula" : "ponto",
    `falta: ${f.absent ? `“${f.absent}”` : "em branco"}`,
    f.order === "chamada" ? "ordem de chamada" : "ordem alfabética",
  ].filter(Boolean);
}

/**
 * Como a escola quer a nota no diário. Vale para todas as avaliações da escola.
 * As mudanças aparecem na hora na tabela; "Salvar" guarda para as próximas vezes.
 */
export function DiaryFormatCard({
  school,
  value,
  onChange,
  maxScore,
  ready,
}: {
  school: string;
  value: DiaryFormat;
  onChange: (f: DiaryFormat) => void;
  maxScore?: number;
  ready: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof DiaryFormat>(k: K, v: DiaryFormat[K]) => {
    setMsg(null);
    onChange({ ...value, [k]: v });
  };

  function save() {
    start(async () => {
      const r = await saveDiaryFormat(school, value);
      setMsg(r.ok ? { ok: true, text: "Salvo! Vale para todas as avaliações desta escola." } : { ok: false, text: r.error });
      if (r.ok) setOpen(false);
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex items-start gap-3 p-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <NotebookPen size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold uppercase tracking-wider text-brand-700">Formato do diário</p>
          <p className="truncate font-bold text-brand-900">{school || "Escola não informada"}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {describeFormat(value, maxScore).map((t) => (
              <span key={t} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[12px] font-semibold text-brand-800">
                {t}
              </span>
            ))}
          </div>
          {msg && <p className={`mt-2 text-[13px] font-semibold ${msg.ok ? "text-brand-700" : "text-red-700"}`}>{msg.text}</p>}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[13px] font-bold text-brand-900 hover:border-brand-200 active:scale-95"
        >
          <Settings2 size={16} /> {open ? "Fechar" : "Ajustar"}
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-line p-4">
          {!ready && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              Para guardar o formato, rode a atualização <strong>0004</strong> do banco no Supabase. Enquanto isso, os ajustes valem só nesta tela.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Escala do diário</label>
              <select
                className="field"
                value={value.scale === null ? "prova" : String(value.scale)}
                onChange={(e) => set("scale", e.target.value === "prova" ? null : Number(e.target.value))}
              >
                <option value="prova">No valor da prova (ex.: prova de 5,0 → nota até 5,0)</option>
                <option value="10">Converter para 0 a 10</option>
                <option value="100">Converter para 0 a 100</option>
                <option value="5">Converter para 0 a 5</option>
              </select>
            </div>
            <div>
              <label className="label">Casas / frações aceitas</label>
              <select className="field" value={String(value.step)} onChange={(e) => set("step", Number(e.target.value))}>
                {Object.entries(STEP_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Arredondamento</label>
              <select className="field" value={value.rounding} onChange={(e) => set("rounding", e.target.value as Rounding)}>
                <option value="proximo">Para o mais próximo (7,24 → 7,0 · 7,25 → 7,5)</option>
                <option value="cima">Sempre para cima (7,1 → 7,5)</option>
                <option value="baixo">Sempre para baixo (7,4 → 7,0)</option>
              </select>
            </div>
            <div>
              <label className="label">Separador decimal</label>
              <select className="field" value={value.decimal} onChange={(e) => set("decimal", e.target.value as "," | ".")}>
                <option value=",">Vírgula (7,5)</option>
                <option value=".">Ponto (7.5)</option>
              </select>
            </div>
            <div>
              <label className="label">Quem não fez a prova</label>
              <select
                className="field"
                value={["", "F", "0", "-"].includes(value.absent) ? value.absent : "outro"}
                onChange={(e) => set("absent", e.target.value === "outro" ? "NC" : e.target.value)}
              >
                <option value="">Deixar em branco</option>
                <option value="F">F (falta)</option>
                <option value="0">0 (zero)</option>
                <option value="-">- (traço)</option>
                <option value="outro">Outro…</option>
              </select>
              {!["", "F", "0", "-"].includes(value.absent) && (
                <input className="field mt-2" maxLength={10} value={value.absent} onChange={(e) => set("absent", e.target.value)} placeholder="Ex.: NC" />
              )}
            </div>
            <div>
              <label className="label">Ordem dos alunos</label>
              <select className="field" value={value.order} onChange={(e) => set("order", e.target.value as DiaryFormat["order"])}>
                <option value="chamada">Número de chamada</option>
                <option value="alfabetica">Alfabética</option>
              </select>
            </div>
            <div>
              <label className="label">Média para aprovação</label>
              <select className="field" value={String(value.passPercent)} onChange={(e) => set("passPercent", Number(e.target.value))}>
                {[50, 60, 70].map((p) => (
                  <option key={p} value={p}>
                    {p}% da nota ({p / 10} em 10)
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2.5 self-end rounded-xl border border-line px-3 py-3 text-[14px] font-semibold text-brand-900">
              <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={value.showRegistration} onChange={(e) => set("showRegistration", e.target.checked)} />
              Mostrar matrícula dos alunos
            </label>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={pending || !ready}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-900 px-4 py-3 text-[15px] font-bold text-white disabled:opacity-50 active:scale-[0.98] sm:w-auto"
          >
            {pending ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Salvar formato desta escola
          </button>
        </div>
      )}
    </section>
  );
}
