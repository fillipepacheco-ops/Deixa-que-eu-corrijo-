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

export const LAYOUT_VERSION = 1;
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
const ROW_PITCH = 8; // mm entre linhas
const OPTION_PITCH = 7; // mm entre bolhas
const BUBBLE_R = 2.3; // raio da bolha
const GRID_TOP = 112; // y do centro da 1ª linha
const GRID_LEFT = 24; // x do centro do número da 1ª coluna
const COLUMN_PITCH = 45;

export interface SheetQuestionSpec {
  number: number; // número da questão na prova
  labels: string[]; // ["A","B","C","D"] ou ["C","E"] (certo ou errado)
  /** Questão certo/errado: a letra vai dentro da bolha. */
  certoErrado?: boolean;
}

export interface Bubble {
  question: number;
  label: string;
  x: number;
  y: number;
  r: number;
  /** Letra impressa dentro da bolha (questões certo/errado). */
  inner?: boolean;
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
      out.push({ digit: d, value: v, x: left + d * 7 + 7, y: top + v * 4.6, r: 1.8 });
    }
  }
  return out;
}

export function sheetLayout(questions: SheetQuestionSpec[]): SheetLayout {
  if (questions.length > MAX_QUESTIONS) {
    throw new Error(`O cartão-resposta comporta até ${MAX_QUESTIONS} questões objetivas.`);
  }
  const bubbles: Bubble[] = [];
  const questionLabels: SheetLayout["questionLabels"] = [];
  const columnHeaders: SheetLayout["columnHeaders"] = [];
  const maxLabels = Math.max(0, ...questions.map((q) => q.labels.length));
  if (maxLabels > MAX_OPTIONS) throw new Error(`Máximo de ${MAX_OPTIONS} alternativas por questão.`);

  questions.forEach((q, i) => {
    const col = Math.floor(i / ROWS_PER_COLUMN);
    const row = i % ROWS_PER_COLUMN;
    const baseX = GRID_LEFT + col * COLUMN_PITCH;
    const y = GRID_TOP + row * ROW_PITCH;
    questionLabels.push({ number: q.number, x: baseX, y });
    q.labels.forEach((label, j) => {
      bubbles.push({ question: q.number, label, x: baseX + 9 + j * OPTION_PITCH, y, r: BUBBLE_R, inner: q.certoErrado });
    });
  });

  const columns = Math.ceil(questions.length / ROWS_PER_COLUMN);
  // Cabeçalho A–E só para múltipla escolha (certo/errado leva a letra dentro da bolha).
  const mcMax = Math.max(0, ...questions.filter((q) => !q.certoErrado).map((q) => q.labels.length));
  const headerLabels = "ABCDE".slice(0, mcMax).split("");
  for (let c = 0; c < columns; c++) {
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
    bubbleRadius: BUBBLE_R,
  };
}

/** Questões que vão para o cartão: só as objetivas (múltipla escolha e certo/errado). */
export function sheetQuestionsFrom(
  questions: { position: number; type: string; options: { label: string }[] }[],
): SheetQuestionSpec[] {
  return questions
    .filter((q) => q.type === "multiple_choice" || q.type === "true_false")
    .sort((a, b) => a.position - b.position)
    .map((q) => ({
      number: q.position,
      labels: q.type === "true_false" ? ["C", "E"] : q.options.map((o) => o.label),
      ...(q.type === "true_false" ? { certoErrado: true } : {}),
    }));
}
