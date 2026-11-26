/**
 * Lista de notas em PDF (para conferir, lançar no diário de papel ou arquivar).
 * Tabela simples, zebrada, que continua nas páginas seguintes repetindo o cabeçalho.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { A4, BRAND, mm, sanitize } from "./common";

export interface GradesColumn {
  label: string;
  /** Peso relativo da largura. */
  width: number;
  align?: "left" | "center" | "right";
}

export interface GradesPdfInput {
  title: string;
  info: string[]; // ex.: ["Escola X", "Turma 9º A · Matemática", "Aplicada em 10/11/2026"]
  columns: GradesColumn[];
  rows: string[][];
  /** Linhas em destaque (ex.: abaixo da média) — índice da linha → true. */
  highlight?: boolean[];
  notes?: string[];
  landscape?: boolean;
  /** Logo da escola (JPEG ou PNG), no alto da primeira página. */
  schoolLogo?: Uint8Array | null;
}

const RED_SOFT = rgb(1, 0.93, 0.93);

function fit(font: PDFFont, size: number, text: string, width: number) {
  let t = sanitize(font, text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > width) t = t.slice(0, -1);
  return t + "…";
}

export async function generateGradesPdf(input: GradesPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(input.title);
  doc.setCreator("Deixa que eu Corrijo");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = input.landscape ? A4.h : A4.w;
  const H = input.landscape ? A4.w : A4.h;
  const M = mm(14);
  const tableW = W - 2 * M;
  const totalWeight = input.columns.reduce((a, c) => a + c.width, 0);
  const widths = input.columns.map((c) => (c.width / totalWeight) * tableW);
  let logo: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (input.schoolLogo?.length) {
    try {
      logo = input.schoolLogo[0] === 0x89 ? await doc.embedPng(input.schoolLogo) : await doc.embedJpg(input.schoolLogo);
    } catch {
      logo = null;
    }
  }
  const ROW = 17;
  const SIZE = input.columns.length > 8 ? 8.5 : 10;

  let page!: PDFPage;
  let y = 0;
  let pageNo = 0;

  const text = (p: PDFPage, t: string, x: number, yy: number, font: PDFFont, size: number, color = BRAND.ink) =>
    p.drawText(sanitize(font, t), { x, y: yy, size, font, color });

  const cell = (p: PDFPage, value: string, i: number, x: number, yy: number, font: PDFFont, size: number, color = BRAND.ink) => {
    const w = widths[i] - 8;
    const t = fit(font, size, value, w);
    const tw = font.widthOfTextAtSize(t, size);
    const align = input.columns[i].align ?? "left";
    const tx = align === "left" ? x + 4 : align === "right" ? x + widths[i] - 4 - tw : x + (widths[i] - tw) / 2;
    p.drawText(t, { x: tx, y: yy, size, font, color });
  };

  const header = () => {
    page = doc.addPage([W, H]);
    pageNo++;
    y = H - M;
    // faixa do título
    page.drawRectangle({ x: M, y: y - 30, width: tableW, height: 30, color: BRAND.dark });
    text(page, fit(bold, 14, input.title, tableW - 120), M + 10, y - 20, bold, 14, BRAND.white);
    const tag = "Deixa que eu Corrijo";
    text(page, tag, M + tableW - 10 - regular.widthOfTextAtSize(tag, 8), y - 19, regular, 8, rgb(0.8, 0.92, 0.8));
    y -= 30 + 14;
    if (pageNo === 1) {
      const startY = y;
      let infoW = tableW;
      let logoBottom = Infinity;
      if (logo) {
        // logo da escola à direita das informações
        const boxH = mm(16);
        const sc = Math.min(boxH / logo.height, mm(40) / logo.width);
        const w = logo.width * sc;
        const h = logo.height * sc;
        page.drawImage(logo, { x: M + tableW - w, y: startY + 8 - h, width: w, height: h });
        infoW = tableW - w - mm(6);
        logoBottom = startY + 8 - h;
      }
      let iy = startY;
      for (const line of input.info.filter(Boolean)) {
        text(page, fit(regular, 10, line, infoW), M, iy, regular, 10, BRAND.gray);
        iy -= 14;
      }
      y = Math.min(iy - 4, logoBottom - 10); // a tabela começa abaixo da logo
    }
    // cabeçalho da tabela
    page.drawRectangle({ x: M, y: y - ROW + 4, width: tableW, height: ROW, color: BRAND.light });
    let x = M;
    input.columns.forEach((c, i) => {
      cell(page, c.label, i, x, y - ROW + 9, bold, SIZE - 0.5, BRAND.dark);
      x += widths[i];
    });
    y -= ROW;
  };

  const footer = () => {
    const t = `Página ${pageNo}`;
    text(page, t, W - M - regular.widthOfTextAtSize(t, 8), M - 18, regular, 8, BRAND.gray);
  };

  header();
  input.rows.forEach((r, ri) => {
    if (y - ROW < M + 10) {
      footer();
      header();
    }
    if (input.highlight?.[ri]) page.drawRectangle({ x: M, y: y - ROW + 4, width: tableW, height: ROW, color: RED_SOFT });
    else if (ri % 2 === 1) page.drawRectangle({ x: M, y: y - ROW + 4, width: tableW, height: ROW, color: rgb(0.975, 0.98, 0.975) });
    let x = M;
    r.forEach((v, i) => {
      const isScore = (input.columns[i].align ?? "left") !== "left" && i === r.length - 1;
      cell(page, v, i, x, y - ROW + 9, isScore ? bold : regular, SIZE);
      x += widths[i];
    });
    page.drawLine({ start: { x: M, y: y - ROW + 4 }, end: { x: M + tableW, y: y - ROW + 4 }, thickness: 0.4, color: BRAND.line });
    y -= ROW;
  });

  y -= 12;
  for (const n of input.notes ?? []) {
    if (y < M + 30) {
      footer();
      header();
    }
    text(page, fit(regular, 9.5, n, tableW), M, y, regular, 9.5, BRAND.gray);
    y -= 13;
  }
  if (y > M + 50) {
    y -= 26;
    page.drawLine({ start: { x: M, y }, end: { x: M + mm(70), y }, thickness: 0.6, color: BRAND.ink });
    text(page, "Assinatura do(a) professor(a)", M, y - 11, regular, 8.5, BRAND.gray);
  }
  footer();
  return doc.save();
}
