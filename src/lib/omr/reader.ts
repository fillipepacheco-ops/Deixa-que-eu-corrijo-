/**
 * LEITURA DO CARTÃO-RESPOSTA PELA FOTO (OMR) — roda no próprio celular.
 *
 * 1. Encontra os 4 quadrados pretos dos cantos.
 * 2. Calcula a perspectiva (foto torta/inclinada vira cartão "plano").
 * 3. Lê a faixa de código (número do cartão + CRC → aluno e avaliação).
 * 4. Mede o preenchimento de cada bolha, calibrado pela própria foto
 *    (branco do papel e preto da impressão), para funcionar com luz ruim.
 * 5. Classifica: marcada, em branco, dupla marcação ou INCERTA.
 *    Incerta = o professor confirma; nunca vira nota sozinha.
 */
import { decodeSheetNumber } from "@/lib/answer-sheet/code";
import { FIDUCIALS, sheetLayout, type SheetQuestionSpec } from "@/lib/answer-sheet/layout";
import { MULTIPLE_MARKS, UNCERTAIN } from "@/lib/grading/grading";
import { applyHomography, computeHomography, type Homography, type Point } from "./homography";

export interface GrayImage {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray; // 1 byte por pixel, 0 = preto
}

/** Limiares de preenchimento (0 = papel, 1 = preto impresso). */
export const MARKED_MIN = 0.5;
export const EMPTY_MAX = 0.25;

export interface QuestionRead {
  number: number;
  answer: string | null; // letra, null (branco), "*" (dupla) ou "?" (incerta)
  fills: Record<string, number>;
  confidence: number; // 0–1
}

export interface ReadResult {
  ok: boolean;
  error?: string;
  sheetNumber: number | null;
  rollNumber: number | null;
  /** Versão pintada pelo aluno (0 = A); null = nenhuma, mais de uma ou duvidosa (ver versionMark). */
  examVersion?: number | null;
  versionMark?: "none" | "ok" | "multiple" | "uncertain" | "n/a";
  answers: Record<number, string | null>;
  questions: QuestionRead[];
  problems: string[];
  /** Cantos encontrados na foto (para desenhar o enquadramento na tela). */
  corners?: Point[];
  /** Transformação mm do cartão → pixel da foto (para desenhar a correção). */
  homography?: Homography;
}

/**
 * Tipo B: um algarismo por coluna (C, D, U) → "042".
 * Tudo em branco = null; duas marcas na mesma coluna = "*"; coluna sem marca = "_".
 */
export function numericAnswer(marked: string[]): string | null {
  if (!marked.length) return null;
  let out = "";
  for (const p of ["C", "D", "U"]) {
    const m = marked.filter((l) => l[0] === p);
    if (m.length > 1) return MULTIPLE_MARKS;
    out += m.length ? m[0].slice(1) : "_";
  }
  return out;
}

/** Converte RGBA (canvas) em tons de cinza. */
export function toGray(rgba: Uint8ClampedArray, width: number, height: number): GrayImage {
  const data = new Uint8Array(width * height);
  for (let i = 0, j = 0; j < data.length; i += 4, j++) {
    data[j] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
  }
  return { width, height, data };
}

function otsu(img: GrayImage): number {
  const hist = new Array(256).fill(0) as number[];
  for (let i = 0; i < img.data.length; i++) hist[img.data[i]]++;
  const total = img.data.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

interface Blob {
  area: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
  touchesBorder: boolean;
}

function findDarkBlobs(img: GrayImage, threshold: number): Blob[] {
  const { width: W, height: H, data } = img;
  const labels = new Int32Array(W * H);
  const stack = new Int32Array(W * H);
  const blobs: Blob[] = [];
  let next = 1;
  for (let start = 0; start < W * H; start++) {
    if (labels[start] || data[start] >= threshold) continue;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = next;
    let area = 0, sx = 0, sy = 0, minX = W, maxX = 0, minY = H, maxY = 0;
    while (sp) {
      const p = stack[--sp];
      const x = p % W;
      const y = (p - x) / W;
      area++; sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
      for (const q of nb) {
        if (q >= 0 && !labels[q] && data[q] < threshold) {
          labels[q] = next;
          stack[sp++] = q;
        }
      }
    }
    blobs.push({
      area, cx: sx / area, cy: sy / area, w: maxX - minX + 1, h: maxY - minY + 1,
      touchesBorder: minX === 0 || minY === 0 || maxX === W - 1 || maxY === H - 1,
    });
    next++;
  }
  return blobs;
}

/** Acha os 4 marcadores: blocos sólidos, quadrados e grandes, nos extremos. */
export function findFiducials(img: GrayImage): Point[] | null {
  const t = otsu(img);
  const minSide = Math.max(6, Math.min(img.width, img.height) * 0.012);
  const candidates = findDarkBlobs(img, t)
    .filter((b) => !b.touchesBorder && b.w >= minSide && b.h >= minSide)
    .filter((b) => b.w / b.h > 0.6 && b.w / b.h < 1.67 && b.area / (b.w * b.h) > 0.6)
    .sort((a, b) => b.area - a.area)
    .slice(0, 12);
  if (candidates.length < 4) return null;
  const ref = candidates[3].area;
  const big = candidates.filter((b) => b.area >= ref * 0.4 && b.area <= ref * 2.5);
  const pts = big.map((b) => ({ x: b.cx, y: b.cy }));
  const pick = (f: (p: Point) => number) => pts.reduce((best, p) => (f(p) > f(best) ? p : best));
  const tl = pick((p) => -(p.x + p.y));
  const tr = pick((p) => p.x - p.y);
  const br = pick((p) => p.x + p.y);
  const bl = pick((p) => p.y - p.x);
  const set = new Set([tl, tr, br, bl]);
  if (set.size !== 4) return null;
  return plausibleCard([tl, tr, br, bl]) ? [tl, tr, br, bl] : null;
}

/** Os 4 marcadores formam um retângulo parecido com o do cartão (mesmo inclinado)? */
function plausibleCard([tl, tr, br, bl]: Point[]): boolean {
  const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const top = d(tl, tr);
  const bottom = d(bl, br);
  const left = d(tl, bl);
  const right = d(tr, br);
  if (Math.min(top, bottom, left, right) < 40) return false;
  // perspectiva razoável: lados opostos parecidos
  if (Math.max(top, bottom) / Math.min(top, bottom) > 1.6) return false;
  if (Math.max(left, right) / Math.min(left, right) > 1.6) return false;
  // proporção entre marcadores no cartão: 269 mm / 182 mm ≈ 1,48
  const ratio = (left + right) / (top + bottom);
  if (ratio < 1.05 || ratio > 2.1) return false;
  // convexo (sem "cruzar" os cantos)
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const signs = [cross(tl, tr, br), cross(tr, br, bl), cross(br, bl, tl), cross(bl, tl, tr)].map(Math.sign);
  return signs.every((s) => s === signs[0]);
}

function sampleGray(img: GrayImage, p: Point): number {
  const x = Math.min(img.width - 1, Math.max(0, Math.round(p.x)));
  const y = Math.min(img.height - 1, Math.max(0, Math.round(p.y)));
  return img.data[y * img.width + x];
}

/** Média de cinza num disco (em mm do cartão) mapeado para a foto. */
function meanGrayDisc(img: GrayImage, h: Homography, cx: number, cy: number, r: number): number {
  const steps = 7;
  let sum = 0, n = 0;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const dx = ((i / (steps - 1)) * 2 - 1) * r;
      const dy = ((j / (steps - 1)) * 2 - 1) * r;
      if (dx * dx + dy * dy > r * r) continue;
      sum += sampleGray(img, applyHomography(h, { x: cx + dx, y: cy + dy }));
      n++;
    }
  }
  return sum / n;
}

export function readAnswerSheet(img: GrayImage, questions: SheetQuestionSpec[], opts: { versions?: number } = {}): ReadResult {
  const empty: ReadResult = { ok: false, sheetNumber: null, rollNumber: null, answers: {}, questions: [], problems: [] };
  const corners = findFiducials(img);
  if (!corners) {
    return { ...empty, error: "Não encontrei os 4 quadrados pretos dos cantos. Enquadre o cartão inteiro, com boa luz." };
  }

  const layout = sheetLayout(questions, opts);
  const H = computeHomography(FIDUCIALS.map((f) => ({ x: f.x, y: f.y })), corners);

  // Calibração: preto impresso (guias do código) e branco do papel.
  const black = layout.codeGuards.reduce((s, g) => s + meanGrayDisc(img, H, g.x, g.y, g.size * 0.3), 0) / layout.codeGuards.length;
  const paperPoints = [30, 70, 110, 150, 185].map((x) => ({ x, y: 272 }));
  const white = paperPoints.reduce((s, p) => s + meanGrayDisc(img, H, p.x, p.y, 1.5), 0) / paperPoints.length;
  if (white - black < 40) {
    return { ...empty, corners, error: "Foto com pouco contraste. Procure um lugar mais iluminado e evite sombra sobre o cartão." };
  }
  const fill = (g: number) => Math.min(1, Math.max(0, (white - g) / (white - black)));

  // Código do cartão.
  const bits: number[] = [];
  let codeUncertain = false;
  for (const c of layout.codeCells) {
    const f = fill(meanGrayDisc(img, H, c.x, c.y, c.size * 0.3));
    if (f >= MARKED_MIN) bits.push(1);
    else if (f <= EMPTY_MAX) bits.push(0);
    else { bits.push(0); codeUncertain = true; }
  }
  const sheetNumber = codeUncertain ? null : decodeSheetNumber(bits);
  const problems: string[] = [];
  if (sheetNumber === null) problems.push("Não consegui ler o código do cartão (faixa superior). Selecione o aluno manualmente.");

  // Nº de chamada (cartões em branco).
  let rollNumber: number | null = null;
  const digits: (number | null)[] = [0, 1].map((d) => {
    const marked = layout.rollBubbles
      .filter((b) => b.digit === d)
      .map((b) => ({ v: b.value, f: fill(meanGrayDisc(img, H, b.x, b.y, b.r * 0.6)) }))
      .filter((b) => b.f >= MARKED_MIN);
    return marked.length === 1 ? marked[0].v : null;
  });
  if (digits[0] !== null && digits[1] !== null) rollNumber = digits[0] * 10 + digits[1];

  // Versão da prova pintada pelo aluno.
  let examVersion: number | null = null;
  let versionMark: ReadResult["versionMark"] = "n/a";
  if (layout.versionBubbles.length) {
    const vf = layout.versionBubbles.map((b) => ({ v: b.version, f: fill(meanGrayDisc(img, H, b.x, b.y, b.r * 0.6)) }));
    const marked = vf.filter((b) => b.f >= MARKED_MIN);
    const doubtful = vf.filter((b) => b.f > EMPTY_MAX && b.f < MARKED_MIN);
    if (doubtful.length) versionMark = "uncertain";
    else if (marked.length === 1) {
      versionMark = "ok";
      examVersion = marked[0].v;
    } else versionMark = marked.length ? "multiple" : "none";
  }

  // Bolhas.
  const reads: QuestionRead[] = [];
  const answers: Record<number, string | null> = {};
  for (const q of questions) {
    const fills: Record<string, number> = {};
    for (const b of layout.bubbles.filter((x) => x.question === q.number)) {
      fills[b.label] = Math.round(fill(meanGrayDisc(img, H, b.x, b.y, b.r * 0.6)) * 100) / 100;
    }
    const values = Object.entries(fills);
    const marked = values.filter(([, f]) => f >= MARKED_MIN).map(([l]) => l);
    const doubtful = values.filter(([, f]) => f > EMPTY_MAX && f < MARKED_MIN);

    let answer: string | null;
    if (doubtful.length > 0) answer = UNCERTAIN;
    else if (q.numeric) answer = numericAnswer(marked);
    else if (marked.length === 0) answer = null;
    else if (marked.length === 1) answer = marked[0];
    else answer = MULTIPLE_MARKS;

    // Confiança: distância do valor mais próximo da zona de dúvida.
    const margin = Math.min(
      ...values.map(([, f]) => (f >= MARKED_MIN ? f - MARKED_MIN : f <= EMPTY_MAX ? EMPTY_MAX - f : 0)),
    );
    const confidence = answer === UNCERTAIN ? 0 : Math.min(1, margin / 0.25);
    if (answer === UNCERTAIN) problems.push(`Não foi possível identificar com segurança a questão ${q.number}.`);

    answers[q.number] = answer;
    reads.push({ number: q.number, answer, fills, confidence: Math.round(confidence * 100) / 100 });
  }

  return { ok: true, sheetNumber, rollNumber, examVersion, versionMark, answers, questions: reads, problems, corners, homography: H };
}
