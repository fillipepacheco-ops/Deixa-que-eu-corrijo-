import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Layers, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadAccess } from "@/services/access";
import { loadSchools } from "@/services/school-context";
import { createMultiExam } from "@/services/multi";
import { Card, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { ActionForm } from "@/components/ui/ActionForm";
import { MultiExamFields } from "@/components/multi/MultiExamFields";
import { PLANS } from "@/lib/billing/plans";
import { formatDateBR } from "@/lib/assessment/header";

export const metadata: Metadata = { title: "Prova Multi" };

export default async function ProvaMultiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await loadAccess(supabase, user!.id);
  const canCreate = access.isAdmin || access.sub?.plan === "direcao";

  const [{ data: exams, error }, { data: invites }, schools, { data: classes }] = await Promise.all([
    supabase.from("multi_exams").select("id, title, applied_on, status, class_ids, versions, multi_slots(id, submitted_at)").eq("owner_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("multi_slots").select("id, discipline, question_count, submitted_at, multi_exams(title, status)").eq("teacher_id", user!.id),
    loadSchools(supabase),
    supabase.from("classes").select("id, name, school_id").order("name"),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Plano Direção"
        title="Prova Multi"
        description="A coordenação monta uma prova com várias disciplinas: cada professor recebe um convite, envia as suas questões e o app junta tudo em seções, com até 4 versões."
      />
      {error && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Rode a migração 0011_prova_multi.sql no Supabase para usar a Prova Multi.</p>}

      {(invites ?? []).length > 0 && (
        <Card className="mb-6 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-[16px] font-bold text-brand-900">
            <Mail size={18} /> Convites para você
          </h2>
          <div className="space-y-2">
            {(invites ?? []).map((s) => {
              const e = s.multi_exams as unknown as { title: string; status: string } | null;
              return (
                <Link key={s.id} href={`/colaborar/${s.id}`} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 hover:border-brand-200 hover:bg-brand-50/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-brand-900">{e?.title}</p>
                    <p className="text-[13px] text-muted">
                      {s.discipline} · {s.question_count} {s.question_count === 1 ? "questão" : "questões"} · {s.submitted_at ? "enviada ✓" : e?.status === "fechada" ? "fechada" : "pendente"}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-muted" />
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {!canCreate ? (
        <Card className="p-6">
          <h2 className="text-[18px] font-extrabold text-brand-900">Disponível no plano Direção</h2>
          <p className="mt-2 max-w-2xl text-[14px] text-muted">
            Com o plano {PLANS.direcao.name} ({PLANS.direcao.price}/mês) a coordenação cadastra os professores, cada um envia as suas questões e o app monta a
            prova da escola inteira, com seções por disciplina e 4 versões. Os professores convidados não pagam nada para participar.
          </p>
          <a href={PLANS.direcao.link} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-xl bg-brand-900 px-4 py-2.5 text-[14px] font-bold text-white">
            Assinar o plano Direção
          </a>
          <p className="mt-2 text-[12px] text-muted">Depois do pagamento, o seu plano é trocado e a Prova Multi é liberada.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-3">
            {(exams ?? []).length === 0 ? (
              <EmptyState title="Nenhuma Prova Multi ainda" text="Crie a primeira ao lado." />
            ) : (
              (exams ?? []).map((e) => {
                const slots = (e.multi_slots ?? []) as { id: string; submitted_at: string | null }[];
                const done = slots.filter((s) => s.submitted_at).length;
                return (
                  <Link key={e.id} href={`/prova-multi/${e.id}`} className="flex items-center gap-4 rounded-xl border border-line bg-white p-4 hover:border-brand-200">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                      <Layers size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-extrabold text-brand-900">{e.title}</p>
                      <p className="text-[13px] text-muted">
                        {[formatDateBR(e.applied_on), `${e.class_ids?.length ?? 0} turma(s)`, `${done}/${slots.length} professores enviaram`, e.status === "fechada" ? "gerada" : "recebendo questões"]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-muted" />
                  </Link>
                );
              })
            )}
          </div>
          <Card className="h-fit p-5">
            <h2 className="mb-4 text-[16px] font-bold text-brand-900">Nova Prova Multi</h2>
            <ActionForm action={createMultiExam} submitLabel="Criar e cadastrar os professores" submitClassName="w-full">
              <MultiExamFields schools={schools} classes={(classes ?? []) as { id: string; name: string; school_id: string | null }[]} />
            </ActionForm>
          </Card>
        </div>
      )}
    </>
  );
}
