import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  Camera,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  Gamepad2,
  GraduationCap,
  Library,
  Users,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Dashboard" };

type Shortcut = { label: string; icon: LucideIcon; href?: string };

/** Botões da tela inicial. Sem href = funcionalidade futura (aparece "Em breve"). */
const SHORTCUTS: Shortcut[] = [
  { label: "Turmas", icon: GraduationCap, href: "/turmas" },
  { label: "Alunos", icon: Users, href: "/alunos" },
  { label: "Nova avaliação", icon: FilePlus2, href: "/avaliacoes/nova" },
  { label: "Corrigir pela câmera", icon: Camera, href: "/correcao" },
  { label: "Resultados", icon: BarChart3, href: "/resultados" },
  { label: "Banco de questões", icon: Library },
  { label: "Conselho de Classe", icon: ClipboardList },
  { label: "Modo gamificado", icon: Gamepad2 },
];

function AppButton({ s }: { s: Shortcut }) {
  const Icon = s.icon;
  const ready = Boolean(s.href);
  const body = (
    <>
      {!ready && (
        <span className="absolute right-2.5 top-2.5 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700/80">
          Em breve
        </span>
      )}
      <span
        className={`grid h-16 w-16 place-items-center rounded-[22px] shadow-sm transition ${
          ready
            ? "bg-linear-to-br from-brand-700 to-brand-900 text-white group-hover:shadow-md"
            : "bg-brand-50 text-brand-700/45"
        }`}
      >
        <Icon size={30} strokeWidth={1.9} />
      </span>
      <span className={`mt-3 text-center text-[14px] font-bold leading-tight ${ready ? "text-brand-900" : "text-muted/80"}`}>
        {s.label}
      </span>
    </>
  );
  const base =
    "group relative flex min-h-[156px] flex-col items-center justify-center rounded-3xl border bg-white px-3 pb-4 pt-9 select-none";
  return ready ? (
    <Link
      href={s.href!}
      className={`${base} border-line transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg active:scale-[0.97]`}
    >
      {body}
    </Link>
  ) : (
    <div className={`${base} border-line/70 bg-white/70`} title="Funcionalidade futura — em desenvolvimento" aria-disabled="true">
      {body}
    </div>
  );
}

async function count(table: string, filter?: (q: any) => any) {
  const supabase = await createClient();
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: n } = await q;
  return n ?? 0;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
  const firstName = (profile?.full_name ?? "").trim().split(" ")[0];

  const [classes, students, assessments, pending, graded] = await Promise.all([
    count("classes"),
    count("students"),
    count("assessments"),
    count("submissions", (q) => q.eq("status", "needs_review")),
    count("submissions", (q) => q.eq("status", "confirmed")),
  ]);
  const { data: recentClasses } = await supabase
    .from("classes")
    .select("id, name, subject, students(count)")
    .order("created_at", { ascending: false })
    .limit(5);

  const firstAccess = classes === 0;
  const stats = [
    { label: "Turmas", value: classes },
    { label: "Alunos", value: students },
    { label: "Avaliações", value: assessments },
    { label: "Corrigidas", value: graded },
  ];

  return (
    <>
      {/* Saudação */}
      <section className="mb-6 overflow-hidden rounded-3xl bg-brand-900 px-6 py-6 text-white sm:px-8 sm:py-7">
        <p className="text-[12px] font-bold uppercase tracking-wider text-lime">Menos burocracia. Mais tempo para ensinar.</p>
        <h1 className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-tight sm:text-3xl">
          {firstAccess ? "Bem-vindo ao Deixa que eu Corrijo" : `Olá${firstName ? `, ${firstName}` : ""}!`}
        </h1>
        <p className="mt-1.5 max-w-xl text-[14px] text-brand-100/85">
          {firstAccess
            ? "Comece cadastrando uma turma. A mesma informação alimenta provas, cartões-resposta, correção e o Conselho de Classe."
            : "O que vamos fazer hoje?"}
        </p>

        {!firstAccess && (
          <div className="mt-5 grid grid-cols-4 gap-2 sm:max-w-lg">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-white/8 px-3 py-2.5">
                <p className="text-2xl font-extrabold tabular-nums">{s.value}</p>
                <p className="text-[11px] font-semibold text-brand-100/75">{s.label}</p>
              </div>
            ))}
          </div>
        )}
        {firstAccess && (
          <Link href="/turmas" className={`${buttonClass("secondary")} mt-5 border-0`}>
            <GraduationCap size={18} /> Criar minha primeira turma
          </Link>
        )}
      </section>

      {pending > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] text-amber-900">
          <strong>{pending}</strong> {pending === 1 ? "correção aguarda" : "correções aguardam"} sua revisão.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* Botões estilo app */}
        <section>
          <h2 className="mb-3 text-[15px] font-bold text-brand-900">Acesso rápido</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SHORTCUTS.map((s) => (
              <AppButton key={s.label} s={s} />
            ))}
          </div>
        </section>

        <aside>
          <Card>
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-bold text-brand-900">Últimas turmas</h2>
              <Link href="/turmas" className="text-[13px] font-semibold text-brand-700 hover:underline">
                Ver todas
              </Link>
            </div>
            {recentClasses?.length ? (
              <ul className="divide-y divide-line">
                {recentClasses.map((c) => {
                  const n = (c.students as unknown as { count: number }[])?.[0]?.count ?? 0;
                  return (
                    <li key={c.id}>
                      <Link href={`/turmas/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-50/60 active:bg-brand-50">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-[13px] font-extrabold text-brand-900">
                          {c.name.slice(0, 3)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{c.name}</span>
                          <span className="block text-[12px] text-muted">
                            {[c.subject, `${n} ${n === 1 ? "aluno" : "alunos"}`].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <ChevronRight size={17} className="text-muted" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">Nenhuma turma ainda.</p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
