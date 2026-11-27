import type { Metadata } from "next";
import Link from "next/link";
import { Camera, FileText, Gamepad2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { AuthForm } from "./AuthForm";
import { RoleChooser } from "./RoleChooser";

export const metadata: Metadata = { title: "Entrar" };

const FEATURES = [
  { icon: FileText, text: "Prova pronta em PDF e Word" },
  { icon: Camera, text: "Correção pela câmera do celular" },
  { icon: Gamepad2, text: "Modo game ao vivo na sala" },
  { icon: ShieldCheck, text: "Dados protegidos e só seus" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; perfil?: string }> }) {
  const { erro, perfil } = await searchParams;
  return (
    <main className="relative min-h-dvh overflow-hidden bg-brand-900">
      {/* fundo com a identidade do app */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,#1f9d55_0%,transparent_45%),radial-gradient(circle_at_95%_90%,#7cc520_0%,transparent_40%)] opacity-50" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:repeating-linear-gradient(0deg,#fff_0,#fff_1px,transparent_1px,transparent_32px)]" />

      <div className="relative mx-auto grid min-h-dvh max-w-6xl items-center gap-8 px-5 py-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:px-10">
        {/* apresentação */}
        <section className="text-white">
          <div className="inline-flex rounded-2xl bg-white px-4 py-3 shadow-xl">
            <Logo height={46} />
          </div>
          <h1 className="mt-7 text-[34px] font-extrabold leading-[1.1] tracking-tight sm:text-[46px]">
            Menos burocracia.
            <br />
            <span className="text-lime">Mais tempo para ensinar.</span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-brand-100/90">
            Você cria a avaliação uma vez. O app cuida da prova, do cartão-resposta, da correção pela câmera, das notas para o diário e do jogo em sala.
          </p>
          <ul className="mt-6 hidden grid-cols-2 gap-3 sm:grid">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 rounded-2xl bg-white/8 px-3 py-3 text-[14px] font-semibold ring-1 ring-white/10">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-lime text-brand-900">
                  <Icon size={18} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </section>

        {/* acesso */}
        <section className="w-full">
          <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            {erro === "link" && (
              <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                O link de confirmação expirou ou já foi usado. Entre com seu e-mail e senha.
              </p>
            )}
            <RoleChooser initial={perfil === "aluno" ? "aluno" : "professor"}>
              <AuthForm />
            </RoleChooser>
          </div>
          <p className="mt-5 text-center text-[14px] text-white/85">
            Ainda não é assinante?{" "}
            <Link href="/planos" className="font-bold text-lime underline underline-offset-4">
              Conheça os planos
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
