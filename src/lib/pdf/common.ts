/**
 * Utilitários de PDF compartilhados (prova, cartão-resposta, relatórios).
 */
import { rgb, type PDFFont, type PDFPage } from "pdf-lib";

export const A4 = { w: 595.28, h: 841.89 }; // pontos
export const mm = (v: number) => (v * 72) / 25.4;

/** Paleta da marca (mesma do app). */
export const BRAND = {
  dark: rgb(0x0b / 255, 0x3a / 255, 0x1e / 255), // verde escuro (logo)
  mid: rgb(0x13 / 255, 0x7a / 255, 0x1a / 255), // verde médio (logo)
  vivid: rgb(0x5c / 255, 0xb3 / 255, 0x1a / 255), // verde vivo (check da logo)
  light: rgb(0xf0 / 255, 0xf8 / 255, 0xeb / 255), // verde muito claro
  ink: rgb(0.1, 0.12, 0.11),
  gray: rgb(0.42, 0.45, 0.43),
  line: rgb(0.72, 0.75, 0.73),
  black: rgb(0, 0, 0),
  white: rgb(1, 1, 1),
};

const charsetCache = new WeakMap<PDFFont, Set<number>>();

/**
 * As fontes padrão do PDF usam WinAnsi (todo o português funciona).
 * Símbolos fora dele são trocados por equivalentes para o PDF nunca falhar.
 */
export function sanitize(font: PDFFont, text: string): string {
  let set = charsetCache.get(font);
  if (!set) {
    set = new Set(font.getCharacterSet());
    charsetCache.set(font, set);
  }
  const replacements: Record<string, string> = {
    "≤": "<=", "≥": ">=", "≠": "!=", "√": "raiz ", "π": "pi", "∞": "infinito",
    "→": "->", "←": "<-", "−": "-", " ": " ", "\t": "    ",
  };
  let out = "";
  for (const ch of text) {
    if (set.has(ch.codePointAt(0)!)) out += ch;
    else if (replacements[ch] !== undefined) out += replacements[ch];
    else out += "?";
  }
  return out;
}

/** Quebra o texto em linhas que cabem na largura (respeita quebras de parágrafo). */
export function wrapText(font: PDFFont, size: number, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of sanitize(font, text).split(/\r?\n/)) {
    const words = paragraph.split(/ +/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // Palavra maior que a linha: corta por caracteres.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
        let i = rest.length - 1;
        while (i > 1 && font.widthOfTextAtSize(rest.slice(0, i), size) > maxWidth) i--;
        lines.push(rest.slice(0, i));
        rest = rest.slice(i);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

/** Desenha texto com y medido a partir do TOPO da página (em pontos). */
export function drawTextTop(
  page: PDFPage,
  text: string,
  opts: { x: number; top: number; size: number; font: PDFFont; color?: ReturnType<typeof rgb> },
) {
  page.drawText(sanitize(opts.font, text), {
    x: opts.x,
    y: A4.h - opts.top - opts.size * 0.8,
    size: opts.size,
    font: opts.font,
    color: opts.color ?? BRAND.ink,
  });
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Símbolo da marca desenhado em vetor (folha com check), para PDFs. */
export function drawBrandMark(page: PDFPage, x: number, yTop: number, size: number) {
  const y = A4.h - yTop - size;
  page.drawRectangle({ x, y, width: size, height: size, color: BRAND.dark });
  const s = size / 24;
  // folha
  page.drawRectangle({ x: x + 6 * s, y: y + 4 * s, width: 12 * s, height: 16 * s, color: BRAND.white });
  // check
  page.drawLine({ start: { x: x + 8.5 * s, y: y + 11.5 * s }, end: { x: x + 11 * s, y: y + 9 * s }, thickness: 1.8 * s, color: BRAND.vivid });
  page.drawLine({ start: { x: x + 11 * s, y: y + 9 * s }, end: { x: x + 15.5 * s, y: y + 15 * s }, thickness: 1.8 * s, color: BRAND.vivid });
}
