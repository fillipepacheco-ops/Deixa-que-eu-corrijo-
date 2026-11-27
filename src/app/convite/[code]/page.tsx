import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { BrandBackground } from "@/components/billing/PlanCard";
import { AuthForm } from "@/app/login/AuthForm";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/services/auth";

export const metadata: Metadata = { title: "Convite — Prova Multi" };

type Info = { teacher_name: string; discipline: string; email: string; question_count: number; title: string; school: string | null; coordinator: string | null; status: string; has_account?: boolean };

export default async function ConvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_info", { p_code: code.slice(0, 40) });
  const info = ((data ?? []) as Info[])[0];
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (info && user && user.email?.toLowerCase() === info.email.toLowerCase()) {
    await supabase.rpc("claim_invites");
    redirect("/colaborar");
  }

  return (
    <BrandBackground>
      <div className="mx-auto grid min-h-dvh max-w-5xl items-center gap-8 px-5 py-8 lg:grid-cols-2 lg:px-10">
        <section className="text-white">
          <span className="inline-flex rounded-2xl bg-white px-3 py-2 shadow-lg">
            <Logo height={38} />
          </span>
          {info ? (
            <>
              <p className="mt-8 text-[14px] font-bold uppercase tracking-wide text-lime">Convite · Prova Multi</p>
              <h1 className="mt-2 text-[30px] font-extrabold leading-tight tracking-tight">Olá, {info.teacher_name}!</h1>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-brand-100/90">
                {info.coordinator ? `${info.coordinator} convidou` : "A coordenação convidou"} você para enviar{" "}
                <b className="text-white">
                  {info.question_count} {info.question_count === 1 ? "questão" : "questões"} de {info.discipline}
                </b>{" "}
                para a prova <b className="text-white">{info.title}</b>
                {info.school ? ` da ${info.school}` : ""}.
              </p>
              <p className="mt-3 max-w-md text-[14px] text-brand-100/80">É gratuito para você. Você só vai ver esta prova.</p>
            </>
          ) : (
            <h1 className="mt-8 text-[28px] font-extrabold">Convite não encontrado</h1>
          )}
        </section>
        <section className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
          {!info ? (
            <p className="text-[15px] text-muted">
              O link pode estar incompleto ou o convite foi removido. Peça um novo link à coordenação.
            </p>
          ) : user ? (
            <div>
              <p className="text-[15px] text-ink">
                Você está conectado(a) como <b>{user.email}</b>, mas o convite é para <b>{info.email}</b>.
              </p>
              <form action={signOut} className="mt-4">
                <button className="w-full rounded-xl bg-brand-900 px-4 py-3 text-[15px] font-bold text-white">Sair e entrar com {info.email}</button>
              </form>
            </div>
          ) : (
            <>
              <p className="mb-4 rounded-xl bg-brand-50 px-3 py-2 text-[13px] text-brand-900">
                {info.has_account
                  ? `Você já tem conta no app com ${info.email}: é só entrar com a sua senha de sempre.`
                  : `Crie a sua conta com o e-mail ${info.email}. É gratuito para participar desta prova.`}
              </p>
              <AuthForm initialMode={info.has_account ? "entrar" : "criar"} lockedEmail={info.email} next="/colaborar" />
              <p className="mt-4 text-center text-[12px] text-muted">
                Se pedir confirmação, abra o link que chegou no seu e-mail e depois volte a este convite.{" "}
                <Link href="/login" className="font-semibold text-brand-700 underline">
                  Ir para o login
                </Link>
              </p>
            </>
          )}
        </section>
      </div>
    </BrandBackground>
  );
}
