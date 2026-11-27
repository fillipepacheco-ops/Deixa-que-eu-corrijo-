import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CreditCard, LogOut, PauseCircle } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { BrandBackground } from "@/components/billing/PlanCard";
import { createClient } from "@/lib/supabase/server";
import { loadAccess } from "@/services/access";
import { choosePlan } from "@/services/billing";
import { signOut } from "@/services/auth";
import { PLANS, STATE_LABEL, blockDate, brDate, canUseApp, type PlanId } from "@/lib/billing/plans";

export const metadata: Metadata = { title: "Assinatura" };

export default async function AssinaturaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const access = await loadAccess(supabase, user.id);
  const plan: PlanId = access.sub?.plan ?? "professor";
  const p = PLANS[plan];
  const ok = access.isAdmin || canUseApp(access.state);
  const paid = access.sub?.paid_until ?? null;

  const headline = {
    aguardando: "Falta só o pagamento",
    suspenso: "Seu acesso está suspenso",
    bloqueado: "Seu acesso está pausado",
    atrasado: "Sua mensalidade venceu",
    vencendo: "Sua mensalidade está vencendo",
    em_dia: "Tudo certo com a sua assinatura",
  }[access.state];

  const text = {
    aguardando: "Pague a primeira mensalidade pela InfinitePay. Assim que o pagamento for confirmado, o app é liberado por 30 dias.",
    suspenso: "Fale com o suporte para regularizar. Seus dados continuam guardados.",
    bloqueado: `A mensalidade venceu em ${brDate(paid)} e passou o prazo de 14 dias. Pague para voltar a usar — nada foi apagado.`,
    atrasado: `A mensalidade venceu em ${brDate(paid)}. Você pode usar até ${paid ? brDate(blockDate(paid)) : "—"}; depois o acesso é pausado.`,
    vencendo: `A mensalidade vence em ${brDate(paid)}. Renove para não perder o acesso.`,
    em_dia: `Pago até ${brDate(paid)}.`,
  }[access.state];

  return (
    <BrandBackground>
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-8">
        <div className="mb-5 flex items-center justify-between">
          <span className="inline-flex rounded-2xl bg-white px-3 py-2 shadow-lg">
            <Logo height={34} />
          </span>
          <form action={signOut}>
            <button className="flex items-center gap-1.5 text-[13px] font-semibold text-white/80 hover:text-white">
              <LogOut size={15} /> Sair
            </button>
          </form>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
          <div className="flex items-center gap-3">
            {ok ? <CheckCircle2 className="text-brand-500" size={28} /> : access.state === "suspenso" ? <PauseCircle className="text-red-600" size={28} /> : <CreditCard className="text-brand-700" size={28} />}
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-brand-700">
              {access.isAdmin ? "Gestor" : STATE_LABEL[access.state]}
            </span>
          </div>
          <h1 className="mt-4 text-[26px] font-extrabold leading-tight tracking-tight text-brand-900">{headline}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{text}</p>

          <div className="mt-6 rounded-2xl border border-line p-4">
            <p className="text-[13px] font-semibold text-muted">Seu plano</p>
            <p className="mt-0.5 flex items-baseline justify-between gap-3">
              <span className="text-[18px] font-extrabold text-brand-900">{p.name}</span>
              <span className="text-[18px] font-extrabold text-brand-900">
                {p.price}
                <span className="text-[13px] font-semibold text-muted">/mês</span>
              </span>
            </p>
            {access.state === "aguardando" && (
              <form action={choosePlan.bind(null, plan === "professor" ? "direcao" : "professor")} className="mt-2">
                <button className="text-[13px] font-bold text-brand-700 underline underline-offset-4">
                  Trocar para o plano {PLANS[plan === "professor" ? "direcao" : "professor"].name} ({PLANS[plan === "professor" ? "direcao" : "professor"].price})
                </button>
              </form>
            )}
          </div>

          {access.state !== "suspenso" && (
            <a
              href={p.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-brand-900 px-4 py-3.5 text-[16px] font-extrabold text-white hover:bg-brand-800"
            >
              <CreditCard size={19} /> {ok && access.state === "em_dia" ? "Adiantar a próxima mensalidade" : `Pagar ${p.price} pela InfinitePay`}
            </a>
          )}

          <ol className="mt-5 space-y-1.5 text-[14px] text-muted">
            <li>1. Pague pelo botão acima (Pix ou cartão).</li>
            <li>
              2. Use o mesmo nome e e-mail da sua conta: <b className="text-ink">{user.email}</b>.
            </li>
            <li>3. Após a confirmação do pagamento, o acesso é liberado por 30 dias.</li>
          </ol>

          {ok && (
            <Link href="/dashboard" className="mt-6 block rounded-xl bg-brand-50 px-4 py-3 text-center text-[15px] font-bold text-brand-900 hover:bg-brand-100">
              Ir para o app
            </Link>
          )}
        </div>
      </div>
    </BrandBackground>
  );
}
