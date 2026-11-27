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
  // Sem assinatura em dia → página de pagamento (o gestor sempre entra).
  if (!access.isAdmin && !canUseApp(access.state)) redirect("/assinatura");

  const [{ data: profile }, { schools, current }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    currentSchool(supabase),
  ]);

  const paid = access.sub?.paid_until ?? null;
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
      banner={banner}
    >
      {children}
    </AppShell>
  );
}
