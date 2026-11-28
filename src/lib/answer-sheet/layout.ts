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

// v2: bolhas menores (3,3 mm) · v3: Tipo B · v4: questões espalhadas pelas 4 colunas
// v5: agrupadas por tipo — certo/errado à esquerda, múltipla escolha (tipo C) e Tipo B à direita
export const LAYOUT_VERSION = 5;
/** Cartões impressos antes da v4 (as questões enchiam a coluna da esquerda primeiro). */
export const LEGACY_LAYOUT_VERSION = 3;
/** Desenho com que um cartão foi impresso (o banco guarda; antigos = 1 → v3). */
export const printedLayout = (v: number | null | undefined) => (!v || v < 4 ? 3 : v === 4 ? 4 : LAYOUT_VERSION);
const MAX_COLUMNS = 4;
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

/** Bolhas da VERSÃO DA PROVA (A–D) — o aluno pinta a versão que recebeu (cópias sem nome). */
export interface VersionBubble {
  version: number; // 0 = A
  label: string;
  x: number;
  y: number;
  r: number;
}

export const VERSION_BOX = { x: 116, y: 84, w: 34, h: 14 };
export function versionGridLayout(versions: number): VersionBubble[] {
  const n = Math.max(0, Math.min(4, Math.floor(versions)));
  if (n < 2) return [];
  return Array.from({ length: n }, (_, i) => ({ version: i, label: "ABCD"[i], x: 122 + i * 7, y: 93.3, r: 1.9 }));
}

export interface SheetLayout {
  version: number;
  fiducials: typeof FIDUCIALS;
  codeCells: CodeCell[];
  /** Células-guia sempre preenchidas nas pontas da faixa de código. */
  codeGuards: { x: number; y: number; size: number }[];
  rollBubbles: RollBubble[];
  /** Vazio quando a prova tem uma versão só. */
  versionBubbles: VersionBubble[];
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

/**
 * Linhas por coluna para espalhar as questões pelas 4 colunas de forma equilibrada
 * (o cartão fica harmônico, sem metade da folha vazia).
 */
export function balancedRows(needs: number[]): number {
  if (!needs.length) return ROWS_PER_COLUMN;
  const total = needs.reduce((a, b) => a + b, 0);
  const fits = (rows: number) => {
    let col = 0;
    let row = 0;
    for (const n of needs) {
      if (row + n > rows) {
        col++;
        row = 0;
      }
      row += n;
    }
    return col < MAX_COLUMNS;
  };
  let rows = Math.max(Math.max(...needs), Math.ceil(total / MAX_COLUMNS), Math.min(total, 5));
  while (rows < ROWS_PER_COLUMN && !fits(rows)) rows++;
  return Math.min(rows, ROWS_PER_COLUMN);
}

type Placement = { pos: Map<number, { col: number; row: number }>; cols: number };

/** v3 / v4: as questões descem pela coluna na ordem, um Tipo B passa inteiro para a próxima coluna. */
function sequentialPlacement(questions: SheetQuestionSpec[], rowsPerColumn: number): Placement {
  const pos = new Map<number, { col: number; row: number }>();
  let col = 0;
  let row = 0;
  for (const q of questions) {
    const need = q.numeric ? NUMERIC_ROWS : 1;
    if (row + need > rowsPerColumn) {
      col++;
      row = 0;
    }
    pos.set(q.number, { col, row });
    row += need;
  }
  return { pos, cols: questions.length ? col + 1 : 0 };
}

/**
 * v5: agrupadas por tipo, da esquerda para a direita — certo/errado, múltipla escolha e Tipo B —
 * com colunas da mesma altura sempre que dá. Null se não couber nas 4 colunas.
 */
function groupedPlacement(questions: SheetQuestionSpec[]): Placement | null {
  const byNum = (a: SheetQuestionSpec, b: SheetQuestionSpec) => a.number - b.number;
  const ce = questions.filter((q) => !q.numeric && q.certoErrado).sort(byNum);
  const mc = questions.filter((q) => !q.numeric && !q.certoErrado).sort(byNum);
  const nu = questions.filter((q) => q.numeric).sort(byNum);
  const heights = nu.length ? [NUMERIC_ROWS, 15, 18, ROWS_PER_COLUMN] : [10, 15, ROWS_PER_COLUMN];
  for (const h of heights) {
    const per = Math.max(1, Math.floor(h / NUMERIC_ROWS));
    const simpleCols = (n: number) => (n ? Math.ceil(n / h) : 0);
    const total = simpleCols(ce.length) + simpleCols(mc.length) + (nu.length ? Math.ceil(nu.length / per) : 0);
    if (total > MAX_COLUMNS) continue;
    const pos = new Map<number, { col: number; row: number }>();
    let col = 0;
    for (const group of [ce, mc]) {
      if (!group.length) continue;
      const cols = simpleCols(group.length);
      const rows = Math.ceil(group.length / cols); // colunas equilibradas
      group.forEach((q, i) => pos.set(q.number, { col: col + Math.floor(i / rows), row: i % rows }));
      col += cols;
    }
    nu.forEach((q, i) => pos.set(q.number, { col: col + Math.floor(i / per), row: (i % per) * NUMERIC_ROWS }));
    if (nu.length) col += Math.ceil(nu.length / per);
    return { pos, cols: col };
  }
  return null;
}

export function sheetLayout(questions: SheetQuestionSpec[], opts: { versions?: number; legacy?: boolean; layoutVersion?: number } = {}): SheetLayout {
  const layoutVersion = opts.legacy ? LEGACY_LAYOUT_VERSION : (opts.layoutVersion ?? LAYOUT_VERSION);
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

  // v3: enche a coluna da esquerda primeiro · v4: colunas equilibradas na ordem
  // v5: agrupadas por tipo (certo/errado | múltipla escolha | Tipo B); se não couber, cai na v4.
  const needs = questions.map((q) => (q.numeric ? NUMERIC_ROWS : 1));
  const placement =
    layoutVersion <= LEGACY_LAYOUT_VERSION
      ? sequentialPlacement(questions, ROWS_PER_COLUMN)
      : ((layoutVersion >= 5 ? groupedPlacement(questions) : null) ?? sequentialPlacement(questions, balancedRows(needs)));
  const usedCols = Math.max(1, placement.cols);
  const gridLeft =
    layoutVersion <= LEGACY_LAYOUT_VERSION ? GRID_LEFT : GRID_LEFT + ((MAX_COLUMNS - Math.min(usedCols, MAX_COLUMNS)) * COLUMN_PITCH) / 2;
  const mcColumns = new Set<number>();
  for (const q of questions) {
    const { col, row } = placement.pos.get(q.number)!;
    const baseX = gridLeft + col * COLUMN_PITCH;
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
  }
  const columns = questions.length ? usedCols : 0;
  // Cabeçalho A–E só para múltipla escolha (certo/errado e Tipo B levam a letra dentro da bolha).
  const mcMax = Math.max(0, ...questions.filter((q) => !q.certoErrado && !q.numeric).map((q) => q.labels.length));
  const headerLabels = "ABCDE".slice(0, mcMax).split("");
  for (let c = 0; c < columns; c++) {
    if (!mcColumns.has(c)) continue;
    headerLabels.forEach((label, j) =>
      columnHeaders.push({ label, x: gridLeft + c * COLUMN_PITCH + 9 + j * OPTION_PITCH, y: GRID_TOP - 7 }),
    );
  }

  const { cells, guards } = codeCellsLayout();
  return {
    version: layoutVersion,
    fiducials: FIDUCIALS,
    codeCells: cells,
    codeGuards: guards,
    rollBubbles: rollGridLayout(),
    versionBubbles: versionGridLayout(opts.versions ?? 1),
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
