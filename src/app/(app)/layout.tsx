import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";
import { currentSchool } from "@/services/school-context";
import { loadAccess } from "@/services/access";
import { blockDate, brDate, canUseApp } from "@/lib/billing/plans";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await loadAccess(supabase, user.id);
  // liga os convites da Prova Multi feitos para o e-mail desta conta (pagante ou não)
  const { data: invitesCount } = await supabase.rpc("claim_invites");
  // Sem assinatura em dia → página de pagamento (o gestor sempre entra).
  if (!access.isAdmin && !canUseApp(access.state)) {
    // professor convidado da Prova Multi (sem assinatura): vai direto para as questões dele
    redirect(Number(invitesCount) > 0 ? "/colaborar" : "/assinatura");
  }
  // convites ainda não enviados → aviso no topo
  const { data: openInvites } =
    Number(invitesCount) > 0
      ? await supabase.from("multi_slots").select("id, discipline, multi_exams(title, status)").eq("teacher_id", user.id).is("submitted_at", null)
      : { data: [] as { id: string; discipline: string; multi_exams: unknown }[] };
  const pending = (openInvites ?? []).filter((s) => (s.multi_exams as { status?: string } | null)?.status === "aberta");

  const [{ data: profile }, { schools, current }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    currentSchool(supabase),
  ]);

  const paid = access.sub?.paid_until ?? null;
  const inviteBanner = pending.length ? (
    <Link
      href={pending.length === 1 ? `/colaborar/${pending[0].id}` : "/colaborar"}
      className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-lime px-4 py-3 text-[14px] text-brand-900 shadow-sm"
    >
      <span className="flex-1 font-semibold">
        A coordenação convidou você para a Prova Multi
        {pending.length === 1 ? ` (${pending[0].discipline} · ${(pending[0].multi_exams as { title?: string } | null)?.title ?? ""})` : ` (${pending.length} provas)`}.
      </span>
      <span className="rounded-lg bg-brand-900 px-3 py-1.5 text-[13px] font-bold text-white">Mandar as questões</span>
    </Link>
  ) : null;
  const banner =
    !access.isAdmin && paid && (access.state === "vencendo" || access.state === "atrasado") ? (
      <div
        className={`mb-6 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-[14px] ${
          access.state === "atrasado" ? "bg-red-50 text-red-900 ring-1 ring-red-200" : "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
        }`}
      >
        <AlertTriangle size={18} className="shrink-0" />
        <span className="flex-1">
          {access.state === "atrasado"
            ? `Sua mensalidade venceu em ${brDate(paid)}. O acesso será bloqueado em ${brDate(blockDate(paid))}.`
            : `Sua mensalidade vence em ${brDate(paid)}.`}
        </span>
        <Link href="/assinatura" className="rounded-lg bg-brand-900 px-3 py-1.5 text-[13px] font-bold text-white">
          Pagar agora
        </Link>
      </div>
    ) : null;

  return (
    <AppShell
      teacherName={profile?.full_name || user.email || ""}
      schools={schools}
      currentSchool={current?.id ?? ""}
      isAdmin={access.isAdmin}
      banner={
        <>
          {inviteBanner}
          {banner}
        </>
      }
    >
      {children}
    </AppShell>
  );
}
