"use client";

import { useActionState, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Sigma, Trash2 } from "lucide-react";
import { MathField } from "@/components/math/MathField";
import { FormulaPalette } from "@/components/math/FormulaPalette";
import type { TextField } from "@/components/math/math-field";
import { QuestionImage, type QuestionImageHandle } from "./QuestionImage";
import { mathToPlain, parseMath } from "@/lib/math/parse";
import type { AssessmentQuestion, QuestionType } from "@/lib/models/types";
import { OPTION_LABELS, QUESTION_TYPE_NAMES } from "@/lib/assessment/question-form";
import { QUESTION_LABEL } from "@/lib/assessment/header";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ConfirmButton } from "@/components/ui/ConfirmButton";

type State = { error?: string; ok?: boolean };

function answerSummary(q: AssessmentQuestion): { text: string; missing: boolean } {
  if (q.type === "essay" || q.type === "lined") return { text: "Correção manual", missing: false };
  if (!q.correct_answers.length) return { text: "Sem resposta no gabarito", missing: true };
  if (q.type === "true_false") return { text: `Resposta: ${q.correct_answers[0] === "C" ? "Certo" : "Errado"}`, missing: false };
  return { text: `Resposta: ${q.correct_answers.join(" ou ")}`, missing: false };
}

const toolbarBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-35 disabled:hover:bg-transparent";

export function QuestionEditor({
  q,
  number,
  isFirst,
  isLast,
  defaultOpen,
  imageUrl,
  save,
  remove,
  moveUp,
  moveDown,
  duplicate,
  imageFolder,
  allowAnnul = true,
}: {
  q: AssessmentQuestion;
  number: number;
  isFirst: boolean;
  isLast: boolean;
  defaultOpen: boolean;
  imageUrl?: string | null;
  save: (state: State, formData: FormData) => Promise<State>;
  remove: () => Promise<void>;
  moveUp: () => Promise<void>;
  moveDown: () => Promise<void>;
  duplicate: () => Promise<void>;
  /** Subpasta das imagens no Storage (ex.: Prova Multi). */
  imageFolder?: string;
  allowAnnul?: boolean;
}) {
  const [type, setType] = useState<QuestionType>(q.type);
  const [state, action] = useActionState<State, FormData>(save, {});
  const [showFormulas, setShowFormulas] = useState(false);
  const activeField = useRef<TextField | null>(null);
  const imageRef = useRef<QuestionImageHandle>(null);
  const track = (el: TextField) => {
    activeField.current = el;
  };
  const summary = answerSummary(q);
  const opts = OPTION_LABELS.map((label) => ({ label, text: q.options.find((o) => o.label === label)?.text ?? "" }));

  return (
    <details open={defaultOpen} className="group rounded-2xl border border-line bg-white open:shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5">
        <span className="rounded-lg bg-brand-900 px-2.5 py-1 text-[12px] font-extrabold tracking-wide text-white">{QUESTION_LABEL(number)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-ink">
            {q.statement ? mathToPlain(parseMath(q.statement)) : <em className="text-muted">Sem enunciado</em>}
          </span>
          <span className="block text-[12px] text-muted">
            {QUESTION_TYPE_NAMES[q.type]} ·{" "}
            <span className={summary.missing ? "font-semibold text-amber-700" : ""}>{summary.text}</span>
            {q.weight !== 1 && ` · peso ${q.weight.toLocaleString("pt-BR")}`}
          </span>
        </span>
        {q.image_path && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">imagem</span>}
        {q.annulled && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold uppercase text-red-700">Anulada</span>}
        <span className="text-[13px] font-semibold text-brand-700 group-open:hidden">Editar</span>
      </summary>

      <div className="border-t border-line px-4 pb-4 pt-4 sm:px-5">
        <form action={action} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div>
              <label className="label">Tipo</label>
              <select className="field" name="type" value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
                {Object.entries(QUESTION_TYPE_NAMES).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Peso</label>
              <input className="field" name="weight" inputMode="decimal" defaultValue={String(q.weight).replace(".", ",")} />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-end justify-between gap-2">
              <label className="label mb-0">Enunciado</label>
              <button
                type="button"
                onClick={() => setShowFormulas((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold ${
                  showFormulas ? "bg-brand-900 text-white" : "border border-brand-200 bg-white text-brand-900 hover:bg-brand-50"
                }`}
              >
                <Sigma size={16} /> Fórmulas
              </button>
            </div>
            {showFormulas && (
              <div className="mb-2">
                <FormulaPalette getTarget={() => activeField.current} />
              </div>
            )}
            <MathField
              name="statement"
              multiline
              defaultValue={q.statement}
              placeholder="Digite ou cole o enunciado (do Word, de sites ou de PDFs: expoentes, frações e raízes são reconhecidos). Enter separa parágrafos."
              onFocusField={track}
              onImagePaste={(f) => imageRef.current?.upload(f)}
            />
          </div>

          <div>
            <label className="label">Imagem da questão</label>
            <QuestionImage ref={imageRef} initialPath={q.image_path} initialUrl={imageUrl} folder={imageFolder} />
          </div>

          {type === "multiple_choice" && (
            <div>
              <label className="label">Alternativas — marque a(s) correta(s)</label>
              <div className="space-y-2">
                {opts.map((o) => (
                  <div key={o.label} className="flex items-start gap-2">
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 py-2 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                      <input type="checkbox" name="correct" value={o.label} defaultChecked={q.correct_answers.includes(o.label)} className="h-4 w-4 accent-[#137a1a]" />
                      <span className="w-4 text-center font-extrabold text-brand-700">{o.label}</span>
                    </label>
                    <MathField
                      name={`opt_${o.label}`}
                      defaultValue={o.text}
                      placeholder={o.label === "E" ? "Opcional" : `Alternativa ${o.label}`}
                      onFocusField={track}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-muted">Deixe a E vazia para provas com 4 alternativas. Marcar mais de uma = aceitar mais de uma resposta.</p>
            </div>
          )}

          {type === "true_false" && (
            <div>
              <label className="label">Resposta correta</label>
              <div className="flex gap-2">
                {[
                  ["C", "Certo"],
                  ["E", "Errado"],
                ].map(([v, l]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                    <input type="radio" name="correct_tf" value={v} defaultChecked={q.correct_answers[0] === v} className="accent-[#137a1a]" />
                    {l}
                  </label>
                ))}
              </div>
            </div>
          )}

          {type === "short_answer" && (
            <div>
              <label className="label">Resposta esperada (separe variações com ;)</label>
              <input className="field" name="expected" defaultValue={q.correct_answers.join("; ")} placeholder="Ex.: fotossíntese; fotossintese" />
            </div>
          )}

          {type === "numeric" && (
            <div>
              <label className="label">Resposta correta (número inteiro de 0 a 999)</label>
              <input
                className="field w-40!"
                name="expected_number"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                defaultValue={q.correct_answers[0] ?? ""}
                placeholder="Ex.: 42"
              />
              <p className="mt-1.5 text-[12px] text-muted">
                Tipo B (PAS): o aluno calcula e marca no cartão a centena, a dezena e a unidade. Ex.: 42 → marca 0, 4 e 2. Resposta com
                decimal ou maior que 999: oriente no enunciado como arredondar (ex.: “despreze a parte fracionária”).
              </p>
            </div>
          )}

          {type === "lined" && (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-[13px] text-brand-900">
              Tipo D (PAS): a prova sai com um quadro de 10 linhas numeradas para o aluno escrever a resposta. A nota é lançada pelo professor.
            </p>
          )}

          {type === "essay" && <p className="rounded-lg bg-brand-50 px-3 py-2 text-[13px] text-brand-900">Discursiva: a prova sai com 6 linhas para resposta e a nota é lançada pelo professor.</p>}

          {allowAnnul && (
            <label className="flex items-center gap-2 text-[14px]">
              <input type="checkbox" name="annulled" defaultChecked={q.annulled} className="h-4 w-4 accent-[#b42318]" />
              Anular questão (ponto para todos)
            </label>
          )}

          {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>}
          {state.ok && <p className="text-sm font-medium text-brand-700">Questão salva.</p>}
          <SubmitButton>Salvar questão</SubmitButton>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-line pt-3">
          <form action={moveUp}>
            <button className={toolbarBtn} disabled={isFirst} aria-label="Subir questão"><ArrowUp size={16} /> Subir</button>
          </form>
          <form action={moveDown}>
            <button className={toolbarBtn} disabled={isLast} aria-label="Descer questão"><ArrowDown size={16} /> Descer</button>
          </form>
          <form action={duplicate}>
            <button className={toolbarBtn}><Copy size={16} /> Duplicar</button>
          </form>
          <span className="flex-1" />
          <ConfirmButton action={remove} message={`Excluir a ${QUESTION_LABEL(number)}? As seguintes serão renumeradas.`} className="px-2.5! py-1.5! text-[13px]">
            <Trash2 size={15} /> Excluir
          </ConfirmButton>
        </div>
      </div>
    </details>
  );
}
