/** Campos da Prova Multi (criar e editar). */
export interface MultiExamValue {
  title?: string;
  school_id?: string | null;
  class_ids?: string[];
  applied_on?: string | null;
  term?: number | null;
  option_count?: number;
  versions?: number;
  max_score?: number;
  instructions?: string | null;
}

export function MultiExamFields({
  value = {},
  schools,
  classes,
}: {
  value?: MultiExamValue;
  schools: { id: string; name: string }[];
  classes: { id: string; name: string; school_id: string | null }[];
}) {
  const schoolName = new Map(schools.map((s) => [s.id, s.name]));
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Nome da prova</label>
        <input className="field" name="title" defaultValue={value.title ?? ""} placeholder="Ex.: Simulado Multidisciplinar — 1º bimestre" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Escola (logo e nome no cabeçalho)</label>
          <select className="field" name="school_id" defaultValue={value.school_id ?? ""}>
            <option value="">— sem escola —</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Data de aplicação</label>
          <input className="field" type="date" name="applied_on" defaultValue={value.applied_on ?? ""} />
        </div>
        <div>
          <label className="label">Bimestre</label>
          <select className="field" name="term" defaultValue={value.term ? String(value.term) : ""}>
            <option value="">Automático (pela data)</option>
            {[1, 2, 3, 4].map((t) => (
              <option key={t} value={t}>
                {t}º bimestre
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Nota máxima</label>
          <input className="field" name="max_score" inputMode="decimal" defaultValue={String(value.max_score ?? 10).replace(".", ",")} />
        </div>
        <div>
          <label className="label">Alternativas por questão</label>
          <select className="field" name="option_count" defaultValue={String(value.option_count ?? 5)}>
            <option value="5">5 (A a E)</option>
            <option value="4">4 (A a D)</option>
          </select>
        </div>
        <div>
          <label className="label">Versões da prova</label>
          <select className="field" name="versions" defaultValue={String(value.versions ?? 4)}>
            <option value="4">4 versões (A, B, C, D)</option>
            <option value="3">3 versões</option>
            <option value="2">2 versões</option>
            <option value="1">Só uma</option>
          </select>
        </div>
      </div>
      <div>
        <p className="label">Turmas que vão fazer a prova</p>
        {classes.length === 0 ? (
          <p className="text-[13px] text-muted">Cadastre as turmas em Turmas primeiro.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {classes.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5 has-checked:border-brand-500 has-checked:bg-brand-50/60">
                <input type="checkbox" name="class_ids" value={c.id} defaultChecked={value.class_ids?.includes(c.id)} className="h-5 w-5 accent-brand-700" />
                <span className="font-semibold text-brand-900">{c.name}</span>
                {c.school_id && <span className="ml-auto truncate text-[12px] text-muted">{schoolName.get(c.school_id)}</span>}
              </label>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="label">Instruções da capa (opcional)</label>
        <textarea className="field min-h-20" name="instructions" defaultValue={value.instructions ?? ""} />
      </div>
    </div>
  );
}
