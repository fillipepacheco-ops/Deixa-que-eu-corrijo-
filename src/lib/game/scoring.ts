/**
 * MODO GAME — regras de pontuação (iguais às da função submit_answer no banco).
 * Acertou: de 1000 (na hora) até 500 (no último segundo). Errou ou não respondeu: 0.
 */
export const MAX_POINTS = 1000;

export function speedPoints(correct: boolean, elapsedMs: number, limitSeconds: number): number {
  if (!correct) return 0;
  const frac = Math.min(1, Math.max(0, elapsedMs / (limitSeconds * 1000)));
  return Math.round(MAX_POINTS * (1 - frac / 2));
}

export function isCorrectAnswer(type: string, given: string | null | undefined, correct: string[]): boolean {
  if (!given) return false;
  if (type === "numeric") {
    if (!/^\d{1,3}$/.test(given.trim())) return false;
    return correct.some((c) => /^\d{1,3}$/.test(c) && Number(c) === Number(given.trim()));
  }
  return correct.some((c) => c.toUpperCase() === given.trim().toUpperCase());
}

export interface RankRow {
  id: string;
  name: string;
  score: number;
}

/** Ranking: mais pontos primeiro; empate fica com quem entrou antes (ordem original). */
export function ranking<T extends RankRow>(players: T[]): (T & { position: number })[] {
  const sorted = [...players].map((p, i) => ({ p, i })).sort((a, b) => b.p.score - a.p.score || a.i - b.i);
  let pos = 0;
  let last: number | null = null;
  return sorted.map(({ p }, k) => {
    if (p.score !== last) pos = k + 1;
    last = p.score;
    return { ...p, position: pos };
  });
}

/** PIN de 6 algarismos (sem começar com 0, para não confundir). */
export function newPin(rand: () => number = Math.random): string {
  return String(100000 + Math.floor(rand() * 900000));
}

/** Cores e formas das alternativas (estilo game show). */
export const OPTION_STYLES = [
  { bg: "#e21b3c", shape: "▲" },
  { bg: "#1368ce", shape: "◆" },
  { bg: "#d89e00", shape: "●" },
  { bg: "#26890c", shape: "■" },
  { bg: "#864cbf", shape: "★" },
] as const;
