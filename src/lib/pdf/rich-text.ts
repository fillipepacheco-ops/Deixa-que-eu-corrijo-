/**
 * TEXTO COM FÓRMULAS NO PDF — expoente, índice, fração, raiz e símbolos
 * matemáticos (π, ≤, ≥, ≠, √, θ, ∞, ∈ ...) com quebra de linha e justificação.
 *
 * Caracteres que a Helvetica (Arial) não tem são desenhados com a fonte
 * Symbol padrão do PDF, então nada vira "?" na prova.
 */
import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { parseMath, type MathNode } from "@/lib/math/parse";
import { A4, BRAND, fallbackChar } from "./common";

export interface RichFonts {
  regular: PDFFont;
  symbol: PDFFont;
}

type Color = ReturnType<typeof rgb>;

interface Box {
  w: number;
  asc: number;
  desc: number;
  /** y = linha de base, em coordenadas do PDF (de baixo para cima). */
  draw: (page: PDFPage, x: number, y: number) => void;
}

const FALLBACK: Record<string, string> = {
  "ℕ": "N", "ℤ": "Z", "ℚ": "Q", "ℝ": "R", "ℂ": "C", "∓": "-/+", "△": "Δ", "∥": "//", "→": "->",
  " ": " ", "\t": "    ", "–": "-", "—": "-",
};

const charsets = new WeakMap<PDFFont, Set<number>>();
function has(font: PDFFont, ch: string) {
  let set = charsets.get(font);
  if (!set) {
    set = new Set(font.getCharacterSet());
    charsets.set(font, set);
  }
  return set.has(ch.codePointAt(0)!);
}

/** Divide o texto em trechos por fonte (Helvetica ou Symbol). */
function runs(text: string, fonts: RichFonts): { font: PDFFont; s: string }[] {
  const out: { font: PDFFont; s: string }[] = [];
  for (const raw of text.normalize("NFC")) {
    let ch = raw;
    let font = fonts.regular;
    if (!has(fonts.regular, ch)) {
      if (has(fonts.symbol, ch)) font = fonts.symbol;
      else {
        ch = FALLBACK[ch] ?? fallbackChar(ch, (c) => has(fonts.regular, c));
        if (ch.length === 1 && !has(fonts.regular, ch)) ch = "?";
        if (!ch) continue;
      }
    }
    const last = out[out.length - 1];
    if (last && last.font === font) last.s += ch;
    else out.push({ font, s: ch });
  }
  return out;
}

function textBox(text: string, size: number, fonts: RichFonts, color: Color): Box {
  const rs = runs(text, fonts);
  // Símbolos (fonte Symbol) ganham um respiro dos dois lados: "π ≈ 3,14".
  const pad = size * 0.06;
  const widths = rs.map((r) => r.font.widthOfTextAtSize(r.s, size) + (r.font === fonts.symbol ? 2 * pad : 0));
  return {
    w: widths.reduce((a, b) => a + b, 0),
    asc: size * 0.75,
    desc: size * 0.21,
    draw: (page, x, y) => {
      let cx = x;
      rs.forEach((r, i) => {
        const dx = r.font === fonts.symbol ? pad : 0;
        if (r.s.trim()) page.drawText(r.s, { x: cx + dx, y, size, font: r.font, color });
        cx += widths[i];
      });
    },
  };
}

function hbox(boxes: Box[]): Box {
  return {
    w: boxes.reduce((s, b) => s + b.w, 0),
    asc: Math.max(0, ...boxes.map((b) => b.asc)),
    desc: Math.max(0, ...boxes.map((b) => b.desc)),
    draw: (page, x, y) => {
      let cx = x;
      for (const b of boxes) {
        b.draw(page, cx, y);
        cx += b.w;
      }
    },
  };
}

function nodeBox(n: MathNode, size: number, fonts: RichFonts, color: Color): Box {
  const seq = (nodes: MathNode[], s: number) => hbox(nodes.map((k) => nodeBox(k, s, fonts, color)));
  switch (n.t) {
    case "text":
      return textBox(n.s, size, fonts, color);
    case "sup": {
      const base = seq(n.base, size);
      const exp = seq(n.exp, size * 0.7);
      const raise = Math.max(size * 0.38, base.asc - exp.asc * 0.55);
      return {
        w: base.w + exp.w + size * 0.04,
        asc: Math.max(base.asc, raise + exp.asc),
        desc: base.desc,
        draw: (page, x, y) => {
          base.draw(page, x, y);
          exp.draw(page, x + base.w + size * 0.02, y + raise);
        },
      };
    }
    case "sub": {
      const base = seq(n.base, size);
      const idx = seq(n.idx, size * 0.7);
      const drop = size * 0.2;
      return {
        w: base.w + idx.w + size * 0.04,
        asc: base.asc,
        desc: Math.max(base.desc, drop + idx.desc),
        draw: (page, x, y) => {
          base.draw(page, x, y);
          idx.draw(page, x + base.w + size * 0.02, y - drop);
        },
      };
    }
    case "frac": {
      const s = size * 0.82;
      const num = seq(n.num, s);
      const den = seq(n.den, s);
      const axis = size * 0.27;
      const gap = size * 0.14;
      const pad = size * 0.12;
      const w = Math.max(num.w, den.w) + 2 * pad;
      return {
        w: w + size * 0.1,
        asc: axis + gap + num.desc + num.asc,
        desc: Math.max(0, gap + den.asc - axis + den.desc),
        draw: (page, x, y) => {
          const x0 = x + size * 0.05;
          num.draw(page, x0 + (w - num.w) / 2, y + axis + gap + num.desc);
          page.drawLine({ start: { x: x0, y: y + axis }, end: { x: x0 + w, y: y + axis }, thickness: Math.max(0.5, size * 0.05), color });
          den.draw(page, x0 + (w - den.w) / 2, y + axis - gap - den.asc);
        },
      };
    }
    case "sqrt": {
      const body = seq(n.body, size);
      const index = n.index ? seq(n.index, size * 0.55) : null;
      const rw = size * 0.55;
      const lead = index ? Math.max(0, index.w - rw * 0.45) : 0;
      const top = body.asc + size * 0.14;
      const pad = size * 0.08;
      const t = Math.max(0.5, size * 0.055);
      return {
        w: lead + rw + body.w + pad * 2,
        asc: top + t + (index ? size * 0.05 : 0),
        desc: Math.max(body.desc, size * 0.12),
        draw: (page, x, y) => {
          const x0 = x + lead;
          const pts = [
            { x: x0, y: y + size * 0.3 },
            { x: x0 + rw * 0.25, y: y + size * 0.38 },
            { x: x0 + rw * 0.55, y: y - size * 0.1 },
            { x: x0 + rw, y: y + top },
            { x: x0 + rw + body.w + pad * 2, y: y + top },
          ];
          for (let i = 0; i < pts.length - 1; i++) page.drawLine({ start: pts[i], end: pts[i + 1], thickness: t, color });
          if (index) index.draw(page, x0 + rw * 0.45 - index.w, y + size * 0.48);
          body.draw(page, x0 + rw + pad, y);
        },
      };
    }
  }
}

/** Separa o texto em parágrafos (\n) e palavras (espaços de nível superior). */
function words(nodes: MathNode[], size: number, fonts: RichFonts, color: Color): Box[][][] {
  const paragraphs: Box[][][] = [[]];
  let word: Box[] = [];
  const flush = () => {
    if (word.length) paragraphs[paragraphs.length - 1].push(word);
    word = [];
  };
  for (const n of nodes) {
    if (n.t !== "text") {
      word.push(nodeBox(n, size, fonts, color));
      continue;
    }
    const parts = n.s.split(/(\n| +)/);
    for (const p of parts) {
      if (p === "") continue;
      if (p === "\n") {
        flush();
        paragraphs.push([]);
      } else if (/^ +$/.test(p)) flush();
      else word.push(textBox(p, size, fonts, color));
    }
  }
  flush();
  return paragraphs;
}

export interface RichLine {
  height: number;
  /** Distância do topo da linha até a linha de base do texto. */
  baseline: number;
  /** top = distância do topo da página até o topo da linha. */
  draw: (page: PDFPage, x: number, top: number) => void;
}

export function layoutRich(
  markup: string,
  opts: { fonts: RichFonts; size: number; maxWidth: number; lineHeight: number; justify: boolean; color?: Color },
): RichLine[] {
  const { fonts, size, maxWidth, justify } = opts;
  const color = opts.color ?? BRAND.ink;
  const lh = size * opts.lineHeight;
  const space = fonts.regular.widthOfTextAtSize(" ", size);
  const lines: RichLine[] = [];

  for (const para of words(parseMath(markup), size, fonts, color)) {
    const wordBoxes = para.map(hbox);
    if (wordBoxes.length === 0) {
      lines.push({ height: lh, baseline: size * 0.8, draw: () => {} });
      continue;
    }
    let current: Box[] = [];
    let width = 0;
    const emit = (ws: Box[], last: boolean) => {
      const asc = Math.max(size * 0.75, ...ws.map((b) => b.asc));
      const desc = Math.max(size * 0.21, ...ws.map((b) => b.desc));
      const base = Math.max(size * 0.8, asc + size * 0.08);
      const height = Math.max(lh, base + desc + (lh - size));
      const sum = ws.reduce((s, b) => s + b.w, 0);
      let gap = space;
      if (justify && !last && ws.length > 1) {
        const g = (maxWidth - sum) / (ws.length - 1);
        // justifica sempre, menos em linha quase vazia (1–2 palavras enormes)
        if (g <= size * 3.5 || ws.length >= 4) gap = g;
      }
      lines.push({
        height,
        baseline: base,
        draw: (page, x, top) => {
          const y = A4.h - top - base;
          let cx = x;
          for (const b of ws) {
            b.draw(page, cx, y);
            cx += b.w + gap;
          }
        },
      });
    };
    for (const wb of wordBoxes) {
      const add = current.length ? space + wb.w : wb.w;
      if (current.length && width + add > maxWidth) {
        emit(current, false);
        current = [wb];
        width = wb.w;
      } else {
        current.push(wb);
        width += add;
      }
    }
    emit(current, true);
  }
  return lines;
}
