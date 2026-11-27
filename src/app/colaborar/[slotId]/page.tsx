import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { saveMultiQuestion, submitSlot } from "@/services/multi";
import { ActionForm } from "@/components/ui/ActionForm";
import { OPTION_LETTERS, missingOf, slotProgress, type MultiQuestion } from "@/lib/multi/build";

export const metadata: Metadata = { title: "Minhas questões" };

export default async function SlotPage({ params }: { params: Promise<{ slotId: string }> }) {
  const { slotId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: slot } = await supabase
    .from("multi_slots")
    .select("*, multi_exams(id, title, option_count, status, owner_id, applied_on)")
    .eq("id", slotId)
    .maybeSingle();
  if (!slot) notFound();
  const exam = slot.multi_exams as unknown as { id: string; title: string; option_count: number; status: string; owner_id: string; applied_on: string | null };
  const isCoordinator = exam.owner_id === user!.id;
  const open = exam.status === "aberta" || isCoordinator;
  const { data: qs } = await supabase.from("multi_questions").select("*").eq("slot_id", slotId).order("position");
  const questions = (qs ?? []) as MultiQuestion[];
  const letters = OPTION_LETTERS.slice(0, exam.option_count === 4 ? 4 : 5);
  const prog = slotProgress(slot, questions, exam.option_count);

  return (
    <>
      <Link href={isCoordinator ? `/prova-multi/${exam.id}` : "/colaborar"} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft size={16} /> {isCoordinator ? "Voltar para a Prova Multi" : "Suas provas"}
      </Link>
      <p className="text-[12px] font-bold uppercase tracking-wider text-brand-700">{slot.discipline}</p>
      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-brand-900">{exam.title}</h1>
      <p className="mt-1 text-[15px] text-muted">
        {isCoordinator ? `Questões de ${slot.teacher_name}.` : `Olá, ${slot.teacher_name}! A coordenação pediu ${slot.question_count} ${slot.question_count === 1 ? "questão" : "questões"} de ${slot.discipline}.`}{" "}
        Cada questão tem {letters.length} alternativas ({letters[0]} a {letters[letters.length - 1]}) e uma correta.
      </p>

      <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-line">
        <div className="flex items-center justify-between text-[14px] font-bold text-brand-900">
          <span>
            {prog.ready} de {prog.total} prontas
          </span>
          {slot.submitted_at && (
            <span className="inline-flex items-center gap-1 text-brand-700">
              <CheckCircle2 size={16} /> Enviado para a coordenação
            </span>
          )}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-50">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${(prog.ready / Math.max(1, prog.total)) * 100}%` }} />
        </div>
        {!open && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
            <Lock size={15} /> A coordenação já gerou a prova. Para mudar alguma coisa, peça para reabrir.
          </p>
        )}
      </div>

      <div className="mt-6 space-y-5">
        {Array.from({ length: slot.question_count }, (_, k) => k + 1).map((pos) => {
          const q = questions.find((x) => x.position === pos);
          const miss = missingOf(q, exam.option_count);
          return (
            <section key={`${pos}-${q?.statement ?? ""}-${q?.correct ?? ""}`} className="rounded-2xl bg-white p-5 ring-1 ring-line">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[16px] font-extrabold text-brand-900">Questão {pos}</h2>
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${miss.length ? "bg-amber-50 text-amber-800" : "bg-brand-50 text-brand-700"}`}>
                  {miss.length ? `Falta ${miss.join(", ")}` : "Pronta ✓"}
                </span>
              </div>
              {open ? (
                <ActionForm action={saveMultiQuestion.bind(null, slotId, pos)} submitLabel={`Salvar questão ${pos}`} className="space-y-3">
                  <div>
                    <label className="label">Enunciado</label>
                    <textarea className="field min-h-32" name="statement" defaultValue={q?.statement ?? ""} placeholder="Texto da questão (pode colar do Word)" />
                  </div>
                  {letters.map((l) => (
                    <div key={l} className="flex items-start gap-2">
                      <label className="mt-2.5 flex shrink-0 cursor-pointer items-center gap-1.5" title="Marque a correta">
                        <input type="radio" name="correct" value={l} defaultChecked={q?.correct === l} className="h-5 w-5 accent-brand-700" />
                        <span className="w-4 text-[15px] font-extrabold text-brand-900">{l}</span>
                      </label>
                      <input className="field" name={`opt_${l}`} defaultValue={q?.options?.find((o) => o.label === l)?.text ?? ""} placeholder={`Alternativa ${l}`} />
                    </div>
                  ))}
                  <p className="text-[12px] text-muted">Marque a bolinha da alternativa correta.</p>
                </ActionForm>
              ) : (
                <div className="space-y-2 text-[14px]">
                  <p className="whitespace-pre-line text-ink">{q?.statement || "—"}</p>
                  {letters.map((l) => (
                    <p key={l} className={q?.correct === l ? "font-bold text-brand-700" : "text-ink"}>
                      {l}) {q?.options?.find((o) => o.label === l)?.text ?? ""}
                    </p>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {open && !isCoordinator && (
        <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-line">
          {slot.submitted_at ? (
            <form action={submitSlot.bind(null, slotId, false)} className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-[14px] text-muted">Você avisou que terminou. Ainda pode corrigir até a coordenação gerar a prova.</p>
              <button className="rounded-xl border border-line px-4 py-2.5 text-[14px] font-bold text-brand-900">Ainda estou mexendo</button>
            </form>
          ) : (
            <form action={submitSlot.bind(null, slotId, true)} className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-[14px] text-muted">
                {prog.ready < prog.total ? "Complete todas as questões e avise a coordenação." : "Tudo pronto! Avise a coordenação."}
              </p>
              <button disabled={prog.ready < prog.total} className="rounded-xl bg-brand-900 px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-50">
                Terminei — enviar para a coordenação
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
