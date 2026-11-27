import type { ClassGroup } from "@/lib/models/types";

export const SHIFTS = ["Matutino", "Vespertino", "Noturno", "Integral"];

/** Campos de turma: escola, nome, série, ano, turno, disciplina. */
export function ClassFields({
  value,
  compact = false,
  schools = [],
  defaultSchool,
}: {
  value?: Partial<ClassGroup> & { school_id?: string | null };
  compact?: boolean;
  schools?: { id: string; name: string }[];
  defaultSchool?: string | null;
}) {
  const year = value?.year ?? new Date().getFullYear();
  return (
    <div className={`grid gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
      <div className={compact ? "" : "sm:col-span-2"}>
        <label className="label" htmlFor="school_id">Escola</label>
        <select className="field" id="school_id" name="school_id" defaultValue={value?.school_id ?? defaultSchool ?? ""}>
          <option value="">Sem escola</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {schools.length === 0 && (
          <p className="mt-1 text-[12px] text-muted">
            Cadastre suas escolas em <a href="/escolas" className="font-semibold text-brand-700 underline">Escolas</a> para separar as turmas e usar a logo de cada uma.
          </p>
        )}
      </div>
      <div>
        <label className="label" htmlFor="name">Nome da turma *</label>
        <input className="field" id="name" name="name" placeholder="Ex.: 9º A" defaultValue={value?.name ?? ""} required />
      </div>
      <div>
        <label className="label" htmlFor="grade_level">Série</label>
        <input className="field" id="grade_level" name="grade_level" placeholder="Ex.: 9º ano" defaultValue={value?.grade_level ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="subject">Disciplina</label>
        <input className="field" id="subject" name="subject" placeholder="Ex.: Matemática" defaultValue={value?.subject ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="year">Ano</label>
          <input className="field" id="year" name="year" type="number" inputMode="numeric" defaultValue={year} />
        </div>
        <div>
          <label className="label" htmlFor="shift">Turno</label>
          <select className="field" id="shift" name="shift" defaultValue={value?.shift ?? ""}>
            <option value="">—</option>
            {SHIFTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
