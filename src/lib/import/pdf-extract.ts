/**
 * Lê o texto de um PDF (pdf.js) linha a linha, na ordem do documento
 * (respeita provas em 2 colunas), marcando parágrafos novos, expoentes
 * e tirando cabeçalho/rodapé que se repetem em todas as páginas.
 */
import { looksStructural, type TextBlock } from "./parse-questions";

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

interface Item {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  eol: boolean;
}

interface Line {
  text: string;
  y: number;
  h: number;
  gapBefore: boolean;
}

function linesOfPage(items: Item[]): Line[] {
  const lines: Line[] = [];
  let parts: string[] = [];
  let base: { y: number; h: number } | null = null;
  let lastEnd = 0;
  let prevLine: { y: number; h: number } | null = null;

  const flush = () => {
    const text = parts.join("").replace(/\s+/g, " ").trim();
    if (text && base) {
      const gap = prevLine ? prevLine.y - base.y : 0;
      // espaço vertical maior que o normal, ou voltou para cima (outra coluna) = parágrafo novo
      const gapBefore = !prevLine || gap > base.h * 1.9 || gap < -base.h;
      lines.push({ text, y: base.y, h: base.h, gapBefore });
      prevLine = base;
    }
    parts = [];
    base = null;
  };

  for (const it of items) {
    if (!it.str && !it.eol) continue;
    if (base && it.str.trim()) {
      const dy = it.y - base.y;
      const sameLine = Math.abs(dy) < Math.max(base.h, it.h) * 0.6;
      if (!sameLine) flush();
    }
    if (it.str) {
      if (!base) {
        base = { y: it.y, h: it.h || 10 };
        lastEnd = it.x;
      }
      const raised = it.h > 0 && it.h < base.h * 0.8 && it.y - base.y > base.h * 0.2;
      const lowered = it.h > 0 && it.h < base.h * 0.8 && base.y - it.y > base.h * 0.1;
      const needsSpace = parts.length > 0 && it.x - lastEnd > base.h * 0.15 && !/\s$/.test(parts[parts.length - 1]) && !/^\s/.test(it.str);
      if (needsSpace && !raised && !lowered) parts.push(" ");
      if (raised && it.str.trim()) parts.push(`^{${it.str.trim()}}`);
      else if (lowered && it.str.trim()) parts.push(`_{${it.str.trim()}}`);
      else parts.push(it.str);
      lastEnd = it.x + it.w;
    }
    if (it.eol) flush();
  }
  flush();
  return lines;
}

export async function extractPdf(pdfjs: PdfJs, data: ArrayBuffer): Promise<TextBlock[]> {
  const task = pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false });
  const doc = await task.promise;
  const pages: Line[][] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const items: Item[] = [];
      for (const raw of tc.items) {
        if (!("str" in raw)) continue;
        const t = raw.transform as number[];
        items.push({ str: raw.str, x: t[4], y: t[5], w: raw.width, h: raw.height || Math.abs(t[3]) || 10, eol: Boolean(raw.hasEOL) });
      }
      pages.push(linesOfPage(items));
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }

  // cabeçalho/rodapé: linhas iguais no topo ou no pé de várias páginas
  const repeated = new Set<string>();
  if (pages.length > 1) {
    const count = new Map<string, number>();
    for (const lines of pages) {
      const edge = new Set(
        [...lines.slice(0, 2), ...lines.slice(-2)].filter((l) => !looksStructural(l.text)).map((l) => l.text.replace(/\d+/g, "#")),
      );
      for (const t of edge) count.set(t, (count.get(t) ?? 0) + 1);
    }
    for (const [t, n] of count) if (n >= Math.max(2, Math.ceil(pages.length / 2))) repeated.add(t);
  }

  const blocks: TextBlock[] = [];
  for (const lines of pages) {
    lines.forEach((l, idx) => {
      const edge = idx < 2 || idx >= lines.length - 2;
      if (edge && !looksStructural(l.text) && repeated.has(l.text.replace(/\d+/g, "#"))) return;
      blocks.push({ text: l.text, newParagraph: l.gapBefore });
    });
  }
  return blocks;
}
