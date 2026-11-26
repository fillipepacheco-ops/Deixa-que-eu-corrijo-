import type { Metadata } from "next";
import Link from "next/link";
import { Gamepad2, MonitorPlay, ShieldAlert, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { buttonClass } from "@/components/ui/button";
import { createGameFromForm, deleteGame } from "@/services/games";

export const metadata: Metadata = { title: "Modo game" };

const STATUS: Record<string, string> = {
  lobby: "Esperando equipes",
  question: "Em andamento",
  reveal: "Em andamento",
  ranking: "Em andamento",
  finished: "Encerrado",
};

interface AssessmentRow {
  id: string;
  title: string;
  classes: { name: string } | null;
  assessment_questions: { type: string; correct_answers: string[]; annulled: boolean }[];
}

export default async function JogosPage({ searchParams }: { searchParams: Promise<{ avaliacao?: string }> }) {
  const { avaliacao } = await searchParams;
  const supabase = await createClient();
  const [{ data: list }, games] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, title, classes(name), assessment_questions(type, correct_answers, annulled)")
      .order("created_at", { ascending: false }),
    supabase.from("games").select("id, title, pin, status, team_size, question_count, created_at, game_players(count)").order("created_at", { ascending: false }).limit(30),
  ]);
  const assessments = ((list ?? []) as unknown as AssessmentRow[]).map((a) => ({
    ...a,
    playable: a.assessment_questions.filter((q) => ["multiple_choice", "true_false", "numeric"].includes(q.type) && !q.annulled && q.correct_answers?.length).length,
  }));
  const ready = !games.error;
  const rows = (games.data ?? []) as unknown as {
    id: string;
    title: string;
    pin: string;
    status: string;
    team_size: number;
    question_count: number;
    created_at: string;
    game_players: { count: number }[];
  }[];

  return (
    <>
      <PageHeader
        title="Modo game"
        description="Jogo ao vivo em sala: as questões aparecem no telão e no celular dos alunos, o tempo corre igual para todos e quem responde certo mais rápido ganha mais pontos."
      />

      {!ready && (
        <p className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          Para usar o modo game, rode a atualização <strong>0006</strong> do banco no Supabase.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-[18px] font-extrabold text-brand-900">
            <Gamepad2 size={22} className="text-brand-700" /> Novo jogo
          </h2>
          {assessments.length === 0 ? (
            <EmptyState title="Nenhuma avaliação ainda" text="O jogo usa as questões de uma avaliação. Crie uma primeiro." />
          ) : (
            <ActionForm action={createGameFromForm} submitLabel="Abrir o telão do jogo" submitClassName="w-full sm:w-auto" className="space-y-5">
              <div>
                <label className="label" htmlFor="assessment_id">
                  Avaliação
                </label>
                <select className="field" id="assessment_id" name="assessment_id" defaultValue={avaliacao ?? ""} required>
                  <option value="" disabled>
                    Escolha a avaliação…
                  </option>
                  {assessments.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.playable === 0}>
                      {a.title}
                      {a.classes?.name ? ` · ${a.classes.name}` : ""} — {a.playable ? `${a.playable} questões no jogo` : "sem questões com gabarito"}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[12px] text-muted">Entram as questões de múltipla escolha, certo/errado e Tipo B que têm resposta no gabarito.</p>
              </div>

              <fieldset>
                <legend className="label">Como os alunos jogam</legend>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    [1, "Individual", "1 celular por aluno"],
                    [2, "Duplas", "1 celular por dupla"],
                    [3, "Trios", "1 celular por trio"],
                  ].map(([v, t, d]) => (
                    <label key={v} className="cursor-pointer rounded-xl border border-line p-3 text-center has-checked:border-brand-500 has-checked:bg-brand-50">
                      <input type="radio" name="team_size" value={v} defaultChecked={v === 1} className="sr-only" />
                      <span className="block font-extrabold text-brand-900">{t}</span>
                      <span className="block text-[12px] text-muted">{d}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label className="label" htmlFor="time_limit">
                  Tempo por questão
                </label>
                <select className="field" id="time_limit" name="time_limit" defaultValue="30">
                  {[10, 20, 30, 45, 60, 90, 120, 180].map((s) => (
                    <option key={s} value={s}>
                      {s < 60 ? `${s} segundos` : `${s / 60} minuto${s >= 120 ? "s" : ""}`}
                    </option>
                  ))}
                </select>
              </div>
            </ActionForm>
          )}
        </Card>

        <aside className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-2 flex items-center gap-2 font-extrabold text-brand-900">
              <ShieldAlert size={19} className="text-brand-700" /> Para o aluno não consultar a internet
            </h3>
            <ul className="space-y-2 text-[13px] text-ink">
              <li>• Se o aluno sair da tela do jogo (outra aba, outro app, tela apagada), a equipe dele é <strong>bloqueada na hora</strong> e aparece em amarelo no telão. Só volta a responder quando você tocar em “liberar”.</li>
              <li>
                • Nenhum site consegue travar o celular sozinho. Para travar de verdade, peça para ativar antes do jogo: no iPhone/iPad,{" "}
                <strong>Acesso Guiado</strong> (Ajustes › Acessibilidade); no Android, <strong>Fixar app/tela</strong> (Ajustes › Segurança).
              </li>
            </ul>
          </Card>
          <Card className="p-5 text-[13px] text-ink">
            <p className="font-extrabold text-brand-900">Como funciona</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4">
              <li>Abra o telão no data show.</li>
              <li>Os alunos entram em <strong>/jogar</strong> e digitam o PIN.</li>
              <li>A cada questão: tempo correndo, números subindo ao vivo, gráfico de acertos e erros e ranking.</li>
            </ol>
          </Card>
        </aside>
      </div>

      {rows.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2.5 text-[15px] font-extrabold text-brand-900">Jogos</h2>
          <Card className="divide-y divide-line">
            {rows.map((g) => (
              <div key={g.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-brand-900">{g.title}</p>
                  <p className="text-[13px] text-muted">
                    PIN {g.pin} · {STATUS[g.status] ?? g.status} · {g.game_players?.[0]?.count ?? 0} equipe(s) · {g.question_count} questões ·{" "}
                    {new Date(g.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Link href={`/jogo/${g.id}`} className={buttonClass("secondary")}>
                  <MonitorPlay size={17} /> {g.status === "finished" ? "Ver pódio" : "Abrir telão"}
                </Link>
                <ConfirmButton action={deleteGame.bind(null, g.id)} message={`Apagar o jogo "${g.title}" (PIN ${g.pin})?`}>
                  <Trash2 size={16} />
                </ConfirmButton>
              </div>
            ))}
          </Card>
        </section>
      )}
    </>
  );
}
