"use client";

import { useState } from "react";
import { FileDown, FileStack, FileText, Printer, ScanLine, User, Users } from "lucide-react";
import { FileButton } from "./FileButton";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Impressão da prova e do cartão-resposta: para a turma toda ou só para os alunos escolhidos.
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
  const [picked, setPicked] = useState<string[]>([]);
  const chosen = students.filter((s) => picked.includes(s.id)); // na ordem da chamada
  const one = chosen.length === 1 ? chosen[0] : null;
  const base = `/api/avaliacoes/${assessmentId}/imprimir`;
  const who = scope === "aluno" && chosen.length ? `&aluno=${chosen.map((s) => s.id).join(",")}` : "";
  const slugOf = (n: string) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
  const whoSlug = scope === "aluno" && chosen.length ? (one ? `-${slugOf(one.name)}` : `-${chosen.length}-alunos`) : "";
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const noQ = hasQuestions ? undefined : "Adicione questões primeiro";
  const needStudent = scope === "aluno" && !chosen.length ? "Marque os alunos acima" : undefined;
  const noStudents = students.length === 0 ? "A turma não tem alunos" : undefined;
  const noObj = hasObjective ? undefined : "Precisa de questão objetiva";

  const tab = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[14px] font-semibold transition ${
      active ? "bg-white text-brand-900 shadow-sm" : "text-brand-700"
    }`;

  return (
    <section id="imprimir" className="mb-7 scroll-mt-20 rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[16px] font-bold text-brand-900">
          <Printer size={19} /> Imprimir
        </h2>
        <div className="flex w-full rounded-xl bg-brand-50 p-1 sm:w-auto">
          <button type="button" className={tab(scope === "turma")} onClick={() => setScope("turma")}>
            <Users size={16} /> Turma toda{students.length ? ` (${students.length})` : ""}
          </button>
          <button type="button" className={tab(scope === "aluno")} onClick={() => setScope("aluno")} disabled={!students.length}>
            <User size={16} /> Escolher alunos{chosen.length ? ` (${chosen.length})` : ""}
          </button>
        </div>
      </div>

      {scope === "aluno" && (
        <div className="mb-4 rounded-xl border border-line">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <span className="text-[13px] font-semibold text-brand-900">
              {chosen.length ? `${chosen.length} de ${students.length} marcados` : "Marque de quem você quer imprimir"}
            </span>
            <span className="flex gap-3 text-[13px] font-semibold text-brand-700">
              <button type="button" onClick={() => setPicked(students.map((s) => s.id))}>
                Todos
              </button>
              <button type="button" onClick={() => setPicked([])}>
                Limpar
              </button>
            </span>
          </div>
          <div className="grid max-h-72 overflow-y-auto sm:grid-cols-2">
            {students.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-[14px] has-checked:bg-brand-50/70">
                <input type="checkbox" className="h-5 w-5 shrink-0 accent-brand-700" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} />
                <span className="w-6 shrink-0 text-right text-[13px] font-bold tabular-nums text-muted">{s.roll_number ?? "–"}</span>
                <span className="min-w-0 truncate text-brand-900">{s.name}</span>
              </label>
            ))}
          </div>
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
          subtitle={scope === "turma" ? "Para cada aluno: a prova e o cartão dele, em ordem" : one ? "A prova e o cartão deste aluno" : "Para cada aluno marcado: a prova e o cartão dele"}
          disabled={noQ ?? needStudent ?? noStudents ?? noObj}
        />
        <FileButton
          key={`prova${who}`}
          href={`${base}?doc=prova${who}`}
          filename={`${slug}-provas${whoSlug}.pdf`}
          mime="application/pdf"
          icon={<FileDown size={24} />}
          title={scope === "turma" ? "Provas da turma" : one ? "Prova do aluno" : "Provas dos marcados"}
          subtitle={scope === "turma" ? `Uma por aluno${className ? ` da ${className}` : ""}, com nome na capa` : "Com nome e nº na capa"}
          disabled={noQ ?? needStudent ?? (scope === "turma" ? noStudents : undefined)}
        />
        <FileButton
          key={`cartao${who}`}
          href={`${base}?doc=cartao${who}`}
          filename={`${slug}-cartoes${whoSlug}.pdf`}
          mime="application/pdf"
          icon={<ScanLine size={24} />}
          title={scope === "turma" ? "Cartões da turma" : one ? "Cartão do aluno" : "Cartões dos marcados"}
          subtitle={scope === "turma" ? `Um por aluno + ${students.length ? "3 em branco" : "35 em branco"}` : "Com o código e o nome de cada um"}
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
