"use client";

import { useState } from "react";
import { FileDown, FileStack, FileText, Printer, ScanLine, User, Users } from "lucide-react";
import { FileButton } from "./FileButton";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Impressão da prova e do cartão-resposta: para a turma toda ou para um aluno.
 * "Prova + cartão" junta, para cada aluno, a prova seguida do cartão dele.
 */
export function PrintPanel({
  assessmentId,
  slug,
  students,
  className,
  hasQuestions,
  hasObjective,
}: {
  assessmentId: string;
  slug: string;
  students: { id: string; name: string; roll_number: number | null }[];
  className: string | null;
  hasQuestions: boolean;
  hasObjective: boolean;
}) {
  const [scope, setScope] = useState<"turma" | "aluno">("turma");
  const [studentId, setStudentId] = useState("");
  const student = students.find((s) => s.id === studentId);
  const base = `/api/avaliacoes/${assessmentId}/imprimir`;
  const who = scope === "aluno" && student ? `&aluno=${student.id}` : "";
  const whoSlug = scope === "aluno" && student ? `-${student.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")}` : "";

  const noQ = hasQuestions ? undefined : "Adicione questões primeiro";
  const needStudent = scope === "aluno" && !student ? "Escolha o aluno acima" : undefined;
  const noStudents = students.length === 0 ? "A turma não tem alunos" : undefined;
  const noObj = hasObjective ? undefined : "Precisa de questão objetiva";

  const tab = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[14px] font-semibold transition ${
      active ? "bg-white text-brand-900 shadow-sm" : "text-brand-700"
    }`;

  return (
    <section className="mb-7 rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[16px] font-bold text-brand-900">
          <Printer size={19} /> Imprimir
        </h2>
        <div className="flex w-full rounded-xl bg-brand-50 p-1 sm:w-auto">
          <button type="button" className={tab(scope === "turma")} onClick={() => setScope("turma")}>
            <Users size={16} /> Turma toda{students.length ? ` (${students.length})` : ""}
          </button>
          <button type="button" className={tab(scope === "aluno")} onClick={() => setScope("aluno")} disabled={!students.length}>
            <User size={16} /> Um aluno
          </button>
        </div>
      </div>

      {scope === "aluno" && (
        <div className="mb-4">
          <select className="field" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Escolha o aluno…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.roll_number ? `${s.roll_number}. ` : ""}
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <FileButton
          key={`kit${who}`}
          href={`${base}?doc=kit${who}`}
          filename={`${slug}-prova-e-cartao${whoSlug}.pdf`}
          mime="application/pdf"
          icon={<FileStack size={24} />}
          title="Prova + cartão"
          subtitle={scope === "turma" ? "Para cada aluno: a prova e o cartão dele, em ordem" : "A prova e o cartão deste aluno"}
          disabled={noQ ?? needStudent ?? noStudents ?? noObj}
        />
        <FileButton
          key={`prova${who}`}
          href={`${base}?doc=prova${who}`}
          filename={`${slug}-provas${whoSlug}.pdf`}
          mime="application/pdf"
          icon={<FileDown size={24} />}
          title={scope === "turma" ? "Provas da turma" : "Prova do aluno"}
          subtitle={scope === "turma" ? `Uma por aluno${className ? ` da ${className}` : ""}, com nome na capa` : "Com nome e nº na capa"}
          disabled={noQ ?? needStudent ?? (scope === "turma" ? noStudents : undefined)}
        />
        <FileButton
          key={`cartao${who}`}
          href={`${base}?doc=cartao${who}`}
          filename={`${slug}-cartoes${whoSlug}.pdf`}
          mime="application/pdf"
          icon={<ScanLine size={24} />}
          title={scope === "turma" ? "Cartões da turma" : "Cartão do aluno"}
          subtitle={scope === "turma" ? `Um por aluno + ${students.length ? "3 em branco" : "35 em branco"}` : "Com o código e o nome dele"}
          disabled={noQ ?? noObj ?? needStudent}
        />
        {scope === "turma" && (
          <>
            <FileButton
              href={`${base}?doc=prova&branco=1`}
              filename={`${slug}-em-branco.pdf`}
              mime="application/pdf"
              icon={<FileDown size={24} />}
              title="Prova em branco"
              subtitle="Uma cópia sem nome (para xerox)"
              disabled={noQ}
            />
            <FileButton
              href={`/api/avaliacoes/${assessmentId}/docx`}
              filename={`${slug}.docx`}
              mime={DOCX}
              icon={<FileText size={24} />}
              title="Prova no Word"
              subtitle="Arquivo editável (.docx)"
              disabled={noQ}
            />
          </>
        )}
      </div>
    </section>
  );
}
