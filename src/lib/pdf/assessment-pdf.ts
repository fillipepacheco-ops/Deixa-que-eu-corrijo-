/**
 * GERADOR PROFISSIONAL DE PDF DA PROVA (A4).
 *
 * - 4 modelos: escolar, simulado, larga escala e personalizado;
 * - numeração automática, cabeçalho, rodapé e paginação "Página X de Y";
 * - cada questão é um bloco indivisível: se não couber, vai inteira para a
 *   próxima coluna/página (imagem e tabela ficam junto do enunciado);
 * - só quebra uma questão se ela sozinha for maior que uma coluna inteira.
 */
import { tidyText } from "@/lib/assessment/tidy-text";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage } from "pdf-lib";
import type { Assessment, AssessmentQuestion, PdfTemplate } from "@/lib/models/types";
import { A4, BRAND, drawLine, drawTextTop, formatDateBR, mm, sanitize, wrapLines, wrapText } from "./common";
import { QUESTION_LABEL, examHeader } from "@/lib/assessment/header";
import { layoutRich, type RichFonts } from "./rich-text";

export interface TemplateConfig {
  columns: 1 | 2;
  fontSize: number;
  header: "full" | "compact" | "band";
  showGradeBox: boolean;
  showSignature: boolean;
  questionHeading: "inline" | "boxed" | "label";
  showWeights: boolean;
  essayLines: number;
  /** Altura da linha em múltiplos do tamanho da fonte (1,5 do Word ≈ 1,725). */
  lineHeight: number;
  justify: boolean;
  /** Capa com cabeçalho e instruções; questões a partir da página 2. */
  coverPage: boolean;
}

export const TEMPLATES: Record<Exclude<PdfTemplate, "personalizado">, TemplateConfig> = {
  escolar: {
    columns: 1, fontSize: 11, header: "full", showGradeBox: true, showSignature: true,
    questionHeading: "inline", showWeights: true, essayLines: 6,
    lineHeight: 1.38, justify: false, coverPage: false,
  },
  simulado: {
    columns: 2, fontSize: 9.5, header: "compact", showGradeBox: true, showSignature: false,
    questionHeading: "inline", showWeights: false, essayLines: 5,
    lineHeight: 1.38, justify: false, coverPage: false,
  },
  // Padrão de larga escala: duas colunas (economia de papel), Arial/Helvetica 12,
  // justificado, espaçamento 1,5, "QUESTÃO 01" e capa com cabeçalho
  // (mesmos dados do cartão-resposta).
  larga_escala: {
    columns: 2, fontSize: 10, header: "band", showGradeBox: false, showSignature: false,
    questionHeading: "label", showWeights: true, essayLines: 6,
    lineHeight: 1.725, justify: true, coverPage: true,
  },
};

export const TEMPLATE_NAMES: Record<PdfTemplate, string> = {
  escolar: "Modelo 1 — Avaliação Escolar",
  simulado: "Modelo 2 — Simulado",
  larga_escala: "Modelo 3 — Avaliação de larga escala",
  personalizado: "Modelo 4 — Personalizado",
};

export function resolveTemplate(template: PdfTemplate, custom?: Partial<TemplateConfig>): TemplateConfig {
  if (template === "personalizado") return { ...TEMPLATES.escolar, ...custom };
  return TEMPLATES[template];
}

const MARGIN_X = mm(18);
const MARGIN_TOP = mm(14);
const MARGIN_BOTTOM = mm(18);
const COLUMN_GAP = mm(8);

interface Piece {
  h: number;
  draw: (page: PDFPage, x: number, top: number) => void;
  /** Pode começar uma nova coluna/página ANTES desta peça (quebra permitida aqui). */
  brk?: boolean;
  /** Só espaço em branco: some se cair no topo de uma coluna. */
  space?: boolean;
  /** Imagem: devolve uma versão menor que caiba na altura dada (ou null). */
  shrink?: (maxH: number) => Piece | null;
}

export interface ExamStudent {
  name: string;
  rollNumber?: number | null;
}

export interface AssessmentPdfInput {
  assessment: Assessment;
  questions: AssessmentQuestion[];
  customTemplate?: Partial<TemplateConfig>;
  /** Logo da escola (JPEG ou PNG), no topo da capa. */
  schoolLogo?: Uint8Array | null;
  /** Prova personalizada: nome e nº do aluno já preenchidos. */
  student?: ExamStudent | null;
  /** Quadros de rascunho nos espaços vazios. Padrão: automático para disciplinas de exatas. */
  draftBoxes?: boolean;
}

/** Matemática, Física, Química e afins (pela disciplina ou, sem ela, pelo título). */
export function isExactSubject(subject: string | null | undefined, title?: string | null): boolean {
  const re = /matem[aá]tic|f[ií]sica|qu[ií]mica|geometri|[aá]lgebra|estat[ií]stic|trigonometri|aritm[eé]tic|c[aá]lculo|exatas|teorema|equa[cç][aã]o|fun[cç][aã]o (?:afim|quadr[aá]tica)/i;
  const s = (subject ?? "").normalize("NFC");
  return s ? re.test(s) : re.test((title ?? "").normalize("NFC"));
}

export interface AssessmentPdfResult {
  bytes: Uint8Array;
  pageCount: number;
  /** Página em que cada questão começa (útil para testes e revisão). */
  questionPages: Record<number, number>;
}

export async function generateAssessmentPdf(input: AssessmentPdfInput): Promise<AssessmentPdfResult> {
  const { assessment } = input;
  const cfg = resolveTemplate(assessment.template, input.customTemplate);
  const questions = [...input.questions].sort((a, b) => a.position - b.position);

  const doc = await PDFDocument.create();
  doc.setTitle(assessment.title);
  doc.setCreator("Deixa que eu Corrijo");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const symbol = await doc.embedFont(StandardFonts.Symbol);
  const rich: RichFonts = { regular, symbol };
  const logo = input.schoolLogo?.length
    ? input.schoolLogo[0] === 0x89
      ? await doc.embedPng(input.schoolLogo)
      : await doc.embedJpg(input.schoolLogo)
    : null;
  const student = input.student ?? null;

  const fs = cfg.fontSize;
  const lh = fs * cfg.lineHeight;
  const contentW = A4.w - 2 * MARGIN_X;
  const colW = cfg.columns === 2 ? (contentW - COLUMN_GAP) / 2 : contentW;

  // ---------- imagens (embutidas uma vez) ----------
  const images = new Map<number, PDFImage>();
  for (const q of questions) {
    if (!q.image) continue;
    images.set(q.position, q.image.kind === "png" ? await doc.embedPng(q.image.bytes) : await doc.embedJpg(q.image.bytes));
  }

  // ---------- montagem das peças de cada questão ----------
  const groups: { number: number; pieces: Piece[] }[] = questions.map((q, idx) => {
    const number = idx + 1; // numeração automática
    const pieces: Piece[] = [];
    const indent = cfg.questionHeading === "inline" ? fs * 1.9 : 0;
    const textW = colW - indent;

    // Começo de uma seção (ex.: disciplina da Prova Multi): faixa com o nome.
    const section = (q.section ?? "").trim();
    if (section && section !== (questions[idx - 1]?.section ?? "").trim()) {
      const label = sanitize(bold, section.toUpperCase());
      pieces.push({
        h: fs * 2.6,
        draw: (page, x, top) => {
          page.drawRectangle({ x, y: A4.h - top - fs * 1.8, width: colW, height: fs * 1.8, color: BRAND.dark });
          drawTextTop(page, label.length > 60 ? label.slice(0, 57) + "..." : label, { x: x + 6, top: top + fs * 0.42, size: fs * 0.95, font: bold, color: BRAND.white });
        },
      });
    }

    // Título da questão (modelo larga escala).
    if (cfg.questionHeading === "boxed") {
      const label = `QUESTÃO ${String(number).padStart(2, "0")}`;
      pieces.push({
        h: fs * 1.9,
        draw: (page, x, top) => {
          const w = bold.widthOfTextAtSize(label, fs * 0.9) + 10;
          page.drawRectangle({ x, y: A4.h - top - fs * 1.45, width: w, height: fs * 1.45, color: BRAND.dark });
          drawTextTop(page, label, { x: x + 5, top: top + fs * 0.25, size: fs * 0.9, font: bold, color: BRAND.white });
          if (cfg.showWeights) {
            drawTextTop(page, pointsLabel(q.weight), { x: x + w + 6, top: top + fs * 0.25, size: fs * 0.8, font: italic, color: BRAND.gray });
          }
        },
      });
    }

    // "QUESTÃO 01" em negrito (larga escala), com o valor ao lado.
    if (cfg.questionHeading === "label") {
      const label = QUESTION_LABEL(number);
      pieces.push({
        h: fs * 1.75,
        draw: (page, x, top) => {
          drawTextTop(page, label, { x, top, size: fs, font: bold, color: BRAND.dark });
          if (cfg.showWeights && q.weight !== 1) {
            const lw = bold.widthOfTextAtSize(label, fs);
            drawTextTop(page, pointsLabel(q.weight), { x: x + lw + 8, top: top + fs * 0.1, size: fs * 0.8, font: italic, color: BRAND.gray });
          }
        },
      });
    }

    // Valor da questão (modelo escolar), discreto e alinhado à direita.
    if (cfg.questionHeading === "inline" && cfg.showWeights && q.weight !== 1) {
      const t = pointsLabel(q.weight);
      pieces.push({
        h: fs * 1.05,
        draw: (page, x, top) => {
          const w = italic.widthOfTextAtSize(t, fs * 0.75);
          drawTextTop(page, t, { x: x + colW - w, top, size: fs * 0.75, font: italic, color: BRAND.gray });
        },
      });
    }

    // Enunciado.
    const statement = tidyText(q.statement) || "(enunciado não preenchido)";
    // Enunciado com fórmulas (expoente, fração, raiz, símbolos).
    const stLines = layoutRich(statement, { fonts: rich, size: fs, maxWidth: textW, lineHeight: cfg.lineHeight, justify: cfg.justify });
    stLines.forEach((line, i) => {
      pieces.push({
        h: line.height,
        // Pode continuar na outra coluna depois das 2 primeiras linhas, sem deixar 1 linha sozinha no fim.
        brk: i >= 2 && i <= stLines.length - 2,
        draw: (page, x, top) => {
          if (i === 0 && cfg.questionHeading === "inline") {
            drawTextTop(page, `${number}.`, { x, top: top + line.baseline - fs * 0.8, size: fs, font: bold, color: BRAND.dark });
          }
          line.draw(page, x + indent, top);
        },
      });
    });

    // Imagem logo abaixo do enunciado.
    const img = images.get(q.position);
    if (img) {
      // Ajuste automático: cabe na largura da coluna, no máximo 7,5 cm de altura
      // e nunca maior que o tamanho natural da imagem (150 dpi) — não fica borrada.
      const maxW = Math.min(textW, q.image?.widthMm ? mm(q.image.widthMm) : textW);
      const maxH = mm(75);
      const scale = Math.min(maxW / img.width, maxH / img.height, 72 / 150);
      const pad = lh * 0.4;
      const imagePiece = (w: number, h: number): Piece => ({
        h: h + pad,
        brk: true,
        draw: (page, x, top) => {
          page.drawImage(img, { x: x + indent + (textW - w) / 2, y: A4.h - top - pad / 2 - h, width: w, height: h });
        },
        // Se faltar pouco espaço, a imagem diminui (até 65% e no mínimo 3 cm) em vez de pular de coluna.
        shrink: (avail) => {
          const target = avail - pad;
          if (target < Math.max(mm(30), h * 0.65) || target >= h) return null;
          return imagePiece((w * target) / h, target);
        },
      });
      pieces.push(imagePiece(img.width * scale, img.height * scale));
    }

    // Tabela simples.
    if (q.table_data?.rows?.length) {
      const rows = q.table_data.rows;
      const ncols = Math.max(...rows.map((r) => r.length));
      const cellW = textW / ncols;
      const tfs = fs * 0.9;
      const tlh = tfs * 1.3;
      const rowHeights = rows.map((r) =>
        Math.max(...Array.from({ length: ncols }, (_, c) => wrapText(regular, tfs, r[c] ?? "", cellW - 6).length)) * tlh + 4,
      );
      const total = rowHeights.reduce((a, b) => a + b, 0);
      pieces.push({
        brk: true,
        h: total + lh * 0.6,
        draw: (page, x0, top0) => {
          let top = top0 + lh * 0.3;
          rows.forEach((r, ri) => {
            const rh = rowHeights[ri];
            for (let c = 0; c < ncols; c++) {
              const cx = x0 + indent + c * cellW;
              page.drawRectangle({
                x: cx, y: A4.h - top - rh, width: cellW, height: rh,
                borderColor: BRAND.line, borderWidth: 0.6,
                color: ri === 0 ? BRAND.light : undefined,
              });
              wrapText(regular, tfs, r[c] ?? "", cellW - 6).forEach((line, li) => {
                drawTextTop(page, line, { x: cx + 3, top: top + 2 + li * tlh, size: tfs, font: ri === 0 ? bold : regular });
              });
            }
            top += rh;
          });
        },
      });
    }

    // Alternativas / espaço de resposta.
    pieces.push({ h: lh * 0.25, space: true, draw: () => {} });
    if (q.type === "multiple_choice") {
      const optIndent = fs * 2.2;
      q.options.forEach((opt, oi) => {
        const lastPair = oi === q.options.length - 1 && oi > 1; // a última alternativa não fica sozinha
        const lines = layoutRich(tidyText(opt.text), { fonts: rich, size: fs, maxWidth: textW - optIndent, lineHeight: cfg.lineHeight, justify: cfg.justify });
        lines.forEach((line, i) => {
          pieces.push({
            h: line.height,
            brk: i === 0 && !lastPair, // a alternativa nunca fica partida
            draw: (page, x, top) => {
              // rótulo alinhado à linha de base do texto (que pode ser mais alta por causa de fração)
              if (i === 0) drawTextTop(page, `(${opt.label})`, { x: x + indent, top: top + line.baseline - fs * 0.8, size: fs, font: bold, color: BRAND.mid });
              line.draw(page, x + indent + optIndent, top);
            },
          });
        });
      });
    } else if (q.type === "true_false") {
      pieces.push({
        h: lh * 1.2,
        brk: true,
        draw: (page, x, top) => {
          drawTextTop(page, "(     ) Certo          (     ) Errado", { x: x + indent, top: top + 2, size: fs, font: regular });
        },
      });
    } else if (q.type === "numeric") {
      // Tipo B: a resposta vai no cartão (centena, dezena, unidade)
      const note = wrapText(italic, fs * 0.78, "Tipo B: marque a resposta no cartão-resposta (centena, dezena e unidade).", textW);
      note.forEach((line, i) =>
        pieces.push({
          h: fs * 0.78 * 1.45 + (i === 0 ? 2 : 0),
          brk: false,
          draw: (page, x, top) => {
            drawTextTop(page, line, { x: x + indent, top: top + (i === 0 ? 2 : 0), size: fs * 0.78, font: italic, color: BRAND.gray });
          },
        }),
      );
    } else if (q.type === "lined") {
      // Tipo D: quadro com 10 linhas numeradas (como no PAS)
      const rows = 10;
      const rowH = Math.max(lh * 1.2, mm(7.5));
      const numW = mm(6);
      pieces.push({
        h: rows * rowH + 8,
        brk: false, // o quadro fica junto do fim do enunciado
        draw: (page, x, top) => {
          const left = x + indent;
          const w = colW - indent;
          const y0 = A4.h - top - 4;
          page.drawRectangle({ x: left, y: y0 - rows * rowH, width: w, height: rows * rowH, borderColor: BRAND.ink, borderWidth: 0.8 });
          page.drawLine({ start: { x: left + numW, y: y0 }, end: { x: left + numW, y: y0 - rows * rowH }, thickness: 0.6, color: BRAND.ink });
          for (let i = 1; i <= rows; i++) {
            const yb = y0 - i * rowH;
            if (i < rows) page.drawLine({ start: { x: left + numW, y: yb }, end: { x: left + w, y: yb }, thickness: 0.4, color: BRAND.line });
            const t = String(i);
            // linhas 1, 5 e 10 em destaque (quadrinho escuro com o número em branco), como no PAS
            const marked = i === 1 || i === 5 || i === 10;
            if (marked) page.drawRectangle({ x: left, y: yb, width: numW, height: rowH, color: BRAND.dark });
            const font = marked ? bold : regular;
            const tw = font.widthOfTextAtSize(t, 8);
            page.drawText(t, { x: left + (numW - tw) / 2, y: yb + (rowH - 8) / 2 + 1.5, size: 8, font, color: marked ? BRAND.white : BRAND.gray });
          }
        },
      });
    } else {
      const n = q.type === "short_answer" ? 2 : cfg.essayLines;
      const gap = Math.max(lh * 1.35, mm(7));
      pieces.push({
        h: n * gap + 4,
        brk: true,
        draw: (page, x, top) => {
          for (let i = 1; i <= n; i++) {
            const y = A4.h - top - i * gap;
            page.drawLine({ start: { x: x + indent, y }, end: { x: x + colW, y }, thickness: 0.5, color: BRAND.line });
          }
        },
      });
    }
    pieces.push({ h: lh * 0.6, space: true, draw: () => {} }); // respiro entre questões
    return { number, pieces };
  });

  // ---------- páginas, cabeçalho e fluxo ----------
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let col = 0;
  let cursor = 0;
  let areaTop = 0;
  const areaBottom = A4.h - MARGIN_BOTTOM - mm(6);

  const newPage = () => {
    page = doc.addPage([A4.w, A4.h]);
    pages.push(page);
    col = 0;
    if (pages.length === 1 && cfg.coverPage) {
      drawCover(page);
      page = doc.addPage([A4.w, A4.h]);
      pages.push(page);
    }
    areaTop = pages.length === 1 ? drawFirstHeader(page) : drawRunningHeader(page);
    cursor = areaTop;
    if (cfg.columns === 2) {
      const x = MARGIN_X + colW + COLUMN_GAP / 2;
      page.drawLine({ start: { x, y: A4.h - areaTop }, end: { x, y: A4.h - areaBottom }, thickness: 0.5, color: BRAND.line });
    }
  };
  const nextColumn = () => {
    if (col < cfg.columns - 1) {
      col++;
      cursor = areaTop;
    } else newPage();
  };
  const colX = () => MARGIN_X + col * (colW + COLUMN_GAP);

  // Provas de exatas: o espaço que sobrar no fim de uma coluna vira um quadro de RASCUNHO.
  const draftOn = input.draftBoxes ?? isExactSubject(assessment.subject, assessment.title);
  const DRAFT_MIN = mm(28);
  const fillDraft = () => {
    const top = cursor + (cursor > areaTop ? lh * 0.3 : 0);
    const h = areaBottom - top;
    if (!draftOn || h < DRAFT_MIN) return;
    const x = colX();
    page.drawRectangle({
      x, y: A4.h - top - h, width: colW, height: h,
      borderColor: BRAND.mid, borderWidth: 0.8, borderDashArray: [4, 3], borderOpacity: 0.55,
    });
    drawTextTop(page, "RASCUNHO", { x: x + 6, top: top + 5, size: 8, font: bold, color: BRAND.mid });
    const note = "não vale para a correção";
    drawTextTop(page, note, { x: x + colW - 6 - italic.widthOfTextAtSize(note, 7), top: top + 5.5, size: 7, font: italic, color: BRAND.gray });
    cursor = areaBottom;
  };
  /** Passa para a próxima coluna entre uma questão e outra (o espaço que sobra vira rascunho). */
  const nextColumnAfterQuestion = () => {
    fillDraft();
    nextColumn();
  };

  function drawFirstHeader(p: PDFPage): number {
    let top = MARGIN_TOP;
    const a = assessment;

    if (cfg.header === "band") {
      const bandH = mm(17);
      p.drawRectangle({ x: MARGIN_X, y: A4.h - top - bandH, width: contentW, height: bandH, color: BRAND.dark });
      drawTextTop(p, (a.school_name ?? "").toUpperCase(), { x: MARGIN_X + mm(4), top: top + mm(2.5), size: 8, font: bold, color: rgb(0.75, 0.9, 0.82) });
      // Disciplina/série na mesma linha da escola; título ocupa a largura toda.
      const sub = [a.subject, a.grade_level].filter(Boolean).join("  ·  ").toUpperCase();
      const sw = bold.widthOfTextAtSize(sanitize(bold, sub), 8);
      drawTextTop(p, sub, { x: MARGIN_X + contentW - mm(4) - sw, top: top + mm(2.5), size: 8, font: bold, color: rgb(0.75, 0.9, 0.82) });
      const title = sanitize(bold, a.title);
      let ts = 14;
      while (ts > 10 && bold.widthOfTextAtSize(title, ts) > contentW - mm(8)) ts -= 0.5;
      const shown = bold.widthOfTextAtSize(title, ts) > contentW - mm(8) ? wrapText(bold, ts, title, contentW - mm(8))[0] + "..." : title;
      drawTextTop(p, shown, { x: MARGIN_X + mm(4), top: top + mm(7.5), size: ts, font: bold, color: BRAND.white });
      top += bandH + mm(3);
    } else {
      if (a.school_name) {
        drawTextTop(p, a.school_name.toUpperCase(), { x: MARGIN_X, top, size: 8.5, font: bold, color: BRAND.mid });
        top += 12;
      }
      const titleSize = cfg.header === "full" ? 15 : 13;
      wrapText(bold, titleSize, a.title, contentW - (cfg.showGradeBox ? mm(32) : 0)).forEach((line) => {
        drawTextTop(p, line, { x: MARGIN_X, top, size: titleSize, font: bold, color: BRAND.dark });
        top += titleSize * 1.25;
      });
      top += 4;
    }

    // Campos: aluno, nº, turma, disciplina, professor, data (+ nota).
    const gradeW = cfg.showGradeBox ? mm(28) : 0;
    const fieldsW = contentW - (gradeW ? gradeW + mm(4) : 0);
    const rowH = mm(9.5);
    const startTop = top;
    const field = (label: string, value: string, x: number, t: number, w: number) => {
      p.drawRectangle({ x, y: A4.h - t - rowH, width: w, height: rowH, borderColor: BRAND.line, borderWidth: 0.6 });
      drawTextTop(p, label.toUpperCase(), { x: x + 4, top: t + 2.5, size: 6, font: bold, color: BRAND.mid });
      if (value) drawTextTop(p, value, { x: x + 4, top: t + 11, size: 9.5, font: regular });
    };
    const x0 = MARGIN_X;
    field("Aluno(a)", "", x0, top, fieldsW - mm(18));
    field("Nº", "", x0 + fieldsW - mm(18), top, mm(18));
    top += rowH;
    const w4 = fieldsW / 4;
    field("Turma", assessment.class_name ?? "", x0, top, w4);
    field("Disciplina", assessment.subject ?? "", x0 + w4, top, w4);
    field("Professor(a)", assessment.teacher_name ?? "", x0 + 2 * w4, top, w4);
    field("Data", formatDateBR(assessment.applied_on), x0 + 3 * w4, top, w4);
    top += rowH;

    if (cfg.showGradeBox) {
      const gx = MARGIN_X + contentW - gradeW;
      const gh = top - startTop;
      p.drawRectangle({ x: gx, y: A4.h - startTop - gh, width: gradeW, height: gh, borderColor: BRAND.dark, borderWidth: 1 });
      p.drawRectangle({ x: gx, y: A4.h - startTop - mm(5), width: gradeW, height: mm(5), color: BRAND.dark });
      const t = "NOTA";
      drawTextTop(p, t, { x: gx + (gradeW - bold.widthOfTextAtSize(t, 7)) / 2, top: startTop + 4, size: 7, font: bold, color: BRAND.white });
      const max = `/ ${assessment.max_score.toLocaleString("pt-BR")}`;
      drawTextTop(p, max, { x: gx + gradeW - regular.widthOfTextAtSize(max, 7) - 4, top: startTop + gh - 11, size: 7, font: regular, color: BRAND.gray });
    }

    if (versionLetter) top = drawVersionBanner(p, top + mm(3));

    if (cfg.showSignature) {
      top += mm(7);
      const sw = mm(80);
      p.drawLine({ start: { x: MARGIN_X + contentW - sw, y: A4.h - top }, end: { x: MARGIN_X + contentW, y: A4.h - top }, thickness: 0.6, color: BRAND.ink });
      drawTextTop(p, "Assinatura do(a) responsável", { x: MARGIN_X + contentW - sw, top: top + 2, size: 7, font: regular, color: BRAND.gray });
      top += mm(5);
    }

    // Instruções.
    if (assessment.instructions?.trim()) {
      top += mm(3);
      const ifs = fs * 0.88;
      const lines = wrapText(regular, ifs, assessment.instructions.trim(), contentW - mm(8));
      const boxH = lines.length * ifs * 1.35 + mm(9);
      p.drawRectangle({ x: MARGIN_X, y: A4.h - top - boxH, width: contentW, height: boxH, color: BRAND.light });
      p.drawRectangle({ x: MARGIN_X, y: A4.h - top - boxH, width: 2.5, height: boxH, color: BRAND.vivid });
      drawTextTop(p, "INSTRUÇÕES", { x: MARGIN_X + mm(4), top: top + mm(2.5), size: 7, font: bold, color: BRAND.mid });
      lines.forEach((line, i) => {
        drawTextTop(p, line, { x: MARGIN_X + mm(4), top: top + mm(6.5) + i * ifs * 1.35, size: ifs, font: regular });
      });
      top += boxH;
    }
    return top + mm(5);
  }

  /** Capa: mesmos dados do cartão-resposta + instruções numeradas. */
  /** Faixa "VERSÃO DA PROVA: B" (provas com versões, inclusive cópias xerox sem nome). */
  const versionLetter = assessment.version !== null && assessment.version !== undefined && (assessment.versions ?? 1) > 1 ? "ABCD"[assessment.version] : null;
  function drawVersionBanner(p: PDFPage, top: number): number {
    if (!versionLetter) return top;
    const h = mm(15);
    p.drawRectangle({ x: MARGIN_X, y: A4.h - top - h, width: contentW, height: h, color: BRAND.dark });
    const box = mm(11);
    p.drawRectangle({ x: MARGIN_X + mm(2), y: A4.h - top - mm(2) - box, width: box, height: box, color: BRAND.white });
    const lw = bold.widthOfTextAtSize(versionLetter, 22);
    drawTextTop(p, versionLetter, { x: MARGIN_X + mm(2) + (box - lw) / 2, top: top + mm(2) + mm(2.2), size: 22, font: bold, color: BRAND.dark });
    drawTextTop(p, `VERSÃO DA PROVA: ${versionLetter}`, { x: MARGIN_X + mm(16), top: top + mm(2.6), size: 12, font: bold, color: BRAND.white });
    drawTextTop(p, `Pinte a letra ${versionLetter} no campo VERSÃO DA PROVA do seu cartão-resposta. Sem isso, a correção pode sair errada.`, {
      x: MARGIN_X + mm(16), top: top + mm(8.6), size: 8, font: regular, color: BRAND.white,
    });
    return top + h + mm(3);
  }

  function drawCover(p: PDFPage) {
    const h = examHeader(assessment);
    let top = MARGIN_TOP + mm(2);
    if (logo) {
      const maxH = mm(22);
      const maxW = mm(70);
      const sc = Math.min(maxH / logo.height, maxW / logo.width);
      const w = logo.width * sc;
      const lh2 = logo.height * sc;
      p.drawImage(logo, { x: MARGIN_X + (contentW - w) / 2, y: A4.h - top - lh2, width: w, height: lh2 });
      top += lh2 + mm(4);
    }
    const center = (text: string, size: number, font = regular, color = BRAND.ink) => {
      for (const line of wrapText(font, size, text, contentW)) {
        const w = font.widthOfTextAtSize(line, size);
        drawTextTop(p, line, { x: MARGIN_X + (contentW - w) / 2, top, size, font, color });
        top += size * 1.35;
      }
    };
    if (h.schoolName) center(h.schoolName.toUpperCase(), 12, bold, BRAND.dark);
    top += 4;
    center(h.title, 16, bold, BRAND.dark);
    const sub = [h.subject, h.gradeLevel].filter(Boolean).join("  •  ");
    if (sub) center(sub, 12, regular, BRAND.gray);
    top += 6;
    p.drawLine({ start: { x: MARGIN_X, y: A4.h - top }, end: { x: MARGIN_X + contentW, y: A4.h - top }, thickness: 1.2, color: BRAND.mid });
    top += mm(6);

    const rowH = mm(12);
    const field = (label: string, value: string, x: number, w: number) => {
      p.drawRectangle({ x, y: A4.h - top - rowH, width: w, height: rowH, borderColor: BRAND.line, borderWidth: 0.6 });
      drawTextTop(p, label.toUpperCase(), { x: x + 5, top: top + 4, size: 7, font: bold, color: BRAND.mid });
      if (value) drawTextTop(p, value, { x: x + 5, top: top + 15, size: 12, font: regular });
    };
    const big = contentW * 0.75;
    field("Nome do(a) aluno(a)", student?.name ?? "", MARGIN_X, big);
    field("Nº", student?.rollNumber ? String(student.rollNumber) : "", MARGIN_X + big, contentW - big);
    top += rowH;
    const half = contentW / 2;
    field("Turma", h.className, MARGIN_X, half);
    field("Data", formatDateBR(h.appliedOn), MARGIN_X + half, half);
    top += rowH;
    field("Disciplina", h.subject, MARGIN_X, half);
    field("Professor(a)", h.teacherName, MARGIN_X + half, half);
    top += rowH;
    field("Assinatura do(a) estudante", "", MARGIN_X, contentW);
    top += rowH + mm(4);
    top = versionLetter ? drawVersionBanner(p, top) + mm(2) : top + mm(5);

    p.drawRectangle({ x: MARGIN_X, y: A4.h - top - 18, width: contentW, height: 18, color: BRAND.light });
    drawTextTop(p, "INSTRUÇÕES", { x: MARGIN_X + 5, top: top + 4, size: 12, font: bold, color: BRAND.dark });
    top += 26;
    const numW = mm(8);
    const IS = 11; // instruções
    h.instructions.forEach((text, i) => {
      drawTextTop(p, `${i + 1}.`, { x: MARGIN_X + 4, top, size: IS, font: bold, color: BRAND.mid });
      const lines = wrapLines(regular, IS, text, contentW - numW - 4);
      lines.forEach((line) => {
        drawLine(p, line, { x: MARGIN_X + numW, top, size: IS, font: regular, width: contentW - numW - 4, justify: true });
        top += IS * 1.725;
      });
      top += 3;
    });
    top += mm(10);
    center("AGUARDE A AUTORIZAÇÃO DO APLICADOR PARA INICIAR A PROVA.", 12, bold, BRAND.dark);
  }

  function drawRunningHeader(p: PDFPage): number {
    const top = MARGIN_TOP;
    const title = sanitize(regular, assessment.title);
    // logo da escola pequena no começo do cabeçalho de todas as páginas
    let tx = MARGIN_X;
    if (logo) {
      const h = 15;
      const w = Math.min(mm(28), (logo.width / logo.height) * h);
      const hh = (w / logo.width) * logo.height;
      p.drawImage(logo, { x: MARGIN_X, y: A4.h - (top + 10.5) + (h - hh) / 2, width: w, height: hh }); // de top-4,5 até top+10,5
      tx = MARGIN_X + w + 6;
    }
    drawTextTop(p, title.length > 70 ? title.slice(0, 67) + "..." : title, { x: tx, top, size: 8, font: bold, color: BRAND.mid });
    const name = student ? `Aluno(a): ${sanitize(regular, student.name)}` : "Aluno(a): ______________________________";
    drawTextTop(p, name, { x: MARGIN_X + contentW - regular.widthOfTextAtSize(name, 8), top, size: 8, font: regular, color: BRAND.gray });
    p.drawLine({ start: { x: MARGIN_X, y: A4.h - top - 13 }, end: { x: MARGIN_X + contentW, y: A4.h - top - 13 }, thickness: 0.6, color: BRAND.line });
    return top + 22;
  }

  newPage();
  const questionPages: Record<number, number> = {};

  // Encaixe das questões, uma embaixo da outra, com o mínimo de espaço vazio:
  //  - a questão inteira cabe → entra inteira;
  //  - não cabe → continua na outra coluna num ponto bom (depois do título + 2 linhas,
  //    entre alternativas, antes da imagem), nunca partindo uma alternativa;
  //  - se o espaço que sobra é pequeno, a questão vai inteira para a próxima coluna;
  //  - imagem que quase cabe diminui um pouco em vez de pular.
  const columnH = () => areaBottom - areaTop;
  for (const g of groups) {
    const pieces = [...g.pieces];
    while (pieces.length && pieces[pieces.length - 1].space) pieces.pop(); // respiro final não precisa caber
    const tail = g.pieces.slice(pieces.length);
    const total = pieces.reduce((s, p) => s + p.h, 0);
    const room = areaBottom - cursor;

    // trechos que não podem ser separados
    const segments: Piece[][] = [];
    for (const p of pieces) {
      if (!segments.length || p.brk) segments.push([p]);
      else segments[segments.length - 1].push(p);
    }
    const segH = (seg: Piece[]) => seg.reduce((s, p) => s + p.h, 0);

    if (total > room && cursor > areaTop) {
      const first = segH(segments[0]);
      const lastColumn = col === cfg.columns - 1;
      // Nunca começa no pé da página e continua na outra página: vai inteira para a próxima
      // (só divide entre páginas se a questão for maior que uma coluna inteira).
      // Entre as colunas da mesma página pode dividir, se ficar um bom pedaço.
      if ((lastColumn && total <= columnH()) || room < first || room < Math.min(lh * 4, columnH() * 0.12)) nextColumnAfterQuestion();
    }
    questionPages[g.number] = pages.length;

    // questão que continua na outra coluna/página: aviso discreto no pé da coluna
    const continueTo = () => {
      const t = col < cfg.columns - 1 ? "continua ao lado ›" : "continua na próxima página ›";
      drawTextTop(page, t, { x: colX() + colW - italic.widthOfTextAtSize(t, fs * 0.7), top: areaBottom + 1, size: fs * 0.7, font: italic, color: BRAND.gray });
      nextColumn();
    };
    for (const seg of segments) {
      let h = segH(seg);
      if (cursor + h > areaBottom && cursor > areaTop) {
        const img = seg.length === 1 ? seg[0].shrink?.(areaBottom - cursor) : null;
        if (img) {
          seg[0] = img;
          h = img.h;
        } else continueTo();
      }
      for (const piece of seg) {
        if (piece.space && cursor === areaTop) continue;
        if (cursor + piece.h > areaBottom && cursor > areaTop && piece.h > 0) continueTo(); // trecho maior que uma coluna
        piece.draw(page, colX(), cursor);
        cursor += piece.h;
      }
    }
    for (const piece of tail) if (cursor > areaTop) cursor = Math.min(areaBottom, cursor + piece.h);
  }
  // fim da prova: o resto da coluna e as colunas vazias da última página também viram rascunho
  if (draftOn) {
    fillDraft();
    while (col < cfg.columns - 1) {
      col++;
      cursor = areaTop;
      fillDraft();
    }
  }

  // ---------- rodapé com paginação ----------
  const n = pages.length;
  pages.forEach((p, i) => {
    if (i === 0 && cfg.coverPage) return; // capa sem rodapé (conta na numeração)
    const y = MARGIN_BOTTOM - mm(8);
    p.drawLine({ start: { x: MARGIN_X, y: y + 12 }, end: { x: MARGIN_X + contentW, y: y + 12 }, thickness: 0.5, color: BRAND.line });
    const left = sanitize(regular, [assessment.subject, assessment.title].filter(Boolean).join(" — "));
    p.drawText(left.length > 80 ? left.slice(0, 77) + "..." : left, { x: MARGIN_X, y, size: 7, font: regular, color: BRAND.gray });
    const right = `Página ${i + 1} de ${n}`;
    p.drawText(right, { x: MARGIN_X + contentW - bold.widthOfTextAtSize(right, 7.5), y, size: 7.5, font: bold, color: BRAND.mid });
  });

  const bytes = await doc.save();
  return { bytes, pageCount: n, questionPages };
}

function pointsLabel(weight: number): string {
  const v = weight.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `(${v} ${weight === 1 ? "ponto" : "pontos"})`;
}

/**
 * Uma prova por aluno (nome e nº já na capa), num único PDF para imprimir.
 * A paginação "Página X de Y" recomeça em cada prova.
 */
export async function generateExamCopiesPdf(
  input: Omit<AssessmentPdfInput, "student">,
  students: ExamStudent[],
): Promise<{ bytes: Uint8Array; copies: number }> {
  const merged = await PDFDocument.create();
  merged.setTitle(input.assessment.title);
  merged.setCreator("Deixa que eu Corrijo");
  for (const st of students) {
    const one = await generateAssessmentPdf({ ...input, student: st });
    const src = await PDFDocument.load(one.bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((pg) => merged.addPage(pg));
  }
  return { bytes: await merged.save(), copies: students.length };
}
