import type { Metadata } from "next";
import { Logo } from "@/components/brand/Logo";
import { AuthForm } from "./AuthForm";
import { RoleChooser } from "./RoleChooser";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; perfil?: string }> }) {
  const { erro, perfil } = await searchParams;
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo onDark height={52} />
        <div className="max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Menos burocracia.
            <br />
            <span className="text-lime">Mais tempo para ensinar.</span>
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-brand-100/90">
            Você cria a avaliação uma vez. O sistema cuida do PDF, do cartão-resposta, da correção pela câmera,
            dos resultados e do Conselho de Classe.
          </p>
        </div>
        <ol className="grid grid-cols-3 gap-3 text-[13px] text-brand-100/80">
          {["Crie a prova", "Fotografe os cartões", "Analise os resultados"].map((s, i) => (
            <li key={s} className="border-t border-white/15 pt-3">
              <span className="block font-bold text-lime">0{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo height={56} />
          </div>
          {erro === "link" && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              O link de confirmação expirou ou já foi usado. Entre com seu e-mail e senha.
            </p>
          )}
          <RoleChooser initial={perfil === "aluno" ? "aluno" : "professor"}>
            <AuthForm />
          </RoleChooser>
        </div>
      </section>
    </main>
  );
}
