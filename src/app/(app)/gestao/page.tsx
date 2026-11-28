import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveRestore, Search, Trash2, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadAccess } from "@/services/access";
import { adminChangePlan, adminDeleteUser, adminPurgeUser, adminRestoreUser, adminSetPaidUntil, adminSubscription } from "@/services/billing";
import { Card, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { buttonClass } from "@/components/ui/button";
import {
  PLANS,
  STATE_LABEL,
  accessState,
  blockDate,
  brDate,
  daysBetween,
  todayISO,
  type AccessState,
  type Subscription,
} from "@/lib/billing/plans";

export const metadata: Metadata = { title: "Gestão" };

const FILTERS: { id: "todos" | "lixeira" | AccessState; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "em_dia", label: "Em dia" },
  { id: "vencendo", label: "Vencendo" },
  { id: "atrasado", label: "Atrasados" },
  { id: "bloqueado", label: "Bloqueados" },
  { id: "suspenso", label: "Suspensos" },
  { id: "aguardando", label: "Aguardando" },
  { id: "lixeira", label: "Lixeira" },
];
const TRASH_DAYS = 30;

const BADGE: Record<AccessState, string> = {
  em_dia: "bg-brand-50 text-brand-700",
  vencendo: "bg-amber-50 text-amber-800",
  atrasado: "bg-orange-50 text-orange-800",
  bloqueado: "bg-red-50 text-red-800",
  suspenso: "bg-zinc-100 text-zinc-700",
  aguardando: "bg-sky-50 text-sky-800",
};

const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function GestaoPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const access = await loadAccess(supabase, user.id);
  if (!access.isAdmin) notFound(); // só a conta do gestor

  const { f = "todos", q = "" } = await searchParams;
  // contas na lixeira há mais de 30 dias são apagadas de vez
  await supabase.rpc("admin_purge_trash");
  const [{ data, error }, { data: changes }] = await Promise.all([
    supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
    supabase.from("subscription_changes").select("user_id, action, at").eq("undone", false).order("at", { ascending: false }),
  ]);
  const lastChange = new Map<string, { action: string; at: string }>();
  for (const c of changes ?? []) if (!lastChange.has(c.user_id)) lastChange.set(c.user_id, c);
  const ACTION_NAME: Record<string, string> = { pagou: "+30 dias", suspender: "suspensão", reativar: "reativação", plano: "troca de plano", data: "mudança de vencimento" };
  const today = todayISO();
  const all = ((data ?? []) as Subscription[]).filter((s) => s.user_id !== user.id).map((s) => ({ ...s, state: accessState(s, today) }));
  const trash = all.filter((s) => s.deleted_at);
  const rows = all.filter((s) => !s.deleted_at);

  const count = (id: string) => (id === "lixeira" ? trash.length : id === "todos" ? rows.length : rows.filter((r) => r.state === id).length);
  const term = q.trim().toLowerCase();
  const shown = (f === "lixeira" ? trash : rows)
    .filter((r) => f === "todos" || f === "lixeira" || r.state === f)
    .filter((r) => !term || `${r.full_name ?? ""} ${r.email ?? ""}`.toLowerCase().includes(term));

  const paying = rows.filter((r) => r.state === "em_dia" || r.state === "vencendo" || r.state === "atrasado");
  const mrr = paying.reduce((sum, r) => sum + PLANS[r.plan].cents, 0);

  return (
    <>
      <PageHeader
        eyebrow="Só você vê esta aba"
        title="Gestão de assinantes"
        description="Confirme os pagamentos que chegaram na InfinitePay. Cada confirmação libera mais 30 dias. Quem passa 14 dias do vencimento é bloqueado sozinho."
      />
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Rode a migração 0010_assinaturas.sql no Supabase. ({error.message})</p>}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[13px] font-semibold text-muted">Assinantes ativos</p>
          <p className="text-[28px] font-extrabold text-brand-900">{paying.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] font-semibold text-muted">Receita mensal</p>
          <p className="text-[28px] font-extrabold text-brand-900">{money(mrr)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] font-semibold text-muted">Precisam de atenção</p>
          <p className="text-[28px] font-extrabold text-red-700">{count("atrasado") + count("bloqueado") + rows.filter((r) => r.state === "aguardando" && !r.guest).length}</p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <Link
            key={x.id}
            href={`/gestao?f=${x.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full px-3 py-1.5 text-[13px] font-bold ${f === x.id ? "bg-brand-900 text-white" : "bg-white text-brand-900 ring-1 ring-line"}`}
          >
            {x.label} <span className="opacity-60">{count(x.id)}</span>
          </Link>
        ))}
      </div>
      <form className="mb-5 flex gap-2" action="/gestao">
        <input type="hidden" name="f" value={f} />
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="field pl-9" name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail" />
        </div>
        <button className={buttonClass("secondary")}>Buscar</button>
      </form>

      {shown.length === 0 ? (
        <EmptyState title="Ninguém aqui" text="Nenhum assinante neste filtro." />
      ) : (
        <div className="space-y-3">
          {shown.map((r) => {
            const left = r.paid_until ? daysBetween(today, r.paid_until) : null;
            if (r.deleted_at) {
              const since = r.deleted_at.slice(0, 10);
              const remaining = Math.max(0, TRASH_DAYS - daysBetween(since, today));
              return (
                <Card key={r.user_id} className="border-dashed bg-gray-50 p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-extrabold text-gray-600">{r.full_name || "(sem nome)"}</p>
                      <p className="truncate text-[13px] text-muted">{r.email}</p>
                    </div>
                    <span className="rounded-full bg-gray-200 px-2.5 py-1 text-[12px] font-bold text-gray-700">Na lixeira</span>
                  </div>
                  <p className="mt-2 text-[13px] text-muted">
                    Desde {brDate(since)} · apagada de vez em <b className="text-ink">{remaining} {remaining === 1 ? "dia" : "dias"}</b>. Até lá, turmas, provas,
                    notas e arquivos continuam guardados, e a pessoa não consegue entrar.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={adminRestoreUser.bind(null, r.user_id)}>
                      <button className={buttonClass("primary")}>
                        <ArchiveRestore size={16} /> Restaurar conta
                      </button>
                    </form>
                    <ConfirmButton
                      action={adminPurgeUser.bind(null, r.user_id)}
                      message={`Apagar DE VEZ a conta de ${r.full_name || r.email}? Turmas, provas, notas e arquivos serão perdidos para sempre e não dá para desfazer.`}
                    >
                      <Trash2 size={15} /> Apagar de vez agora
                    </ConfirmButton>
                  </div>
                </Card>
              );
            }
            return (
              <Card key={r.user_id} className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-extrabold text-brand-900">{r.full_name || "(sem nome)"}</p>
                    <p className="truncate text-[13px] text-muted">{r.email}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${BADGE[r.state]}`}>
                    {r.state === "aguardando" && r.guest ? "Convidado · Prova Multi" : STATE_LABEL[r.state]}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                  <form action={adminChangePlan.bind(null, r.user_id)} className="flex items-center gap-1.5">
                    <select name="plan" defaultValue={r.plan} className="rounded-md border border-line bg-white px-1.5 py-1 text-[13px] font-semibold text-ink">
                      <option value="professor">Professor · {PLANS.professor.price}</option>
                      <option value="direcao">Direção · {PLANS.direcao.price}</option>
                    </select>
                    <button className="font-bold text-brand-700">ok</button>
                  </form>
                  <span>
                    Pago até <b className="text-ink">{brDate(r.paid_until)}</b>
                    {left !== null && left >= 0 && ` (faltam ${left} dias)`}
                    {left !== null && left < 0 && r.paid_until && ` (bloqueio em ${brDate(blockDate(r.paid_until))})`}
                  </span>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[13px] font-bold text-brand-700">Mudar o vencimento</summary>
                  <form action={adminSetPaidUntil.bind(null, r.user_id)} className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="date" name="paid_until" defaultValue={r.paid_until ?? ""} className="field w-auto! py-1.5!" required />
                    <button className={buttonClass("secondary")}>Salvar data</button>
                  </form>
                </details>
                {lastChange.get(r.user_id) && (
                  <p className="mt-1 text-[12px] text-muted">
                    Último lançamento: {ACTION_NAME[lastChange.get(r.user_id)!.action] ?? lastChange.get(r.user_id)!.action} em{" "}
                    {new Date(lastChange.get(r.user_id)!.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={adminSubscription.bind(null, r.user_id, "pagou", undefined)}>
                    <button className={buttonClass("primary")}>Confirmar pagamento (+30 dias)</button>
                  </form>
                  {r.status === "suspended" ? (
                    <form action={adminSubscription.bind(null, r.user_id, "reativar", undefined)}>
                      <button className={buttonClass("secondary")}>Reativar</button>
                    </form>
                  ) : (
                    <ConfirmButton
                      variant="secondary"
                      action={adminSubscription.bind(null, r.user_id, "suspender", undefined)}
                      message={`Suspender o acesso de ${r.full_name || r.email}?`}
                    >
                      Suspender
                    </ConfirmButton>
                  )}
                  <ConfirmButton
                    variant="secondary"
                    action={adminSubscription.bind(null, r.user_id, "desfazer", undefined)}
                    message={
                      lastChange.get(r.user_id)
                        ? `Desfazer o último lançamento de ${r.full_name || r.email} (${ACTION_NAME[lastChange.get(r.user_id)!.action] ?? lastChange.get(r.user_id)!.action})? Volta exatamente como estava antes.`
                        : `Desfazer um "+30 dias" de ${r.full_name || r.email}? O vencimento volta 30 dias (${brDate(r.paid_until)} → 30 dias antes).`
                    }
                  >
                    <Undo2 size={15} /> Desfazer
                  </ConfirmButton>
                  <ConfirmButton
                    action={adminDeleteUser.bind(null, r.user_id)}
                    message={`Tem certeza que você deseja excluir ${r.full_name || r.email}? A conta vai para a lixeira: a pessoa não consegue mais entrar, mas turmas, provas, notas e arquivos ficam guardados por ${TRASH_DAYS} dias. Até lá, dá para restaurar tudo; depois disso, é apagada automaticamente.`}
                  >
                    <Trash2 size={15} /> Excluir
                  </ConfirmButton>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
