/**
 * VERSÕES DA PROVA (A, B, C, D) — mesma prova, questões em ordem diferente.
 *
 * Regras:
 *  - a versão A é a ordem original;
 *  - as questões só trocam de lugar dentro da mesma seção (disciplina) e com outras
 *    do mesmo formato (mesmo tipo e mesmo nº de alternativas). Assim o cartão-resposta
 *    tem exatamente o mesmo desenho em todas as versões e a câmera lê igual;
 *  - o embaralhamento é fixo (semente = id da avaliação): imprimir de novo dá a mesma ordem.
 *  - a nota é sempre guardada na numeração da versão A.
 */

export const VERSION_LETTERS = ["A", "B", "C", "D"] as const;
export const versionLabel = (v: number) => VERSION_LETTERS[v] ?? String(v + 1);

export interface VersionQuestion {
  position: number;
  type: string;
  options?: { label: string }[] | null;
  section?: string | null;
}

/** Gerador pseudoaleatório com semente (mulberry32 sobre um hash da semente). */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shapeOf = (q: VersionQuestion) => `${q.type}:${q.options?.length ?? 0}`;

/**
 * Ordem de cada versão: orders[v][i] = posição (na versão A) da questão impressa como nº i+1.
 */
export function versionOrders(questions: VersionQuestion[], versions: number, seed: string): number[][] {
  const qs = [...questions].sort((a, b) => a.position - b.position);
  const base = qs.map((q) => q.position);
  const n = Math.max(1, Math.min(4, Math.floor(versions) || 1));
  const orders: number[][] = [base];

  // grupos que podem trocar entre si: mesma seção contínua + mesmo formato
  const groups = new Map<string, number[]>(); // chave → índices
  let block = 0;
  qs.forEach((q, i) => {
    if (i > 0 && (q.section ?? "") !== (qs[i - 1].section ?? "")) block++;
    const k = `${block}|${shapeOf(q)}`;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  });

  for (let v = 1; v < n; v++) {
    const rand = rng(`${seed}#${v}`);
    const order = [...base];
    for (const idx of groups.values()) {
      if (idx.length < 2) continue;
      const vals = idx.map((i) => base[i]);
      for (let i = vals.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [vals[i], vals[j]] = [vals[j], vals[i]];
      }
      // evita repetir a ordem de uma versão anterior neste grupo (gira até ficar diferente, se der)
      const seen = (arr: number[]) => orders.some((o) => idx.every((i, k) => o[i] === arr[k]));
      for (let r = 0; r < vals.length && seen(vals); r++) vals.push(vals.shift()!);
      idx.forEach((i, k) => (order[i] = vals[k]));
    }
    orders.push(order);
  }
  return orders;
}

/** Questões na ordem de uma versão, renumeradas 1..n. */
export function questionsForVersion<T extends VersionQuestion>(questions: T[], order: number[]): T[] {
  const byPos = new Map(questions.map((q) => [q.position, q]));
  return order.map((p, i) => ({ ...byPos.get(p)!, position: i + 1 }));
}

/** Gabarito na numeração impressa de uma versão. */
export function keyForVersion<K extends { number: number }>(key: K[], order: number[]): K[] {
  const byNum = new Map(key.map((k) => [k.number, k]));
  return order.flatMap((p, i) => (byNum.has(p) ? [{ ...byNum.get(p)!, number: i + 1 }] : []));
}

/** Respostas lidas na numeração da versão → numeração da versão A. */
export function answersToBase<V>(answers: Record<number | string, V>, order: number[]): Record<number, V> {
  const out: Record<number, V> = {};
  for (const [k, v] of Object.entries(answers)) {
    const printed = Number(k);
    const base = order[printed - 1];
    out[base ?? printed] = v;
  }
  return out;
}

/** Versão de cada aluno pela ordem de chamada: A, B, C, D, A, B… */
export const versionForIndex = (index: number, versions: number) => (versions > 1 ? index % versions : 0);

/** "B" ou "1" → índice da versão (0 = A). */
export function parseVersion(v: string | null | undefined): number | null {
  if (!v) return null;
  const i = VERSION_LETTERS.indexOf(v.trim().toUpperCase() as (typeof VERSION_LETTERS)[number]);
  if (i >= 0) return i;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n < 4 ? n : null;
}
