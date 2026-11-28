/**
 * BANCO DE QUESTÕES — ENEM: 1º dia (Linguagens e Ciências Humanas) e 2º dia
 * (Ciências da Natureza e Matemática), caderno amarelo/azul conforme o ano.
 *
 * Questões extraídas das provas oficiais com texto fiel e as figuras recortadas
 * no lugar exato de cada uma ([[img:...]]), gabarito oficial e classificação
 * área › disciplina › tópico › subtópico (uma questão pode ter mais de uma).
 */
import data from "@/data/banco/enem.json";
import tax from "@/data/banco/taxonomia.json";
import { stripInline } from "@/lib/assessment/inline-images";
import { OPTION_LABELS } from "@/lib/assessment/question-form";

export interface BankQuestion {
  id: string;
  /** ano de aplicação */
  y: number;
  /** número da questão na prova */
  n: number;
  area: string;
  /** disciplina principal */
  d: string;
  /** [disciplina, tópico, subtópico] */
  tags: [string, string, string][];
  /** enunciado (parágrafos separados por \n, fórmulas e figuras marcadas) */
  st: string;
  /** alternativas A–E */
  op: string[];
  /** gabarito oficial (null = anulada) */
  ans: string | null;
  nul: boolean;
  /** questões 1–5 do 1º dia: língua estrangeira escolhida (i = inglês, e = espanhol) */
  lang?: "i" | "e";
}

export interface TaxDiscipline {
  d: string;
  topics: { t: string; subs: string[] }[];
}

const LANG_ORDER = { i: 0, e: 1 } as const;
export const ENEM_QUESTIONS = (data as unknown as BankQuestion[])
  .slice()
  .sort((a, b) => b.y - a.y || a.n - b.n || (a.lang ? LANG_ORDER[a.lang] : 0) - (b.lang ? LANG_ORDER[b.lang] : 0));
export const TAXONOMY = tax as unknown as TaxDiscipline[];
export const ENEM_YEARS = [...new Set(ENEM_QUESTIONS.map((q) => q.y))].sort((a, b) => b - a);
const AREA_ORDER = ["Linguagens", "Ciências Humanas", "Ciências da Natureza", "Matemática"];
const areaRank = (a: string) => AREA_ORDER.findIndex((p) => a.startsWith(p));
export const ENEM_AREAS = [...new Set(ENEM_QUESTIONS.map((q) => q.area))].sort((a, b) => areaRank(a) - areaRank(b));

export interface BankFilter {
  ano?: number | null;
  area?: string | null;
  d?: string | null;
  t?: string | null;
  s?: string | null;
  q?: string | null;
  /** esconder as anuladas */
  semAnuladas?: boolean;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const searchIndex = new Map<string, string>();
function searchable(q: BankQuestion) {
  let s = searchIndex.get(q.id);
  if (!s) {
    s = fold(stripInline([q.st, ...q.op].join(" "), " ").replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2").replace(/[_^]\{([^}]*)\}/g, "$1"));
    searchIndex.set(q.id, s);
  }
  return s;
}

/** Questões que passam no filtro (todas as palavras da busca precisam aparecer). */
/**
 * Busca pelo número e/ou ano: "2025 101", "101/2025", "questão 150 2019", "ENEM 2022 q95", "135".
 * Só vale quando a busca tem apenas números e essas palavras.
 */
export function parseLocator(q: string | null | undefined): { ano: number | null; num: number | null; lang?: "i" | "e" } | null {
  const t = fold(q ?? "").replace(/[^a-z0-9]+/g, " ").trim();
  if (!t || !/\d/.test(t)) return null;
  const toks = t.split(" ").filter((w) => !["enem", "questao", "questoes", "q", "n", "no", "num", "numero", "ano", "de", "do", "da"].includes(w));
  let ano: number | null = null;
  let num: number | null = null;
  let lang: "i" | "e" | undefined;
  for (const w of toks) {
    if (["ingles", "english"].includes(w)) {
      lang = "i";
      continue;
    }
    if (["espanhol", "espanol"].includes(w)) {
      lang = "e";
      continue;
    }
    const m = /^q?(\d+)([ie])?$/.exec(w);
    if (!m) return null;
    const v = Number(m[1]);
    if (m[2]) lang = m[2] as "i" | "e";
    if (m[1].length === 4 && v >= 2000 && ano === null) ano = v;
    else if (v >= 1 && v <= 180 && num === null) num = v;
    else return null;
  }
  if (ano === null && num === null) return null;
  return lang ? { ano, num, lang } : { ano, num };
}

export function filterBank(list: BankQuestion[], f: BankFilter): BankQuestion[] {
  const loc = parseLocator(f.q);
  const words = loc
    ? []
    : fold(f.q ?? "")
        .split(/\s+/)
        .filter((w) => w.length > 1);
  return list.filter((q) => {
    if (f.ano && q.y !== f.ano) return false;
    if (loc?.ano && q.y !== loc.ano) return false;
    if (loc?.num && q.n !== loc.num) return false;
    if (loc?.lang && q.lang !== loc.lang) return false;
    if (f.area && q.area !== f.area) return false;
    if (f.semAnuladas && q.nul) return false;
    if (f.d || f.t || f.s) {
      const ok = q.tags.some(([d, t, s]) => (!f.d || d === f.d) && (!f.t || t === f.t) && (!f.s || s === f.s));
      if (!ok) return false;
    }
    if (words.length) {
      const text = searchable(q);
      if (!words.every((w) => text.includes(w))) return false;
    }
    return true;
  });
}

/** Quantas questões há em cada disciplina › tópico › subtópico (para os filtros). */
export function tagCounts(list: BankQuestion[]) {
  const counts = new Map<string, number>();
  for (const q of list) {
    const seen = new Set<string>();
    for (const [d, t, s] of q.tags) {
      for (const k of [d, `${d}|${t}`, `${d}|${t}|${s}`]) {
        if (seen.has(k)) continue;
        seen.add(k);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  }
  return Object.fromEntries(counts);
}

export function sourceLabel(q: BankQuestion) {
  return `ENEM ${q.y}`;
}

/** "Questão 1 (Inglês)", "Questão 46"… */
export function numberLabel(q: BankQuestion) {
  return `Questão ${q.n}${q.lang === "i" ? " (Inglês)" : q.lang === "e" ? " (Espanhol)" : ""}`;
}

/** Total de questões por dia de prova (para os chips da página). */
export const ENEM_DAY_COUNTS = {
  d1: ENEM_QUESTIONS.filter((q) => q.n <= 90).length,
  d2: ENEM_QUESTIONS.filter((q) => q.n > 90).length,
};

/** Linha de assessment_questions: o enunciado começa com a origem e o ano, ex.: (ENEM 2025). */
export function bankQuestionRow(q: BankQuestion) {
  const tag = `(${sourceLabel(q)})`;
  const statement = q.st.startsWith("[[img:") ? `${tag}\n${q.st}` : `${tag} ${q.st}`;
  const options = OPTION_LABELS.map((label, i) => ({ label, text: q.op[i] ?? "" })).filter((o) => o.text.trim());
  return {
    type: "multiple_choice" as const,
    statement,
    options,
    correct_answers: q.ans ? [q.ans] : [],
    weight: 1,
    annulled: q.nul,
  };
}
