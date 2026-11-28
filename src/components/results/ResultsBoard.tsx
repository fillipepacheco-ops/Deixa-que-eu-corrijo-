"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Camera, CheckCircle2, Circle, FileSpreadsheet, FileText, ImageIcon, Loader2, PencilLine, Trash2, X } from "lucide-react";
import {
  columnText,
  diaryMax,
  diaryText,
  diaryValue,
  formatNumber,
  formatRaw,
  passes,
  sortStudents,
  tableText,
  type DiaryFormat,
} from "@/lib/results/diary";
import { FileButton } from "@/components/assessments/FileButton";
import { saveManualScore } from "@/services/results";
import { CopyButton } from "./CopyButton";
import { DiaryFormatCard } from "./DiaryFormatCard";

export interface BoardRow {
  id: string;
  name: string;
  roll_number: number | null;
  registration: string | null;
  score: number | null;
  correct: number | null;
  source: string | null;
  proofUrl: string | null;
  /** Não frequenta mais: linha em cinza, sem lançamento (fica em branco no diário). */
  inactive?: boolean;
  inactiveReason?: string | null;
}

function useLaunched(key: string) {
  const [set, setSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      setSet(new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]));
    } catch {
      /* sem armazenamento: começa vazio */
    }
  }, [key]);
  const save = (next: Set<string>) => {
    setSet(next);
    try {
      localStorage.setItem(key, JSON.stringify([...next]));
    } catch {
      /* ignora */
    }
  };
  return [set, save] as const;
}

export function ResultsBoard({
  assessmentId,
  title,
  maxScore,
  school,
  initialFormat,
  formatsReady,
  rows: initialRows,
}: {
  assessmentId: string;
  title: string;
  maxScore: number;
  school: string;
  initialFormat: DiaryFormat;
  formatsReady: boolean;
  rows: BoardRow[];
}) {
  const [fmt, setFmt] = useState(initialFormat);
  const [rows, setRows] = useState(initialRows);
  useEffect(() => setRows(initialRows), [initialRows]);
  const [launched, setLaunched] = useLaunched(`dqec:lancados:${assessmentId}`);
  const [editing, setEditing] = useState<string | null>(null);

  const ordered = useMemo(() => sortStudents(rows, fmt.order), [rows, fmt.order]);
  const max = diaryMax(maxScore, fmt);
  const active = ordered.filter((r) => !r.inactive);
  const graded = active.filter((r) => r.score !== null);
  const values = graded.map((r) => diaryValue(r.score as number, maxScore, fmt));
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const below = values.filter((v) => !passes(v, max, fmt)).length;
  const show = (v: number) => formatNumber(v, fmt);
  const doneCount = active.filter((r) => launched.has(r.id)).length;
  const cell = (r: BoardRow) => (r.inactive && r.score === null ? "" : diaryText(r.score, maxScore, fmt));
  const fmtParam = encodeURIComponent(JSON.stringify(fmt));

  function toggle(id: string) {
    const next = new Set(launched);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setLaunched(next);
  }

  const notesColumn = () => columnText(ordered.map(cell));
  const fullTable = () =>
    tableText([
      ["Nº", ...(fmt.showRegistration ? ["Matrícula"] : []), "Aluno", "Nota"],
      ...ordered.map((r) => [r.roll_number ? String(r.roll_number) : "", ...(fmt.showRegistration ? [r.registration ?? ""] : []), r.name, cell(r)]),
    ]);

  return (
    <div className="space-y-5">
      {/* resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Corrigidas" value={`${graded.length}/${active.length}`} />
        <Stat label="Média da turma" value={mean === null ? "—" : formatRaw(mean, fmt.decimal)} sub={`de ${show(max)}`} />
        <Stat label="Maior · menor" value={values.length ? `${show(Math.max(...values))} · ${show(Math.min(...values))}` : "—"} />
        <Stat label="Abaixo da média" value={String(below)} sub={`média ${fmt.passPercent}% (${show((max * fmt.passPercent) / 100)})`} warn={below > 0} />
      </div>

      <DiaryFormatCard school={school} value={fmt} onChange={setFmt} maxScore={maxScore} ready={formatsReady} />

      {/* lançar no diário */}
      <section className="rounded-2xl border border-line bg-white">
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-[19px] font-extrabold text-brand-900">Lançar no diário</h2>
              <p className="text-[13px] text-muted">Notas já no formato da escola. Depois de passar a nota de um aluno, toque nele: ele fica marcado ✓.</p>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-[13px] font-bold text-brand-800">
              {doneCount} de {active.length} lançados
            </span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <CopyButton primary text={notesColumn} label="Copiar só as notas" hint="Uma por linha, na ordem da lista — cole na coluna do diário" />
            <CopyButton text={fullTable} label="Copiar nº, nome e nota" hint="Cole numa planilha: cada coisa cai na sua coluna" />
            <FileButton
              href={`/api/resultados/${assessmentId}/arquivo?tipo=pdf&formato=${fmtParam}`}
              filename={`notas-${title}.pdf`.replace(/\s+/g, "-")}
              mime="application/pdf"
              title="Lista de notas (PDF)"
              subtitle="Para imprimir, conferir ou arquivar"
              icon={<FileText size={22} />}
            />
            <FileButton
              href={`/api/resultados/${assessmentId}/arquivo?tipo=planilha&formato=${fmtParam}`}
              filename={`notas-${title}.csv`.replace(/\s+/g, "-")}
              mime="text/csv"
              title="Planilha (Excel)"
              subtitle="Abre no Excel, Google Planilhas e Numbers"
              icon={<FileSpreadsheet size={22} />}
            />
          </div>
          {doneCount > 0 && (
            <button type="button" onClick={() => setLaunched(new Set())} className="text-[13px] font-semibold text-muted underline">
              Desmarcar todos
            </button>
          )}
        </div>

        <ul className="divide-y divide-line border-t border-line">
          {ordered.map((r) => {
            if (r.inactive) {
              return (
                <li key={r.id} className="bg-gray-50">
                  <div className="flex items-center gap-3 px-4 py-3 select-none sm:px-5" title="Não frequenta mais: sem lançamento">
                    <Circle size={24} className="shrink-0 text-gray-200" />
                    <span className="w-7 shrink-0 text-right text-[14px] font-bold tabular-nums text-gray-300">{r.roll_number ?? "–"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-gray-400 line-through decoration-gray-300">{r.name}</span>
                      <span className="text-[12px] font-semibold text-gray-500">Não frequenta mais{r.inactiveReason ? ` · ${r.inactiveReason}` : ""}</span>
                    </span>
                    <span className="min-w-14 shrink-0 rounded-xl bg-gray-100 px-2.5 py-1.5 text-center text-[16px] font-bold text-gray-400">
                      {r.score === null ? "—" : diaryText(r.score, maxScore, fmt)}
                    </span>
                  </div>
                </li>
              );
            }
            const done = launched.has(r.id);
            const value = r.score === null ? null : diaryValue(r.score, maxScore, fmt);
            const low = value !== null && !passes(value, max, fmt);
            const text = diaryText(r.score, maxScore, fmt);
            const raw = r.score === null ? "" : formatRaw(r.score, fmt.decimal);
            const differs = r.score !== null && (fmt.scale !== null || Math.abs((value ?? 0) - r.score) > 0.001);
            return (
              <li key={r.id} className={done ? "bg-brand-50/70" : ""}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(r.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggle(r.id)}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 select-none sm:px-5"
                >
                  {done ? <CheckCircle2 size={24} className="shrink-0 text-brand-500" /> : <Circle size={24} className="shrink-0 text-line" />}
                  <span className="w-7 shrink-0 text-right text-[14px] font-bold tabular-nums text-muted">{r.roll_number ?? "–"}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] font-semibold ${done ? "text-muted line-through decoration-brand-200" : "text-brand-900"}`}>{r.name}</span>
                    <span className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                      {fmt.showRegistration && r.registration && <span>Matr. {r.registration}</span>}
                      {r.source === "manual" && <span className="font-semibold text-brand-700">lançada à mão</span>}
                      {r.source && r.source !== "manual" && r.correct !== null && <span>{r.correct} acertos</span>}
                      {differs && (
                        <span>
                          na prova: {raw} de {formatRaw(maxScore, fmt.decimal)}
                        </span>
                      )}
                      {r.score === null && <span className="font-semibold text-amber-700">não corrigida</span>}
                    </span>
                  </span>
                  <span
                    className={`min-w-14 shrink-0 rounded-xl px-2.5 py-1.5 text-center text-[20px] font-extrabold tabular-nums ${
                      r.score === null ? "bg-gray-100 text-gray-400" : low ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-900"
                    }`}
                  >
                    {r.score === null ? text || "—" : text}
                  </span>
                  <span className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                    {r.proofUrl && (
                      <a href={r.proofUrl} target="_blank" rel="noreferrer" title="Ver comprovante" className="grid h-9 w-9 place-items-center rounded-lg text-brand-700 hover:bg-brand-50">
                        <ImageIcon size={18} />
                      </a>
                    )}
                    {(r.source === null || r.source === "manual") && (
                      <button type="button" title="Lançar nota à mão" onClick={() => setEditing(editing === r.id ? null : r.id)} className="grid h-9 w-9 place-items-center rounded-lg text-brand-700 hover:bg-brand-50">
                        <PencilLine size={18} />
                      </button>
                    )}
                  </span>
                </div>
                {editing === r.id && (
                  <ManualScore
                    assessmentId={assessmentId}
                    studentId={r.id}
                    maxScore={maxScore}
                    current={r.source === "manual" ? r.score : null}
                    onDone={(score) => {
                      setEditing(null);
                      setRows((list) => list.map((x) => (x.id === r.id ? { ...x, score, source: score === null ? null : "manual", correct: null } : x)));
                    }}
                    onCancel={() => setEditing(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
        {graded.length < active.length && (
          <div className="border-t border-line p-4 sm:p-5">
            <Link href={`/correcao/${assessmentId}`} className="inline-flex items-center gap-2 rounded-xl bg-brand-900 px-4 py-3 text-[14px] font-bold text-white active:scale-[0.98]">
              <Camera size={18} /> Corrigir os que faltam pela câmera
            </Link>
            <p className="mt-2 text-[12px] text-muted">Aluno que fez a prova sem cartão? Toque no lápis ao lado dele e lance a nota à mão.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub, warn = false }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-[12px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-0.5 text-[24px] font-extrabold tabular-nums ${warn ? "text-red-700" : "text-brand-900"}`}>{value}</p>
      {sub && <p className="text-[12px] text-muted">{sub}</p>}
    </div>
  );
}

function ManualScore({
  assessmentId,
  studentId,
  maxScore,
  current,
  onDone,
  onCancel,
}: {
  assessmentId: string;
  studentId: string;
  maxScore: number;
  current: number | null;
  onDone: (score: number | null) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(current === null ? "" : String(current).replace(".", ","));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function save(value: number | null) {
    setError("");
    start(async () => {
      const r = await saveManualScore(assessmentId, studentId, value);
      if (r.ok) onDone(value);
      else setError(r.error);
    });
  }

  function submit() {
    const v = Number(text.replace(",", ".").trim());
    if (!text.trim() || !Number.isFinite(v)) return setError("Digite a nota, ex.: 7,5");
    if (v < 0 || v > maxScore) return setError(`A nota vai de 0 a ${String(maxScore).replace(".", ",")}.`);
    save(v);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 bg-brand-50/60 px-4 pb-3 sm:px-5">
      <label className="text-[13px] font-semibold text-brand-900">Nota na prova (0 a {String(maxScore).replace(".", ",")}):</label>
      <input
        autoFocus
        inputMode="decimal"
        className="field w-24! py-2!"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="7,5"
      />
      <button type="button" onClick={submit} disabled={pending} className="rounded-lg bg-brand-900 px-3 py-2 text-[13px] font-bold text-white disabled:opacity-50">
        {pending ? <Loader2 size={16} className="animate-spin" /> : "Salvar"}
      </button>
      {current !== null && (
        <button type="button" onClick={() => save(null)} disabled={pending} className="flex items-center gap-1 rounded-lg px-2 py-2 text-[13px] font-semibold text-red-700">
          <Trash2 size={15} /> Apagar
        </button>
      )}
      <button type="button" onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-lg text-muted">
        <X size={18} />
      </button>
      {error && <p className="w-full text-[13px] font-semibold text-red-700">{error}</p>}
    </div>
  );
}
