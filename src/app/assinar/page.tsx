import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { BrandBackground } from "@/components/billing/PlanCard";
import { AuthForm } from "@/app/login/AuthForm";
import { createClient } from "@/lib/supabase/server";
import { PLANS, isPlan } from "@/lib/billing/plans";

export const metadata: Metadata = { title: "Assinar" };

export default async function AssinarPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const { plano } = await searchParams;
  const plan = isPlan(plano) ? plano : "professor";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/assinatura");

  const p = PLANS[plan];
  return (
    <BrandBackground>
      <div className="mx-auto grid min-h-dvh max-w-5xl items-center gap-8 px-5 py-8 lg:grid-cols-2 lg:px-10">
        <section className="text-white">
          <span className="inline-flex rounded-2xl bg-white px-3 py-2 shadow-lg">
            <Logo height={38} />
          </span>
          <p className="mt-8 text-[14px] font-bold uppercase tracking-wide text-lime">Passo 1 de 2 · Criar sua conta</p>
          <h1 className="mt-2 text-[32px] font-extrabold leading-tight tracking-tight">
            Plano {p.name}
            <br />
            <span className="text-lime">{p.price}/mês</span>
          </h1>
          <p className="mt-3 max-w-sm text-[15px] text-brand-100/90">
            Crie a conta e, em seguida, faça o pagamento pela InfinitePay. Assim que o pagamento for confirmado, o app é liberado por 30 dias.
          </p>
          <div className="mt-5 flex gap-2 text-[13px] font-bold">
            {(["professor", "direcao"] as const).map((id) => (
              <Link
                key={id}
                href={`/assinar?plano=${id}`}
                className={`rounded-full px-3 py-1.5 ring-1 ${id === plan ? "bg-lime text-brand-900 ring-lime" : "text-white ring-white/30"}`}
              >
                {PLANS[id].name} · {PLANS[id].price}
              </Link>
            ))}
          </div>
        </section>
        <section className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
          <AuthForm key={plan} plan={plan} initialMode="criar" />
        </section>
      </div>
    </BrandBackground>
  );
}
