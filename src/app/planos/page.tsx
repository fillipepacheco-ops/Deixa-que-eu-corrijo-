import type { Metadata } from "next";
import Link from "next/link";
import { Camera, Clock, FileText, Gamepad2, ScanLine, School, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { BrandBackground, PlanCard } from "@/components/billing/PlanCard";

export const metadata: Metadata = { title: "Planos" };

const STEPS = [
  { icon: FileText, title: "Monte a prova", text: "Digite, importe de PDF/Word ou reaproveite. Sai pronta com a logo da escola." },
  { icon: ScanLine, title: "Imprima o cartão", text: "Cada aluno recebe o seu cartão-resposta com código próprio." },
  { icon: Camera, title: "Corrija pela câmera", text: "Aponte o celular: a nota aparece na hora, sem planilha." },
  { icon: Gamepad2, title: "Jogue em sala", text: "A mesma prova vira um jogo ao vivo no projetor." },
];

const FAQ = [
  { q: "Como funciona o pagamento?", a: "É uma mensalidade pela InfinitePay (Pix ou cartão). Cada pagamento libera 30 dias de uso." },
  { q: "E se eu atrasar?", a: "Você continua usando por mais 14 dias depois do vencimento. Passado esse prazo, o acesso fica pausado até o pagamento — seus dados continuam guardados." },
  { q: "Posso cancelar?", a: "Pode. É só não renovar. Não há fidelidade nem multa." },
  { q: "Trabalho em mais de uma escola. Funciona?", a: "Sim. Cada escola tem a sua logo e as suas turmas, e você troca de escola no topo da tela." },
];

export default function PlanosPage() {
  return (
    <BrandBackground>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 lg:px-10">
        <span className="inline-flex rounded-2xl bg-white px-3 py-2 shadow-lg">
          <Logo height={34} />
        </span>
        <Link href="/login" className="rounded-xl bg-white/10 px-4 py-2 text-[14px] font-bold text-white ring-1 ring-white/20 hover:bg-white/15">
          Já sou assinante
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-10 pt-6 text-center text-white lg:px-10">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold ring-1 ring-white/15">
          <Clock size={14} className="text-lime" /> Feito por professor, para professor
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-[34px] font-extrabold leading-[1.1] tracking-tight sm:text-[50px]">
          Corrija uma turma inteira <span className="text-lime">no tempo de um café.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-brand-100/90">
          Prova, cartão-resposta, correção pela câmera, notas para o diário e jogo em sala. Tudo num lugar só, por menos de 33 centavos por dia.
        </p>
      </section>

      <section className="mx-auto grid max-w-4xl gap-6 px-5 pb-14 md:grid-cols-2 lg:px-0">
        <PlanCard id="professor" highlight />
        <PlanCard id="direcao" />
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-14 lg:px-10">
          <h2 className="text-center text-[26px] font-extrabold tracking-tight text-brand-900">Como funciona</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="rounded-2xl border border-line p-5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-lime text-brand-900">
                  <Icon size={21} />
                </span>
                <p className="mt-4 text-[13px] font-bold text-brand-700">Passo {i + 1}</p>
                <p className="text-[17px] font-extrabold text-brand-900">{title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              { icon: School, t: "Várias escolas, cada uma com sua logo" },
              { icon: ShieldCheck, t: "Seus dados só seus, protegidos" },
              { icon: Clock, t: "Notas por bimestre prontas para o diário" },
            ].map(({ icon: Icon, t }) => (
              <p key={t} className="flex items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-[14px] font-semibold text-brand-900">
                <Icon size={18} className="shrink-0 text-brand-700" /> {t}
              </p>
            ))}
          </div>

          <h2 className="mt-14 text-center text-[26px] font-extrabold tracking-tight text-brand-900">Dúvidas frequentes</h2>
          <div className="mx-auto mt-6 max-w-3xl space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="rounded-2xl border border-line px-5 py-4">
                <summary className="cursor-pointer text-[15px] font-bold text-brand-900">{f.q}</summary>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link href="/assinar?plano=professor" className="inline-block rounded-xl bg-brand-900 px-6 py-3.5 text-[16px] font-extrabold text-white hover:bg-brand-800">
              Começar agora por R$ 9,90/mês
            </Link>
          </div>
        </div>
      </section>
    </BrandBackground>
  );
}
