import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Camera, ClipboardList, FileText, Gamepad2, GraduationCap, Library } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Dashboard" };

type Shortcut = { label: string; text: string; icon: typeof FileText; href?: string };

const SHORTCUTS: Shortcut[] = [
  { label: "Cadastrar turma e alunos", text: "O ponto de partida de tudo.", icon: GraduationCap, href: "/turmas" },
  { label: "Criar avaliação", text: "Editor de prova, gabarito e PDF A4.", icon: FileText },
  { label: "Montar prova com questões existentes", text: "A partir do seu banco de questões.", icon: Library },
  { label: "Corrigir gabaritos pela câmera", text: "Fotografe o cartão-resposta.", icon: Camera },
  { label: "Criar avaliação gamificada", text: "Quiz ao vivo com ranking.", icon: Gamepad2 },
  { label: "Ver resultados", text: "Médias, questões mais erradas.", icon: BarChart3 },
  { label: "Preparar Conselho de Classe", text: "Quem precisa ser mencionado.", icon: ClipboardList },
];

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
  const firstName = (profile?.full_name ?? "").split(" ")[0];

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
    { label: "Provas corrigidas", value: graded },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Menos burocracia. Mais tempo para ensinar."
        title={firstAccess ? "Bem-vindo ao Deixa que eu Corrijo" : `Olá${firstName ? `, ${firstName}` : ""}`}
        description={
          firstAccess
            ? "Comece cadastrando uma turma. Depois, a mesma informação alimenta provas, cartões-resposta, correção e o Conselho de Classe."
            : "Visão geral das suas turmas e avaliações."
        }
      />

      {!firstAccess && (
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="p-5">
              <p className="text-[13px] font-semibold text-muted">{s.label}</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums text-brand-900">{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {pending > 0 && (
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] text-amber-900">
          <strong>{pending}</strong> {pending === 1 ? "correção aguarda" : "correções aguardam"} sua revisão.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section>
          <h2 className="mb-3 text-[15px] font-bold text-brand-900">{firstAccess ? "Por onde começar" : "Atalhos"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {SHORTCUTS.map((s) => {
              const Icon = s.icon;
              const inner = (
                <>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${s.href ? "bg-brand-900 text-white" : "bg-brand-50 text-brand-700/60"}`}>
                    <Icon size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-bold text-brand-900">
                      {s.label}
                      {!s.href && (
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                          em breve
                        </span>
                      )}
                    </span>
                    <span className="block text-[13px] text-muted">{s.text}</span>
                  </span>
                </>
              );
              return s.href ? (
                <Link key={s.label} href={s.href} className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 transition hover:border-brand-200 hover:bg-brand-50/50">
                  {inner}
                  <ArrowRight size={17} className="text-brand-700" />
                </Link>
              ) : (
                <div key={s.label} className="flex items-center gap-3 rounded-xl border border-line bg-white/60 p-4" title="Funcionalidade futura — em desenvolvimento">
                  {inner}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-6">
          <Card>
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-bold text-brand-900">Últimas turmas</h2>
              <Link href="/turmas" className="text-[13px] font-semibold text-brand-700 hover:underline">Ver todas</Link>
            </div>
            {recentClasses?.length ? (
              <ul className="divide-y divide-line">
                {recentClasses.map((c) => {
                  const n = (c.students as unknown as { count: number }[])?.[0]?.count ?? 0;
                  return (
                    <li key={c.id}>
                      <Link href={`/turmas/${c.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-brand-50/50">
                        <span>
                          <span className="block font-semibold">{c.name}</span>
                          {c.subject && <span className="block text-[12px] text-muted">{c.subject}</span>}
                        </span>
                        <span className="text-[13px] text-muted">{n} alunos</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="p-5 text-sm text-muted">
                Nenhuma turma ainda.
                <Link href="/turmas" className={`${buttonClass()} mt-3 w-full`}>Criar primeira turma</Link>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-brand-900">Fluxo do Deixa que eu Corrijo</h2>
            <ol className="mt-3 space-y-2 text-[13px] text-muted">
              {["Criar a avaliação", "Gerar PDF e cartão-resposta", "Aplicar e fotografar os cartões", "Corrigir e calcular notas", "Analisar resultados", "Preparar o Conselho de Classe"].map(
                (step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="font-bold tabular-nums text-brand-700">{String(i + 1).padStart(2, "0")}</span>
                    {step}
                  </li>
                ),
              )}
            </ol>
          </Card>
        </aside>
      </div>
    </>
  );
}
