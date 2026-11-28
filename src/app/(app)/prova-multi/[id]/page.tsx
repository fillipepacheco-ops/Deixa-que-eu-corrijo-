import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Clock, FileText, PencilLine, Trash2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadSchools } from "@/services/school-context";
import { addSlot, deleteMultiExam, generateMulti, moveSlot, removeSlot, reopenMulti, updateMultiExam, updateSlot } from "@/services/multi";
import { Card, PageHeader } from "@/components/ui/PageHeader";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { buttonClass } from "@/components/ui/button";
import { MultiExamFields } from "@/components/multi/MultiExamFields";
import { InviteShare } from "@/components/multi/InviteShare";
import { slotProgress, type MultiQuestion, type MultiSlot } from "@/lib/multi/build";
import { formatDateBR } from "@/lib/assessment/header";

export const metadata: Metadata = { title: "Prova Multi" };

type Slot = MultiSlot & { email: string; invite_code: string; teacher_id: string | null; submitted_at: string | null };

export default async function ProvaMultiDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: exam } = await supabase.from("multi_exams").select("*").eq("id", id).eq("owner_id", user!.id).maybeSingle();
  if (!exam) notFound();

  const [{ data: slotsData }, { data: qs }, schools, { data: classes }, { data: generated }] = await Promise.all([
    supabase.from("multi_slots").select("*").eq("exam_id", id).order("position"),
    supabase.from("multi_questions").select("*").eq("exam_id", id),
    loadSchools(supabase),
    supabase.from("classes").select("id, name, school_id").order("name"),
    exam.assessment_ids?.length ? supabase.from("assessments").select("id, classes(name)").in("id", exam.assessment_ids) : Promise.resolve({ data: [] }),
  ]);
  const slots = (slotsData ?? []) as Slot[];
  const questions = (qs ?? []) as MultiQuestion[];
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;

  const progress = slots.map((s) => slotProgress(s, questions));
  const ready = progress.reduce((a, p) => a + p.ready, 0);
  const total = progress.reduce((a, p) => a + Math.max(p.asked, p.made), 0);
  const className = new Map((classes ?? []).map((c) => [c.id, c.name]));

  return (
    <>
      <Link href="/prova-multi" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft size={16} /> Prova Multi
      </Link>
      <PageHeader
        eyebrow={exam.status === "fechada" ? "Prova gerada · edição dos professores fechada" : "Recebendo questões dos professores"}
        title={exam.title}
        description={[
          formatDateBR(exam.applied_on),
          (exam.class_ids ?? []).map((c: string) => className.get(c)).filter(Boolean).join(", ") || "sem turmas",
          `${exam.versions} ${exam.versions === 1 ? "versão" : "versões"}`,
          `${ready}/${total} questões prontas`,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            {exam.status === "fechada" && (
              <form action={reopenMulti.bind(null, id)}>
                <button className={buttonClass("secondary")}>Reabrir para os professores</button>
              </form>
            )}
            <ConfirmButton action={deleteMultiExam.bind(null, id)} message="Apagar esta Prova Multi e as questões dos professores? As avaliações já geradas nas turmas continuam.">
              <Trash2 size={16} /> Apagar
            </ConfirmButton>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-4">
          <h2 className="text-[15px] font-bold text-brand-900">Professores e disciplinas (cada um é uma seção, nesta ordem)</h2>
          {slots.length === 0 && <p className="rounded-xl border border-dashed border-brand-200 bg-brand-50/60 px-4 py-6 text-center text-[14px] text-muted">Cadastre ao lado os professores que vão mandar questões.</p>}
          {slots.map((s, i) => {
            const p = progress[i];
            const url = `${origin}/convite/${s.invite_code}`;
            return (
              <Card key={s.id} className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-900 text-[14px] font-extrabold text-white">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-extrabold text-brand-900">{s.discipline}</p>
                    <p className="truncate text-[13px] text-muted">
                      {s.teacher_name} · {s.email}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ${
                      s.submitted_at ? "bg-brand-50 text-brand-700" : s.teacher_id ? "bg-amber-50 text-amber-800" : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {s.submitted_at ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                    {s.submitted_at ? "Enviou" : s.teacher_id ? "Escrevendo" : "Ainda não entrou"}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-brand-50">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, (p.ready / Math.max(1, p.asked)) * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[12px] text-muted">
                    {p.ready} de {p.asked} {p.asked === 1 ? "questão pronta" : "questões prontas"}
                    {p.made > p.asked && ` · mandou ${p.made}`}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <InviteShare url={url} teacher={s.teacher_name} discipline={s.discipline} email={s.email} title={exam.title} />
                  <Link href={`/colaborar/${s.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] font-bold text-brand-900 hover:bg-brand-50">
                    <PencilLine size={15} /> Ver / editar questões
                  </Link>
                  <span className="ml-auto flex gap-1">
                    <form action={moveSlot.bind(null, id, s.id, -1)}>
                      <button aria-label="Subir" disabled={i === 0} className="rounded-lg p-1.5 text-muted hover:bg-brand-50 disabled:opacity-30">
                        <ArrowUp size={16} />
                      </button>
                    </form>
                    <form action={moveSlot.bind(null, id, s.id, 1)}>
                      <button aria-label="Descer" disabled={i === slots.length - 1} className="rounded-lg p-1.5 text-muted hover:bg-brand-50 disabled:opacity-30">
                        <ArrowDown size={16} />
                      </button>
                    </form>
                    <ConfirmButton action={removeSlot.bind(null, id, s.id)} message={`Tirar ${s.teacher_name} (${s.discipline}) da prova? As questões dele(a) serão apagadas.`} ariaLabel="Remover">
                      <Trash2 size={15} />
                    </ConfirmButton>
                  </span>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[13px] font-bold text-brand-700">Editar professor</summary>
                  <ActionForm action={updateSlot.bind(null, id, s.id)} submitLabel="Salvar" className="mt-3 grid gap-3 sm:grid-cols-3">
                    <input className="field" name="teacher_name" defaultValue={s.teacher_name} aria-label="Nome" />
                    <input className="field" name="discipline" defaultValue={s.discipline} aria-label="Disciplina" />
                    <input className="field" name="question_count" type="number" min={1} max={40} defaultValue={s.question_count} aria-label="Nº de questões" />
                  </ActionForm>
                </details>
              </Card>
            );
          })}

          <Card className="p-5">
            <h2 className="mb-1 text-[16px] font-bold text-brand-900">Gerar a prova nas turmas</h2>
            <p className="mb-3 text-[13px] text-muted">
              Junta as questões de todos os professores, com uma seção por disciplina, e cria a avaliação de cada turma (prova, cartão-resposta, correção e
              notas, como as outras). Ao gerar, os professores não conseguem mais mudar as questões; se precisar, reabra e gere de novo.
            </p>
            {(generated ?? []).length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {(generated ?? []).map((a) => (
                  <Link key={a.id} href={`/avaliacoes/${a.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-[13px] font-bold text-brand-900 hover:bg-brand-100">
                    <FileText size={15} /> {(a.classes as unknown as { name: string } | null)?.name ?? "Turma"}
                  </Link>
                ))}
              </div>
            )}
            <ActionForm action={generateMulti.bind(null, id)} submitLabel={(generated ?? []).length ? "Gerar de novo (atualizar)" : "Gerar a prova"}>
              <p className="text-[14px] font-semibold text-brand-900">
                {ready === total && total > 0 ? "Tudo pronto ✓" : `${ready} de ${total} questões prontas`}
              </p>
            </ActionForm>
          </Card>
        </section>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-[16px] font-bold text-brand-900">
              <UserPlus size={18} /> Cadastrar professor
            </h2>
            <ActionForm action={addSlot.bind(null, id)} submitLabel="Cadastrar" submitClassName="w-full" resetOnSuccess className="space-y-3">
              <div>
                <label className="label">Nome</label>
                <input className="field" name="teacher_name" required />
              </div>
              <div>
                <label className="label">Disciplina</label>
                <input className="field" name="discipline" placeholder="Ex.: Língua Portuguesa" required />
              </div>
              <div>
                <label className="label">E-mail (login do professor)</label>
                <input className="field" name="email" type="email" autoCapitalize="none" required />
              </div>
              <div>
                <label className="label">Quantas questões</label>
                <input className="field" name="question_count" type="number" min={1} max={40} defaultValue={2} />
              </div>
            </ActionForm>
            <p className="mt-3 text-[12px] text-muted">
              Depois mande o convite. O professor entra com esse e-mail e só vê esta prova — não precisa pagar.
            </p>
          </Card>
          <Card className="p-5">
            <details>
              <summary className="cursor-pointer text-[16px] font-bold text-brand-900">Dados da prova</summary>
              <ActionForm action={updateMultiExam.bind(null, id)} submitLabel="Salvar dados" className="mt-4">
                <MultiExamFields
                  value={{ ...exam, max_score: Number(exam.max_score) }}
                  schools={schools}
                  classes={(classes ?? []) as { id: string; name: string; school_id: string | null }[]}
                />
              </ActionForm>
            </details>
          </Card>
        </aside>
      </div>
    </>
  );
}
