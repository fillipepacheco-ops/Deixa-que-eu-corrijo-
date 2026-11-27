import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, CheckCircle2, FileUp, Lock, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  addMultiQuestion,
  appendImportedMulti,
  duplicateMultiQuestion,
  moveMultiQuestion,
  removeMultiQuestion,
  saveMultiQuestion,
  slotResults,
  startMultiQuestions,
  submitSlot,
} from "@/services/multi";
import { questionImageUrls, toQuestion, type QuestionRow } from "@/services/assessment-data";
import { QuestionEditor } from "@/components/assessments/QuestionEditor";
import { ImportExam } from "@/components/assessments/ImportExam";
import { MultiResults, type SlotResultClass } from "@/components/multi/MultiResults";
import { QUESTION_TYPE_NAMES } from "@/lib/assessment/question-form";
import { QUESTION_LABEL } from "@/lib/assessment/header";
import { answersOf, missingOf, slotProgress, type MultiQuestion } from "@/lib/multi/build";
import type { QuestionType } from "@/lib/models/types";

export const metadata: Metadata = { title: "Minhas questões" };

const ADD_TYPES: QuestionType[] = ["multiple_choice", "true_false", "numeric", "lined", "short_answer", "essay"];

export default async function SlotPage({ params }: { params: Promise<{ slotId: string }> }) {
  const { slotId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: slot } = await supabase.from("multi_slots").select("*, multi_exams(id, title, status, owner_id, assessment_ids)").eq("id", slotId).maybeSingle();
  if (!slot) notFound();
  const exam = slot.multi_exams as unknown as { id: string; title: string; status: string; owner_id: string; assessment_ids: string[] | null };
  const isCoordinator = exam.owner_id === user!.id;
  const open = exam.status === "aberta" || isCoordinator;

  const { data: qs } = await supabase.from("multi_questions").select("*").eq("slot_id", slotId).order("position");
  const raw = (qs ?? []) as (MultiQuestion & { id: string })[];
  const questions = raw.map((q) =>
    toQuestion({
      id: q.id,
      position: q.position,
      type: q.type ?? "multiple_choice",
      statement: q.statement,
      options: q.options ?? [],
      correct_answers: answersOf(q),
      weight: Number(q.weight ?? 1),
      annulled: !!q.annulled,
      table_data: null,
      image_path: q.image_path ?? null,
    } as QuestionRow),
  );
  const [imageUrls, results] = await Promise.all([
    questionImageUrls(supabase, questions),
    exam.assessment_ids?.length ? slotResults(slotId) : Promise.resolve(null),
  ]);
  const prog = slotProgress(slot, raw);
  const folder = `multi/${slotId}`;

  return (
    <>
      <Link href={isCoordinator ? `/prova-multi/${exam.id}` : "/colaborar"} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft size={16} /> {isCoordinator ? "Voltar para a Prova Multi" : "Suas provas"}
      </Link>
      <p className="text-[12px] font-bold uppercase tracking-wider text-brand-700">{slot.discipline}</p>
      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-brand-900">{exam.title}</h1>
      <p className="mt-1 text-[15px] text-muted">
        {isCoordinator
          ? `Questões de ${slot.teacher_name}.`
          : `Olá, ${slot.teacher_name}! A coordenação pediu ${slot.question_count} ${slot.question_count === 1 ? "questão" : "questões"} de ${slot.discipline}.`}{" "}
        Use o mesmo editor das avaliações: todos os tipos de questão, fórmulas, imagens (pode colar direto no enunciado) e importação de PDF ou Word. A
        prova final, o cabeçalho e a impressão ficam por conta da coordenação.
      </p>

      <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[14px] font-bold text-brand-900">
          <span>
            {prog.ready} de {prog.asked} {prog.asked === 1 ? "questão pronta" : "questões prontas"}
            {prog.made > prog.asked && <span className="font-semibold text-muted"> · {prog.made} feitas</span>}
          </span>
          {slot.submitted_at && (
            <span className="inline-flex items-center gap-1 text-brand-700">
              <CheckCircle2 size={16} /> Enviado para a coordenação
            </span>
          )}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-50">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, (prog.ready / Math.max(1, prog.asked)) * 100)}%` }} />
        </div>
        {!open && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
            <Lock size={15} /> A coordenação já gerou a prova. Para mudar alguma coisa, peça para reabrir.
          </p>
        )}
      </div>

      {open && questions.length === 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <form action={startMultiQuestions.bind(null, slotId)} className="rounded-2xl bg-white p-5 ring-1 ring-line">
            <p className="text-[16px] font-extrabold text-brand-900">Digitar as questões</p>
            <p className="mt-1 text-[13px] text-muted">Cria as {slot.question_count} questões de múltipla escolha para você preencher (dá para trocar o tipo de cada uma).</p>
            <button className="mt-4 w-full rounded-xl bg-brand-900 px-4 py-2.5 text-[14px] font-bold text-white">Começar</button>
          </form>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-line">
            <p className="mb-3 flex items-center gap-2 text-[16px] font-extrabold text-brand-900">
              <FileUp size={18} /> Já tenho em PDF ou Word
            </p>
            <ImportExam mode="append" imageFolder={folder} appendAction={appendImportedMulti.bind(null, slotId)} />
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {open
          ? questions.map((q, i) => {
              const miss = missingOf(raw[i]);
              return (
                <div key={`${q.id}-${JSON.stringify([q.type, q.statement, q.options, q.correct_answers, q.weight, q.image_path])}`}>
                  {miss.length > 0 && <p className="mb-1 ml-1 text-[12px] font-semibold text-amber-700">{QUESTION_LABEL(i + 1)}: falta {miss.join(", ")}</p>}
                  <QuestionEditor
                    q={q}
                    number={i + 1}
                    isFirst={i === 0}
                    isLast={i === questions.length - 1}
                    defaultOpen={miss.length > 0 && i === raw.findIndex((x) => missingOf(x).length > 0)}
                    imageUrl={q.image_path ? imageUrls[q.image_path] : null}
                    imageFolder={folder}
                    allowAnnul={isCoordinator}
                    save={saveMultiQuestion.bind(null, slotId, q.id!)}
                    remove={removeMultiQuestion.bind(null, slotId, q.id!)}
                    moveUp={moveMultiQuestion.bind(null, slotId, q.id!, -1)}
                    moveDown={moveMultiQuestion.bind(null, slotId, q.id!, 1)}
                    duplicate={duplicateMultiQuestion.bind(null, slotId, q.id!)}
                  />
                </div>
              );
            })
          : questions.map((q, i) => (
              <div key={q.id} className="rounded-2xl bg-white p-4 text-[14px] ring-1 ring-line">
                <p className="mb-1 text-[12px] font-extrabold text-brand-700">
                  {QUESTION_LABEL(i + 1)} · {QUESTION_TYPE_NAMES[q.type]}
                </p>
                <p className="whitespace-pre-line text-ink">{q.statement || "—"}</p>
                {q.image_path && imageUrls[q.image_path] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrls[q.image_path]} alt="" className="mt-2 max-h-48 rounded-lg border border-line" />
                )}
                {q.options.map((o) => (
                  <p key={o.label} className={q.correct_answers.includes(o.label) ? "font-bold text-brand-700" : "text-ink"}>
                    {o.label}) {o.text}
                  </p>
                ))}
              </div>
            ))}
      </div>

      {open && questions.length > 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-brand-200 bg-white p-4">
          <p className="mb-2 text-[13px] font-bold text-brand-900">Adicionar questão</p>
          <div className="flex flex-wrap gap-2">
            {ADD_TYPES.map((t) => (
              <form key={t} action={addMultiQuestion.bind(null, slotId, t)}>
                <button className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-brand-900 hover:bg-brand-50">
                  <Plus size={14} /> {QUESTION_TYPE_NAMES[t]}
                </button>
              </form>
            ))}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] font-bold text-brand-700">Importar mais questões de PDF ou Word</summary>
            <div className="mt-3">
              <ImportExam mode="append" imageFolder={folder} appendAction={appendImportedMulti.bind(null, slotId)} />
            </div>
          </details>
        </div>
      )}

      {open && !isCoordinator && questions.length > 0 && (
        <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-line">
          {slot.submitted_at ? (
            <form action={submitSlot.bind(null, slotId, false)} className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-[14px] text-muted">Você avisou que terminou. Ainda pode corrigir até a coordenação gerar a prova.</p>
              <button className="rounded-xl border border-line px-4 py-2.5 text-[14px] font-bold text-brand-900">Ainda estou mexendo</button>
            </form>
          ) : (
            <form action={submitSlot.bind(null, slotId, true)} className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-[14px] text-muted">
                {prog.ready < prog.asked || prog.ready < prog.made ? "Complete as questões e avise a coordenação." : "Tudo pronto! Avise a coordenação."}
              </p>
              <button disabled={prog.ready < prog.asked || prog.ready < prog.made} className="rounded-xl bg-brand-900 px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-50">
                Terminei — enviar para a coordenação
              </button>
            </form>
          )}
        </div>
      )}

      {results !== null && (
        <section className="mt-10">
          <h2 className="mb-1 flex items-center gap-2 text-[20px] font-extrabold text-brand-900">
            <BarChart3 size={20} /> Notas de {slot.discipline}
          </h2>
          <p className="mb-4 text-[14px] text-muted">
            Só as suas questões contam. A coordenação corrige os cartões uma vez e a nota de cada disciplina aparece aqui para o professor lançar no diário —
            ninguém precisa entrar na conta de outra pessoa.
          </p>
          <MultiResults data={(results ?? []) as SlotResultClass[]} discipline={slot.discipline} />
        </section>
      )}
    </>
  );
}
