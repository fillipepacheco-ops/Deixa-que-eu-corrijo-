import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadSchools } from "@/services/school-context";
import { deleteClass, updateClass } from "@/services/classes";
import { addStudent, addStudentsBulk, removeAllStudents, removeStudent, setStudentActive, updateStudent } from "@/services/students";
import { StudentListField } from "@/components/students/StudentListField";
import { StudentRow } from "@/components/students/StudentRow";
import { Card, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { ClassFields } from "@/components/classes/ClassFields";
import type { ClassGroup, Student } from "@/lib/models/types";

export const metadata: Metadata = { title: "Turma" };

export default async function TurmaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: turma } = await supabase.from("classes").select("*").eq("id", id).maybeSingle<ClassGroup>();
  if (!turma) notFound();

  const { data } = await supabase
    .from("students")
    .select("*")
    .eq("class_id", id)
    .order("roll_number", { ascending: true, nullsFirst: false })
    .order("name");
  const students = (data ?? []) as (Student & { inactive_reason?: string | null; inactive_since?: string | null })[];
  const inactiveCount = students.filter((s) => s.active === false).length;
  const activeCount = students.length - inactiveCount;

  return (
    <>
      <Link href="/turmas" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft size={16} /> Turmas
      </Link>
      <PageHeader
        eyebrow={[turma.subject, turma.year].filter(Boolean).join(" · ")}
        title={turma.name}
        description={[
          turma.grade_level,
          turma.shift,
          `${activeCount} ${activeCount === 1 ? "aluno" : "alunos"}`,
          inactiveCount ? `${inactiveCount} não ${inactiveCount === 1 ? "frequenta" : "frequentam"} mais` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <ConfirmButton
            action={deleteClass.bind(null, id)}
            message={`Excluir a turma ${turma.name}? Os alunos dela também serão removidos.`}
          >
            <Trash2 size={16} /> Excluir turma
          </ConfirmButton>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="font-bold text-brand-900">Alunos</h2>
            {students.length > 0 && (
              <ConfirmButton
                action={removeAllStudents.bind(null, id)}
                message={`Apagar os ${students.length} alunos desta turma? Use quando uma importação sair errada. As notas e correções desses alunos também serão apagadas.`}
                className="px-2.5! py-1! text-[13px]"
              >
                <Trash2 size={14} /> Apagar todos
              </ConfirmButton>
            )}
          </div>
          {students.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Turma sem alunos" text="Adicione um por um ou cole a lista inteira (um nome por linha) no quadro ao lado." />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {students.map((s) => (
                <li key={s.id}>
                  <StudentRow
                    student={s}
                    save={updateStudent.bind(null, s.id, id)}
                    remove={removeStudent.bind(null, s.id, id)}
                    setActive={setStudentActive.bind(null, s.id, id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 font-bold text-brand-900">Adicionar aluno</h2>
            <ActionForm action={addStudent.bind(null, id)} submitLabel="Adicionar" resetOnSuccess successText="Aluno adicionado." submitClassName="w-full">
              <div className="space-y-3">
                <input className="field" name="name" placeholder="Nome completo" aria-label="Nome completo" required />
                <div className="grid grid-cols-[90px_1fr] gap-3">
                  <input className="field" name="roll_number" type="number" inputMode="numeric" placeholder="Nº" aria-label="Nº de chamada" />
                  <input className="field" name="registration" placeholder="Matrícula (opcional)" aria-label="Matrícula" />
                </div>
              </div>
            </ActionForm>
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-brand-900">Importar ou colar lista de alunos</h2>
            <p className="mb-3 mt-1 text-[13px] text-muted">
              Escolha o arquivo da lista (Excel, CSV, Word ou PDF) ou cole os nomes, um por linha. Aceita “Nome”, “12 Nome” ou “12;Nome;Matrícula”.
            </p>
            <ActionForm action={addStudentsBulk.bind(null, id)} submitLabel="Importar lista" resetOnSuccess successText="Lista importada." submitClassName="w-full">
              <StudentListField />
            </ActionForm>
          </Card>

          <Card className="p-5">
            <details>
              <summary className="cursor-pointer font-bold text-brand-900">Editar dados da turma</summary>
              <div className="mt-4">
                <ActionForm action={updateClass.bind(null, id)} submitLabel="Salvar turma" successText="Turma atualizada.">
                  <ClassFields value={turma} compact schools={await loadSchools(supabase)} />
                </ActionForm>
              </div>
            </details>
          </Card>
        </div>
      </div>
    </>
  );
}
