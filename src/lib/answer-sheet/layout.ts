/**
 * GEOMETRIA DO CARTÃO-RESPOSTA — fonte única de verdade.
 *
 * O gerador de PDF desenha exatamente estas posições e o leitor por câmera
 * mede exatamente as mesmas posições (depois de alinhar a foto pelos 4
 * marcadores dos cantos). Qualquer mudança aqui exige nova LAYOUT_VERSION.
 *
 * Unidades: milímetros, origem no canto SUPERIOR esquerdo de uma folha A4.
 */
import { CODE_TOTAL_BITS } from "./code";

export const LAYOUT_VERSION = 3; // v2: bolhas menores (3,3 mm) · v3: Tipo B (centena/dezena/unidade)
export const PAGE_W = 210;
export const PAGE_H = 297;

/** Centro dos marcadores (quadrados pretos) — sentido: TL, TR, BR, BL. */
export const FIDUCIAL_SIZE = 8;
export const FIDUCIALS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 14, y: 14 },
  { x: 196, y: 14 },
  { x: 196, y: 283 },
  { x: 14, y: 283 },
];

export const MAX_QUESTIONS = 80;
export const MAX_OPTIONS = 5;
const ROWS_PER_COLUMN = 20;
const ROW_PITCH = 6.5; // mm entre linhas
const OPTION_PITCH = 5.5; // mm entre bolhas
const BUBBLE_R = 1.65; // raio da bolha (3,3 mm de diâmetro, tamanho usual de cartão)
const GRID_TOP = 112; // y do centro da 1ª linha
const GRID_LEFT = 24; // x do centro do número da 1ª coluna
const COLUMN_PITCH = 45;

export interface SheetQuestionSpec {
  number: number; // número da questão na prova
  labels: string[]; // ["A","B","C","D"] ou ["C","E"] (certo ou errado)
  /** Questão certo/errado: a letra vai dentro da bolha. */
  certoErrado?: boolean;
  /** Tipo B (PAS): três colunas C/D/U com os algarismos 0–9; rótulos "C0".."U9". */
  numeric?: boolean;
}

/** Linhas da grade que um bloco do Tipo B ocupa (cabeçalho C D U + 10 algarismos). */
export const NUMERIC_ROWS = 9;
const NUMERIC_PITCH = 4.9; // mm entre os algarismos
export const NUMERIC_LABELS = ["C", "D", "U"].flatMap((p) => Array.from({ length: 10 }, (_, v) => `${p}${v}`));

/** "42" → ["C0","D4","U2"] (bolhas da resposta certa). */
export function numericBubbleLabels(value: string): string[] {
  const t = value.replace(/\D/g, "");
  if (!t || t.length > 3) return [];
  const d = t.padStart(3, "0");
  return [`C${d[0]}`, `D${d[1]}`, `U${d[2]}`];
}

export interface Bubble {
  question: number;
  label: string;
  x: number;
  y: number;
  r: number;
  /** Letra impressa dentro da bolha (questões certo/errado e Tipo B). */
  inner?: boolean;
  /** Texto dentro da bolha, quando diferente do rótulo (Tipo B: o algarismo). */
  text?: string;
}

export interface CodeCell {
  bit: number; // índice 0..31
  x: number;
  y: number;
  size: number;
}

export interface RollBubble {
  digit: 0 | 1; // 0 = dezena, 1 = unidade
  value: number; // 0..9
  x: number;
  y: number;
  r: number;
}

export interface SheetLayout {
  version: number;
  fiducials: typeof FIDUCIALS;
  codeCells: CodeCell[];
  /** Células-guia sempre preenchidas nas pontas da faixa de código. */
  codeGuards: { x: number; y: number; size: number }[];
  rollBubbles: RollBubble[];
  bubbles: Bubble[];
  questionLabels: { number: number; x: number; y: number }[];
  columnHeaders: { label: string; x: number; y: number }[];
  /** Letras C D U em cima de cada bloco do Tipo B. */
  blockHeaders: { label: string; x: number; y: number }[];
  bubbleRadius: number;
}

const CODE_Y = 14;
const CODE_CELL = 3.4;
const CODE_PITCH = 4.6;

export function codeCellsLayout() {
  const total = CODE_TOTAL_BITS + 2; // + 2 guias
  const width = (total - 1) * CODE_PITCH;
  const startX = PAGE_W / 2 - width / 2;
  const cells: CodeCell[] = [];
  const guards = [
    { x: startX, y: CODE_Y, size: CODE_CELL },
    { x: startX + (total - 1) * CODE_PITCH, y: CODE_Y, size: CODE_CELL },
  ];
  for (let i = 0; i < CODE_TOTAL_BITS; i++) {
    cells.push({ bit: i, x: startX + (i + 1) * CODE_PITCH, y: CODE_Y, size: CODE_CELL });
  }
  return { cells, guards };
}

/** Grade do nº de chamada (00–99) para cartões em branco. */
export function rollGridLayout(): RollBubble[] {
  const out: RollBubble[] = [];
  const left = 158;
  const top = 58;
  for (const d of [0, 1] as const) {
    for (let v = 0; v <= 9; v++) {
      out.push({ digit: d, value: v, x: left + d * 6 + 7, y: top + v * 4.2, r: 1.5 });
    }
  }
  return out;
}

export function sheetLayout(questions: SheetQuestionSpec[]): SheetLayout {
  const units = questions.reduce((n, q) => n + (q.numeric ? NUMERIC_ROWS : 1), 0);
  if (questions.length > MAX_QUESTIONS || units > MAX_QUESTIONS) {
    throw new Error(
      questions.some((q) => q.numeric)
        ? `O cartão-resposta não comporta tantas questões (cada Tipo B ocupa o espaço de ${NUMERIC_ROWS}). Divida a prova ou reduza as questões.`
        : `O cartão-resposta comporta até ${MAX_QUESTIONS} questões objetivas.`,
    );
  }
  const bubbles: Bubble[] = [];
  const questionLabels: SheetLayout["questionLabels"] = [];
  const columnHeaders: SheetLayout["columnHeaders"] = [];
  const blockHeaders: SheetLayout["blockHeaders"] = [];
  const maxLabels = Math.max(0, ...questions.filter((q) => !q.numeric).map((q) => q.labels.length));
  if (maxLabels > MAX_OPTIONS) throw new Error(`Máximo de ${MAX_OPTIONS} alternativas por questão.`);

  // As questões descem pela coluna; um bloco do Tipo B ocupa NUMERIC_ROWS linhas
  // e passa inteiro para a próxima coluna se não couber.
  let col = 0;
  let row = 0;
  const mcColumns = new Set<number>();
  for (const q of questions) {
    const need = q.numeric ? NUMERIC_ROWS : 1;
    if (row + need > ROWS_PER_COLUMN) {
      col++;
      row = 0;
    }
    const baseX = GRID_LEFT + col * COLUMN_PITCH;
    const y = GRID_TOP + row * ROW_PITCH;
    questionLabels.push({ number: q.number, x: baseX, y });
    if (q.numeric) {
      ["C", "D", "U"].forEach((p, j) => {
        const x = baseX + 9 + j * OPTION_PITCH;
        blockHeaders.push({ label: p, x, y });
        for (let v = 0; v <= 9; v++) {
          bubbles.push({ question: q.number, label: `${p}${v}`, text: String(v), x, y: y + 5 + v * NUMERIC_PITCH, r: BUBBLE_R, inner: true });
        }
      });
    } else {
      if (!q.certoErrado) mcColumns.add(col);
      q.labels.forEach((label, j) => {
        bubbles.push({ question: q.number, label, x: baseX + 9 + j * OPTION_PITCH, y, r: BUBBLE_R, inner: q.certoErrado });
      });
    }
    row += need;
  }
  const usedColumns = col + 1;

  const columns = questions.length ? usedColumns : 0;
  // Cabeçalho A–E só para múltipla escolha (certo/errado e Tipo B levam a letra dentro da bolha).
  const mcMax = Math.max(0, ...questions.filter((q) => !q.certoErrado && !q.numeric).map((q) => q.labels.length));
  const headerLabels = "ABCDE".slice(0, mcMax).split("");
  for (let c = 0; c < columns; c++) {
    if (!mcColumns.has(c)) continue;
    headerLabels.forEach((label, j) =>
      columnHeaders.push({ label, x: GRID_LEFT + c * COLUMN_PITCH + 9 + j * OPTION_PITCH, y: GRID_TOP - 7 }),
    );
  }

  const { cells, guards } = codeCellsLayout();
  return {
    version: LAYOUT_VERSION,
    fiducials: FIDUCIALS,
    codeCells: cells,
    codeGuards: guards,
    rollBubbles: rollGridLayout(),
    bubbles,
    questionLabels,
    columnHeaders,
    blockHeaders,
    bubbleRadius: BUBBLE_R,
  };
}

/** Questões que vão para o cartão: as objetivas (múltipla escolha, certo/errado e Tipo B). */
export function sheetQuestionsFrom(
  questions: { position: number; type: string; options: { label: string }[] }[],
): SheetQuestionSpec[] {
  return questions
    .filter((q) => q.type === "multiple_choice" || q.type === "true_false" || q.type === "numeric")
    .sort((a, b) => a.position - b.position)
    .map((q) => ({
      number: q.position,
      labels: q.type === "true_false" ? ["C", "E"] : q.type === "numeric" ? NUMERIC_LABELS : q.options.map((o) => o.label),
      ...(q.type === "true_false" ? { certoErrado: true } : {}),
      ...(q.type === "numeric" ? { numeric: true } : {}),
    }));
}
