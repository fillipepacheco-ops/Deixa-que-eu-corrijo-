import { DEFAULT_INSTRUCTIONS } from "@/lib/assessment/header";
import { LogoUpload } from "./LogoUpload";

export interface HeaderValues {
  title?: string | null;
  school_name?: string | null;
  school_logo_path?: string | null;
  subject?: string | null;
  grade_level?: string | null;
  class_id?: string | null;
  teacher_name?: string | null;
  applied_on?: string | null;
  max_score?: number | null;
  instructions?: string | null;
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-line p-4 sm:p-5">
      <legend className="px-1.5 text-[13px] font-extrabold uppercase tracking-wide text-brand-700">{title}</legend>
      {hint && <p className="-mt-1 mb-3 text-[12px] text-muted">{hint}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/**
 * Cabeçalho da avaliação. Estes mesmos dados vão para a capa da prova
 * (PDF e Word) e para os cartões-resposta.
 */
export function HeaderFields({
  value = {},
  classes,
  logoUrl,
}: {
  value?: HeaderValues;
  classes: { id: string; name: string }[];
  logoUrl?: string | null;
}) {
  return (
    <div className="space-y-5">
      <Group title="Escola" hint="Preencha uma vez: fica salvo como padrão para as próximas avaliações.">
        <div className="sm:col-span-2">
          <label className="label">Logo da escola</label>
          <LogoUpload initialPath={value.school_logo_path} initialUrl={logoUrl} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="school_name">Nome da escola</label>
          <input className="field" id="school_name" name="school_name" placeholder="Ex.: Centro Educacional São Francisco" defaultValue={value.school_name ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="applied_on">Data de aplicação</label>
          <input className="field" id="applied_on" name="applied_on" type="date" defaultValue={value.applied_on ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="teacher_name">Professor(a)</label>
          <input className="field" id="teacher_name" name="teacher_name" defaultValue={value.teacher_name ?? ""} />
        </div>
      </Group>

      <Group title="Turma" hint="O nome e o nº de cada aluno saem preenchidos automaticamente na capa e no cartão-resposta.">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="class_id">Turma</label>
          <select className="field" id="class_id" name="class_id" defaultValue={value.class_id ?? ""}>
            <option value="">Sem turma (provas e cartões em branco)</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </Group>

      <Group title="Prova">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="title">Título da avaliação *</label>
          <input className="field" id="title" name="title" required placeholder="Ex.: Avaliação Bimestral de Matemática" defaultValue={value.title ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="subject">Disciplina</label>
          <input className="field" id="subject" name="subject" placeholder="Ex.: Matemática (vazio = da turma)" defaultValue={value.subject ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="grade_level">Série</label>
          <input className="field" id="grade_level" name="grade_level" placeholder="Ex.: 9º ano (vazio = da turma)" defaultValue={value.grade_level ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="max_score">Nota máxima</label>
          <input className="field" id="max_score" name="max_score" inputMode="decimal" defaultValue={String(value.max_score ?? 10).replace(".", ",")} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="instructions">Instruções da capa (uma por linha — numeração automática)</label>
          <textarea
            className="field min-h-44 text-[14px] leading-relaxed"
            id="instructions"
            name="instructions"
            defaultValue={value.instructions ?? DEFAULT_INSTRUCTIONS.join("\n")}
          />
        </div>
      </Group>
    </div>
  );
}
