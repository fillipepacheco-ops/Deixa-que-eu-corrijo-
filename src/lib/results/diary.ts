/**
 * DIÁRIO — cada escola tem a sua regra para lançar a nota:
 * escala (vale da prova, 0–10, 0–100), arredondamento, vírgula ou ponto,
 * o que escrever para quem não fez a prova, ordem dos alunos.
 * Aqui ficam só as regras (puras e testadas); a tela usa estas funções.
 */

export type Rounding = "proximo" | "cima" | "baixo";
export type StudentOrder = "chamada" | "alfabetica";

export interface DiaryFormat {
  /** null = lança no valor da própria prova (ex.: prova de 5,0 → nota até 5,0). Número = converte para 0–scale. */
  scale: number | null;
  /** Menor fração aceita no diário: 0,01 · 0,1 · 0,25 · 0,5 · 1. */
  step: number;
  rounding: Rounding;
  decimal: "," | ".";
  /** O que vai no diário para quem não tem nota (ex.: "", "F", "0", "-"). */
  absent: string;
  order: StudentOrder;
  /** Mostrar a matrícula ao lado do nome (diários que pedem matrícula). */
  showRegistration: boolean;
  /** Média para aprovação, em % da nota máxima (ex.: 60 → 6,0 em 10). */
  passPercent: number;
}

export const STEPS = [0.01, 0.1, 0.25, 0.5, 1] as const;

export const DEFAULT_FORMAT: DiaryFormat = {
  scale: null,
  step: 0.1,
  rounding: "proximo",
  decimal: ",",
  absent: "",
  order: "chamada",
  showRegistration: false,
  passPercent: 60,
};

const EPS = 1e-9;

/** Junta o que veio salvo com o padrão, descartando valores inválidos. */
export function normalizeFormat(raw: unknown): DiaryFormat {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof DiaryFormat, unknown>>;
  const scale = r.scale === null || r.scale === undefined || r.scale === "" ? null : Number(r.scale);
  const step = Number(r.step);
  const pass = Number(r.passPercent);
  return {
    scale: scale !== null && Number.isFinite(scale) && scale > 0 ? scale : null,
    step: (STEPS as readonly number[]).includes(step) ? step : DEFAULT_FORMAT.step,
    rounding: r.rounding === "cima" || r.rounding === "baixo" ? r.rounding : "proximo",
    decimal: r.decimal === "." ? "." : ",",
    absent: typeof r.absent === "string" ? r.absent.slice(0, 10) : DEFAULT_FORMAT.absent,
    order: r.order === "alfabetica" ? "alfabetica" : "chamada",
    showRegistration: r.showRegistration === true || r.showRegistration === "true",
    passPercent: Number.isFinite(pass) && pass >= 0 && pass <= 100 ? pass : DEFAULT_FORMAT.passPercent,
  };
}

/** Casas decimais que o passo precisa (0,25 → 2; 0,5 → 1; 1 → 0). */
export function decimalsOf(step: number) {
  if (step >= 1) return 0;
  const s = String(step);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

export function roundTo(value: number, step: number, mode: Rounding = "proximo") {
  const q = value / step;
  const n = mode === "cima" ? Math.ceil(q - EPS) : mode === "baixo" ? Math.floor(q + EPS) : Math.round(q + EPS);
  return Number((n * step).toFixed(decimalsOf(step)));
}

/** Nota máxima no diário: a escala escolhida ou o valor da prova. */
export function diaryMax(maxScore: number, fmt: DiaryFormat) {
  return fmt.scale ?? maxScore;
}

/** Converte (se for o caso) e arredonda a nota para o diário. */
export function diaryValue(score: number, maxScore: number, fmt: DiaryFormat) {
  const max = diaryMax(maxScore, fmt);
  const converted = fmt.scale && maxScore > 0 ? (score / maxScore) * fmt.scale : score;
  return Math.min(max, Math.max(0, roundTo(converted, fmt.step, fmt.rounding)));
}

export function formatNumber(n: number, fmt: Pick<DiaryFormat, "step" | "decimal">) {
  const s = n.toFixed(decimalsOf(fmt.step));
  return fmt.decimal === "," ? s.replace(".", ",") : s;
}

/** Nota "crua" da prova, sem zeros sobrando: 5 · 2,5 · 3,75. */
export function formatRaw(n: number, decimal: "," | "." = ",") {
  const s = String(Math.round(n * 100) / 100);
  return decimal === "," ? s.replace(".", ",") : s;
}

/** Texto exatamente como vai no diário. */
export function diaryText(score: number | null | undefined, maxScore: number, fmt: DiaryFormat) {
  if (score === null || score === undefined || !Number.isFinite(score)) return fmt.absent;
  return formatNumber(diaryValue(score, maxScore, fmt), fmt);
}

export function passes(value: number, max: number, fmt: DiaryFormat) {
  return value + EPS >= (max * fmt.passPercent) / 100;
}

export interface DiaryStudent {
  id: string;
  name: string;
  roll_number: number | null;
  registration?: string | null;
}

export function sortStudents<T extends DiaryStudent>(list: T[], order: StudentOrder) {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
  return [...list].sort((a, b) => {
    if (order === "alfabetica") return byName(a, b);
    const ra = a.roll_number ?? Number.MAX_SAFE_INTEGER;
    const rb = b.roll_number ?? Number.MAX_SAFE_INTEGER;
    return ra - rb || byName(a, b);
  });
}

/** Nome da escola como chave (sem espaços extras). "" = escola não informada. */
export function schoolKey(name: string | null | undefined) {
  return (name ?? "").replace(/\s+/g, " ").trim();
}

// ---------- notas da turma (várias avaliações) ----------

export type Combine = "soma" | "media";

export interface TermItem {
  score: number | null; // null = não fez
  max: number;
}

/**
 * Resultado de várias avaliações: soma dos pontos (até a soma dos valores)
 * ou média na escala do diário (padrão 10). Quem não fez conta 0.
 */
export function combineScores(items: TermItem[], combine: Combine, fmt: DiaryFormat) {
  const sumMax = items.reduce((a, i) => a + i.max, 0);
  const sum = items.reduce((a, i) => a + (i.score ?? 0), 0);
  if (combine === "soma") {
    return { value: Math.min(sumMax, roundTo(sum, fmt.step, fmt.rounding)), max: sumMax };
  }
  const scale = fmt.scale ?? 10;
  const v = sumMax > 0 ? (sum / sumMax) * scale : 0;
  return { value: Math.min(scale, roundTo(v, fmt.step, fmt.rounding)), max: scale };
}

// ---------- copiar / planilha ----------

/** Uma nota por linha, na ordem da lista — para colar direto na coluna do diário eletrônico. */
export function columnText(values: string[]) {
  return values.join("\n");
}

/** Linhas separadas por tabulação — coladas numa planilha, cada valor cai na sua coluna. */
export function tableText(rows: string[][]) {
  return rows.map((r) => r.map((c) => c.replace(/[\t\n]/g, " ")).join("\t")).join("\n");
}

/** CSV para Excel/Google Planilhas em português (ponto e vírgula + BOM para acentos). */
export function toCsv(rows: string[][]) {
  const esc = (c: string) => (/[";\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n") + "\r\n";
}
