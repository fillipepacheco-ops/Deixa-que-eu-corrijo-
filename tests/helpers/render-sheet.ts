/**
 * Simula a FOTO de um cartão-resposta preenchido (sem câmera):
 * desenha a geometria do cartão em perspectiva, com fundo de mesa, papel
 * levemente acinzentado, ruído e marcações de caneta (cheias, fracas ou rasuradas).
 */
import { encodeSheetNumber } from "../../src/lib/answer-sheet/code";
import { FIDUCIAL_SIZE, FIDUCIALS, PAGE_H, PAGE_W, sheetLayout, type SheetQuestionSpec } from "../../src/lib/answer-sheet/layout";
import { applyHomography, computeHomography, type Point } from "../../src/lib/omr/homography";
import type { GrayImage } from "../../src/lib/omr/reader";

export interface RenderOptions {
  questions: SheetQuestionSpec[];
  sheetNumber: number;
  /** marcações: { 1: "B", 2: ["A","C"] } */
  marks: Record<number, string | string[]>;
  /** marcações fracas (meio apagadas): mesmo formato */
  faintMarks?: Record<number, string>;
  roll?: number;
  /** versões da prova no cartão e a que o aluno pintou (0 = A) */
  versions?: number;
  version?: number | number[];
  width?: number;
  height?: number;
  /** Onde os cantos da FOLHA (0,0)-(210,297) aparecem na foto, em px. */
  pageCorners?: Point[];
  noise?: number;
  paper?: number; // cinza do papel (iluminação)
  ink?: number; // cinza da caneta
  seed?: number;
}

export function renderSheetPhoto(o: RenderOptions): GrayImage {
  const W = o.width ?? 900;
  const H = o.height ?? 1250;
  const corners = o.pageCorners ?? [
    { x: 40, y: 40 }, { x: W - 40, y: 40 }, { x: W - 40, y: H - 40 }, { x: 40, y: H - 40 },
  ];
  const pageMm = [{ x: 0, y: 0 }, { x: PAGE_W, y: 0 }, { x: PAGE_W, y: PAGE_H }, { x: 0, y: PAGE_H }];
  const toMm = computeHomography(corners, pageMm); // pixel → mm
  const layout = sheetLayout(o.questions, { versions: o.versions });
  const bits = encodeSheetNumber(o.sheetNumber);
  const paper = o.paper ?? 225;
  const ink = o.ink ?? 45;
  let seed = o.seed ?? 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const noise = o.noise ?? 12;

  const marked = new Set<string>();
  for (const [q, v] of Object.entries(o.marks)) for (const l of [v].flat()) marked.add(`${q}:${l}`);
  const faint = new Set<string>(Object.entries(o.faintMarks ?? {}).map(([q, l]) => `${q}:${l}`));
  for (const v of o.version === undefined ? [] : [o.version].flat()) marked.add(`ver:${v}`);
  if (o.roll !== undefined) {
    marked.add(`roll0:${Math.floor(o.roll / 10)}`);
    marked.add(`roll1:${o.roll % 10}`);
  }

  const squares = [
    ...FIDUCIALS.map((f) => ({ x: f.x, y: f.y, s: FIDUCIAL_SIZE })),
    ...layout.codeGuards.map((g) => ({ x: g.x, y: g.y, s: g.size })),
    ...layout.codeCells.filter((c) => bits[c.bit]).map((c) => ({ x: c.x, y: c.y, s: c.size })),
  ];
  const circles = [
    ...layout.bubbles.map((b) => ({ x: b.x, y: b.y, r: b.r, key: `${b.question}:${b.label}` })),
    ...layout.rollBubbles.map((b) => ({ x: b.x, y: b.y, r: b.r, key: `roll${b.digit}:${b.value}` })),
    ...layout.versionBubbles.map((b) => ({ x: b.x, y: b.y, r: b.r, key: `ver:${b.version}` })),
  ];

  const data = new Uint8Array(W * H);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const p = applyHomography(toMm, { x: px, y: py });
      let g: number;
      if (p.x < 0 || p.y < 0 || p.x > PAGE_W || p.y > PAGE_H) {
        g = 110; // mesa
      } else {
        g = paper - (p.x / PAGE_W) * 25; // sombra leve de um lado
        for (const s of squares) {
          if (Math.abs(p.x - s.x) <= s.s / 2 && Math.abs(p.y - s.y) <= s.s / 2) g = 20;
        }
        for (const c of circles) {
          const d = Math.hypot(p.x - c.x, p.y - c.y);
          if (d > c.r + 0.3) continue;
          if (marked.has(c.key) && d <= c.r * 0.95) g = ink;
          else if (faint.has(c.key) && d <= c.r * 0.95) g = 160;
          else if (Math.abs(d - c.r) <= 0.15) g = 60; // contorno
        }
      }
      g += (rand() - 0.5) * 2 * noise;
      data[py * W + px] = Math.max(0, Math.min(255, Math.round(g)));
    }
  }
  return { width: W, height: H, data };
}
