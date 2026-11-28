import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, Eye, FileUp, Gamepad2, Library, Plus, Trash2 } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { loadAssessment, loadStudents, questionImageUrls, schoolLogoUrl } from "@/services/assessment-data";
import {
  addQuestion,
  applyToClasses,
  deleteAssessment,
  deleteQuestion,
  duplicateQuestion,
  moveQuestion,
  saveQuestion,
  setVersions,
  updateAssessment,
} from "@/services/assessments";
import { VERSION_LETTERS } from "@/lib/versions/versions";
import { Card, PageHeader } from "@/components/ui/PageHeader";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { HeaderFields } from "@/components/assessments/HeaderFields";
import { QuestionEditor } from "@/components/assessments/QuestionEditor";
import { PrintPanel } from "@/components/assessments/PrintPanel";
import { fileSlug, formatDateBR } from "@/lib/assessment/header";
import { QUESTION_TYPE_NAMES } from "@/lib/assessment/question-form";
import type { QuestionType } from "@/lib/models/types";

export const metadata: Metadata = { title: "Avaliação" };

const ADD_TYPES: QuestionType[] = ["multiple_choice", "true_false", "numeric", "lined", "short_answer", "essay"];


export default async function AvaliacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const data = await loadAssessment(supabase, id);
  if (!data) notFound();
  const { row, assessment, questions } = data;
  const [{ data: classes }, students, logoUrl, imageUrls] = await Promise.all([
    supabase.from("classes").select("id, name").order("name"),
    loadStudents(supabase, row.class_id),
    schoolLogoUrl(supabase, row.school_logo_path),
    questionImageUrls(supabase, questions),
  ]);

  const objective = questions.filter((q) => q.type === "multiple_choice" || q.type === "true_false");
  const slug = fileSlug(assessment.title);

  return (
    <>
      <Link href="/avaliacoes" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft size={16} /> Avaliações
      </Link>
      <PageHeader
        eyebrow="Larga escala · 2 colunas · Arial 12 · justificado · espaçamento 1,5"
        title={assessment.title}
        actions={
          <>
            <Link href={`/avaliacoes/${id}/ver`} className={buttonClass()}>
              <Eye size={18} /> Ver prova
            </Link>
            <Link href={`/resultados/${id}`} className={buttonClass("secondary")}>
              <BarChart3 size={18} /> Notas
            </Link>
            <Link href={`/jogos?avaliacao=${id}`} className={buttonClass("secondary")}>
              <Gamepad2 size={18} /> Jogar ao vivo
            </Link>
          </>
        }
        description={[assessment.subject, assessment.class_name, formatDateBR(assessment.applied_on), `${questions.length} ${questions.length === 1 ? "questão" : "questões"}`]
          .filter(Boolean)
          .join(" · ")}
      />

      {/* Impressão: turma toda ou um aluno (prova, cartão ou os dois juntos) */}
      <PrintPanel
        assessmentId={id}
        slug={slug}
        students={students}
        className={assessment.class_name ?? null}
        hasQuestions={questions.length > 0}
        hasObjective={objective.length > 0}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <Card className="mb-6 p-5">
            <details>
              <summary className="cursor-pointer font-bold text-brand-900">Editar cabeçalho e instruções</summary>
              <p className="mt-2 text-[13px] text-muted">Os mesmos dados saem na capa da prova e nos cartões-resposta.</p>
              <div className="mt-4">
                <ActionForm action={updateAssessment.bind(null, id)} submitLabel="Salvar cabeçalho" successText="Cabeçalho atualizado.">
                  <HeaderFields classes={classes ?? []} value={{ ...row, max_score: Number(row.max_score) }} logoUrl={logoUrl} />
                </ActionForm>
              </div>
            </details>
          </Card>
          {/* Versões A–D com as questões em ordem diferente */}
          <Card className="mb-6 p-5">
            <details open={(assessment.versions ?? 1) > 1}>
              <summary className="cursor-pointer font-bold text-brand-900">
                Tipos de prova (versões) {(assessment.versions ?? 1) > 1 ? `· ${VERSION_LETTERS.slice(0, assessment.versions).join(", ")}` : "· só um tipo"}
              </summary>
              <p className="mt-2 text-[13px] text-muted">
                Mesma prova com as questões em ordem diferente, para evitar cola. A capa de cada prova mostra a letra da versão e o cartão-resposta tem o
                campo VERSÃO DA PROVA: o aluno pinta a letra que está na capa e a câmera corrige pelo gabarito daquela versão. Assim dá para tirar xerox:
                baixe uma prova em branco de cada versão (botões abaixo), copie e distribua misturado. As provas com nome saem alternando A, B, C, D pela
                ordem de chamada. As questões só trocam de lugar dentro da mesma disciplina e do mesmo tipo.
              </p>
              <ActionForm action={setVersions.bind(null, id)} submitLabel="Salvar versões" className="mt-3">
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <label key={n} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 has-checked:border-brand-500 has-checked:bg-brand-50/60">
                      <input type="radio" name="versions" value={n} defaultChecked={(assessment.versions ?? 1) === n} className="accent-brand-700" />
                      <span className="text-[14px] font-semibold text-brand-900">{n === 1 ? "Só uma" : `${n} versões`}</span>
                    </label>
                  ))}
                </div>
              </ActionForm>
              {(assessment.versions ?? 1) > 1 && (
                <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
                  {VERSION_LETTERS.slice(0, assessment.versions).map((l) => (
                    <span key={l} className="inline-flex overflow-hidden rounded-lg border border-line">
                      <a href={`/api/avaliacoes/${id}/pdf?modo=branco&versao=${l}`} target="_blank" rel="noopener" className="px-2.5 py-1.5 font-bold text-brand-900 hover:bg-brand-50">
                        Versão {l} · PDF
                      </a>
                      <a href={`/api/avaliacoes/${id}/docx?versao=${l}`} className="border-l border-line px-2.5 py-1.5 font-bold text-brand-700 hover:bg-brand-50">
                        Word
                      </a>
                    </span>
                  ))}
                </div>
              )}
            </details>
          </Card>
          {/* Mesma prova em outras turmas: cada turma ganha a sua cópia (cartões e notas separados) */}
          {(classes ?? []).some((c) => c.id !== row.class_id) && (
            <Card className="mb-6 p-5">
              <details>
                <summary className="cursor-pointer font-bold text-brand-900">Aplicar esta prova em outras turmas</summary>
                <p className="mt-2 text-[13px] text-muted">
                  Cria uma cópia desta avaliação para cada turma marcada, com as mesmas questões, gabarito e cabeçalho. Esta avaliação e as notas
                  dela continuam como estão.
                </p>
                <ActionForm action={applyToClasses.bind(null, id)} submitLabel="Aplicar nas turmas marcadas" resetOnSuccess className="mt-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(classes ?? [])
                      .filter((c) => c.id !== row.class_id)
                      .map((c) => (
                        <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5 has-checked:border-brand-500 has-checked:bg-brand-50/60">
                          <input type="checkbox" name="class_ids" value={c.id} className="h-5 w-5 accent-brand-700" />
                          <span className="font-semibold text-brand-900">{c.name}</span>
                        </label>
                      ))}
                  </div>
                </ActionForm>
              </details>
            </Card>
          )}
          <h2 className="mb-3 text-[15px] font-bold text-brand-900">Questões</h2>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <QuestionEditor
                key={`${q.id}-${JSON.stringify([q.type, q.statement, q.options, q.correct_answers, q.weight, q.annulled, q.image_path])}`}
                q={q}
                number={i + 1}
                isFirst={i === 0}
                isLast={i === questions.length - 1}
                defaultOpen={!q.statement}
                imageUrl={q.image_path ? imageUrls[q.image_path] : null}
                save={saveQuestion.bind(null, id, q.id!)}
                remove={deleteQuestion.bind(null, id, q.id!)}
                moveUp={moveQuestion.bind(null, id, q.id!, -1)}
                moveDown={moveQuestion.bind(null, id, q.id!, 1)}
                duplicate={duplicateQuestion.bind(null, id, q.id!)}
              />
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-4">
            <p className="mb-3 text-[13px] font-bold text-brand-900">Adicionar questão</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ADD_TYPES.map((t) => (
                <form key={t} action={addQuestion.bind(null, id, t)}>
                  <button className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2.5 text-[13px] font-semibold text-brand-900 hover:border-brand-200 active:scale-[0.98]">
                    <Plus size={15} /> {QUESTION_TYPE_NAMES[t]}
                  </button>
                </form>
              ))}
            </div>
            <Link
              href={`/avaliacoes/${id}/importar`}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2.5 text-[13px] font-semibold text-brand-900 hover:border-brand-200 active:scale-[0.98]"
            >
              <FileUp size={15} /> Importar questões de um PDF ou Word
            </Link>
            <Link
              href={`/banco-de-questoes?avaliacao=${id}`}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-[13px] font-bold text-brand-900 hover:bg-brand-50 active:scale-[0.98]"
            >
              <Library size={15} /> Buscar no Banco de Questões (ENEM com figuras e gabarito)
            </Link>
          </div>
        </section>

        <aside className="space-y-6">
          <Card>
            <h2 className="border-b border-line px-5 py-3.5 font-bold text-brand-900">Gabarito oficial</h2>
            {questions.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">Sem questões ainda.</p>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-2 font-bold">Questão</th>
                    <th className="py-2 font-bold">Resposta</th>
                    <th className="px-5 py-2 text-right font-bold">Peso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {questions.map((q, i) => (
                    <tr key={q.id} className={q.annulled ? "text-muted line-through" : ""}>
                      <td className="px-5 py-2 font-semibold">{String(i + 1).padStart(2, "0")}</td>
                      <td className="py-2">
                        {q.type === "essay" || q.type === "lined" ? (
                          <span className="text-muted">manual</span>
                        ) : q.correct_answers.length ? (
                          <span className="font-bold text-brand-700">{q.correct_answers.join(" / ")}</span>
                        ) : (
                          <span className="font-semibold text-amber-700">—</span>
                        )}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums">{q.weight.toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>


          <ConfirmButton action={deleteAssessment.bind(null, id)} message={`Excluir a avaliação "${assessment.title}"? As questões e os cartões gerados também serão apagados.`}>
            <Trash2 size={16} /> Excluir avaliação
          </ConfirmButton>
        </aside>
      </div>
    </>
  );
}

