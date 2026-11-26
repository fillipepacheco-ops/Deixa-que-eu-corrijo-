/**
 * BIMESTRE de cada avaliação, para separar as listas.
 * Ordem: o que o professor escolheu → o que está no título ("4º bimestre") → a data de aplicação.
 */
export type Term = 1 | 2 | 3 | 4;

export const TERM_LABEL = (t: Term) => `${t}º bimestre`;

export function termFromTitle(title: string | null | undefined): Term | null {
  const m = /\b([1-4])\s*[º°ªo]?\s*\.?\s*bim(?:estre)?\b/i.exec((title ?? "").normalize("NFC"));
  return m ? (Number(m[1]) as Term) : null;
}

/** Calendário escolar comum: fev–abr = 1º, mai–jul = 2º, ago–set = 3º, out–dez = 4º. */
export function termFromDate(iso: string | null | undefined): Term | null {
  const m = Number((iso ?? "").slice(5, 7));
  if (!m) return null;
  if (m <= 4) return 1;
  if (m <= 7) return 2;
  if (m <= 9) return 3;
  return 4;
}

export function termOf(a: { term?: number | null; title?: string | null; applied_on?: string | null; created_at?: string | null }): Term | null {
  if (a.term && a.term >= 1 && a.term <= 4) return a.term as Term;
  return termFromTitle(a.title) ?? termFromDate(a.applied_on) ?? termFromDate(a.created_at);
}

export function yearOf(a: { applied_on?: string | null; created_at?: string | null }): number | null {
  const y = Number((a.applied_on ?? a.created_at ?? "").slice(0, 4));
  return y || null;
}

export interface TermGroup<T> {
  key: string;
  year: number | null;
  term: Term | null;
  label: string;
  items: T[];
}

/** Agrupa por ano + bimestre, do mais recente para o mais antigo. */
export function groupByTerm<T extends { term?: number | null; title?: string | null; applied_on?: string | null; created_at?: string | null }>(items: T[]): TermGroup<T>[] {
  const map = new Map<string, TermGroup<T>>();
  const years = new Set(items.map(yearOf));
  for (const it of items) {
    const term = termOf(it);
    const year = yearOf(it);
    const key = `${year ?? 0}-${term ?? 0}`;
    if (!map.has(key)) {
      const base = term ? TERM_LABEL(term) : "Sem bimestre";
      map.set(key, { key, year, term, label: years.size > 1 && year ? `${base} · ${year}` : base, items: [] });
    }
    map.get(key)!.items.push(it);
  }
  return [...map.values()].sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (b.term ?? 0) - (a.term ?? 0));
}
