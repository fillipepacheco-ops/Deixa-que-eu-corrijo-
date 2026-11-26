/**
 * GERAÇÃO DO CARTÃO-RESPOSTA (PDF A4, uma folha por aluno).
 * Desenha a geometria de src/lib/answer-sheet/layout.ts — a mesma que a
 * câmera lê.
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import { encodeSheetNumber } from "@/lib/answer-sheet/code";
import { FIDUCIAL_SIZE, sheetLayout, type SheetQuestionSpec } from "@/lib/answer-sheet/layout";
import { A4, BRAND, drawBrandMark, drawTextTop, formatDateBR, mm, sanitize } from "./common";

export interface AnswerSheetCard {
  sheetNumber: number;
  studentName?: string | null;
  rollNumber?: number | null;
}

export interface AnswerSheetInput {
  assessmentTitle: string;
  subject?: string | null;
  className?: string | null;
  schoolName?: string | null;
  appliedOn?: string | null;
  questions: SheetQuestionSpec[];
  cards: AnswerSheetCard[];
  /** Logo oficial em PNG (public/brand/logo.png). Sem ela, usa o símbolo em vetor. */
  logoPng?: Uint8Array | null;
  /** Logo da escola (a mesma da capa da prova), JPEG ou PNG — vai no canto superior direito. */
  schoolLogo?: Uint8Array | null;
}

const toX = (xMm: number) => mm(xMm);
const toY = (yMm: number) => A4.h - mm(yMm); // y do PDF a partir do topo em mm

export async function generateAnswerSheetsPdf(input: AnswerSheetInput): Promise<Uint8Array> {
  if (input.cards.length === 0) throw new Error("Nenhum cartão para gerar.");
  if (input.questions.length === 0) throw new Error("A avaliação não tem questões objetivas para o cartão-resposta.");

  const layout = sheetLayout(input.questions);
  const doc = await PDFDocument.create();
  doc.setTitle(`Cartão-resposta — ${input.assessmentTitle}`);
  doc.setCreator("Deixa que eu Corrijo");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = input.logoPng ? await doc.embedPng(input.logoPng) : null;
  let schoolLogo: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (input.schoolLogo?.length) {
    try {
      schoolLogo = input.schoolLogo[0] === 0x89 ? await doc.embedPng(input.schoolLogo) : await doc.embedJpg(input.schoolLogo);
    } catch {
      schoolLogo = null; // imagem inválida: o cartão sai sem ela
    }
  }

  for (const card of input.cards) {
    const page = doc.addPage([A4.w, A4.h]);
    drawCard(page, card);
  }

  function drawCard(page: PDFPage, card: AnswerSheetCard) {
    // Marcadores dos cantos (alinhamento da foto).
    for (const f of layout.fiducials) {
      const s = mm(FIDUCIAL_SIZE);
      page.drawRectangle({ x: toX(f.x) - s / 2, y: toY(f.y) - s / 2, width: s, height: s, color: BRAND.black });
    }

    // Faixa de código (identifica avaliação + aluno).
    const bits = encodeSheetNumber(card.sheetNumber);
    for (const g of layout.codeGuards) {
      const s = mm(g.size);
      page.drawRectangle({ x: toX(g.x) - s / 2, y: toY(g.y) - s / 2, width: s, height: s, color: BRAND.black });
    }
    for (const c of layout.codeCells) {
      const s = mm(c.size);
      if (bits[c.bit]) {
        page.drawRectangle({ x: toX(c.x) - s / 2, y: toY(c.y) - s / 2, width: s, height: s, color: BRAND.black });
      } else {
        page.drawRectangle({
          x: toX(c.x) - s / 2, y: toY(c.y) - s / 2, width: s, height: s,
          borderColor: rgb(0.85, 0.87, 0.86), borderWidth: 0.4,
        });
      }
    }

    // Cabeçalho.
    let titleX = mm(26);
    if (logo) {
      const h = mm(11);
      const w = (logo.width / logo.height) * h;
      page.drawImage(logo, { x: mm(14), y: A4.h - mm(22) - h, width: w, height: h });
      titleX = mm(14) + w + mm(5);
    } else {
      drawBrandMark(page, mm(14), mm(24), mm(9));
    }
    // Logo da escola no canto superior direito, num espaço livre: abaixo da faixa do código
    // e afastada do quadrado preto do canto (não atrapalha a leitura pela câmera).
    if (schoolLogo) {
      const boxW = mm(40);
      const boxH = mm(19);
      const scale = Math.min(boxW / schoolLogo.width, boxH / schoolLogo.height);
      const w = schoolLogo.width * scale;
      const h = schoolLogo.height * scale;
      const right = mm(194);
      const top = mm(22);
      page.drawImage(schoolLogo, { x: right - w, y: A4.h - top - (boxH + h) / 2, width: w, height: h });
    }
    drawTextTop(page, "CARTÃO-RESPOSTA", { x: titleX, top: mm(23.5), size: 14, font: bold, color: BRAND.dark });
    drawTextTop(page, `Cartão nº ${String(card.sheetNumber).padStart(7, "0")}`, {
      x: titleX, top: mm(30), size: 8, font: regular, color: BRAND.gray,
    });

    const field = (label: string, value: string, x: number, top: number, w: number) => {
      drawTextTop(page, label.toUpperCase(), { x: mm(x), top: mm(top), size: 6.5, font: bold, color: BRAND.mid });
      const v = sanitize(regular, value);
      let size = 10;
      while (size > 7 && regular.widthOfTextAtSize(v, size) > mm(w - 2)) size -= 0.5;
      drawTextTop(page, v, { x: mm(x), top: mm(top + 3.2), size, font: regular });
      page.drawLine({
        start: { x: mm(x), y: toY(top + 8.5) }, end: { x: mm(x + w), y: toY(top + 8.5) },
        thickness: 0.6, color: BRAND.line,
      });
    };

    field("Avaliação", input.assessmentTitle, 14, 37, 136);
    field("Nome do(a) aluno(a)", card.studentName ?? "", 14, 49, 136);
    field("Disciplina", input.subject ?? "", 14, 61, 64);
    field("Turma", input.className ?? "", 82, 61, 32);
    field("Data", formatDateBR(input.appliedOn), 118, 61, 32);
    field("Escola", input.schoolName ?? "", 14, 73, 136);

    // Nº de chamada: só nos cartões sem aluno definido.
    if (!card.studentName) {
      drawTextTop(page, "Nº DE CHAMADA", { x: mm(158), top: mm(44), size: 6.5, font: bold, color: BRAND.mid });
      drawTextTop(page, "marque os 2 dígitos", { x: mm(158), top: mm(48), size: 6, font: regular, color: BRAND.gray });
      for (const b of layout.rollBubbles) {
        page.drawCircle({ x: toX(b.x), y: toY(b.y), size: mm(b.r), borderColor: BRAND.ink, borderWidth: 0.7 });
        if (b.digit === 0) {
          drawTextTop(page, String(b.value), { x: toX(b.x) - mm(6), top: mm(b.y) - 3.3, size: 7, font: regular, color: BRAND.gray });
        }
      }
    } else if (card.rollNumber) {
      drawTextTop(page, "Nº", { x: mm(158), top: mm(44), size: 6.5, font: bold, color: BRAND.mid });
      drawTextTop(page, String(card.rollNumber), { x: mm(158), top: mm(48), size: 14, font: bold, color: BRAND.ink });
    }

    // Instruções de preenchimento.
    page.drawRectangle({ x: mm(14), y: toY(98), width: mm(136), height: mm(14), color: BRAND.light });
    drawTextTop(page, "Preencha toda a bolha com caneta preta ou azul-escura.", { x: mm(17), top: mm(86.5), size: 8, font: bold, color: BRAND.dark });
    drawTextTop(page, "Não rasure, não dobre e não escreva sobre os quadrados pretos. Uma marcação por questão.", {
      x: mm(17), top: mm(91.5), size: 7, font: regular, color: BRAND.ink,
    });
    // Exemplo de marcação correta.
    page.drawCircle({ x: mm(146), y: toY(91), size: mm(1.65), color: BRAND.black });
    drawTextTop(page, "certo", { x: mm(138.5), top: mm(94.5), size: 6, font: regular, color: BRAND.gray });

    // Grade de respostas.
    for (const h of layout.columnHeaders) {
      const w = bold.widthOfTextAtSize(h.label, 8);
      drawTextTop(page, h.label, { x: toX(h.x) - w / 2, top: mm(h.y) - 3, size: 8, font: bold, color: BRAND.mid });
    }
    for (const q of layout.questionLabels) {
      const label = String(q.number).padStart(2, "0");
      const w = bold.widthOfTextAtSize(label, 9);
      drawTextTop(page, label, { x: toX(q.x) - w / 2 + mm(1), top: mm(q.y) - 3.6, size: 9, font: bold, color: BRAND.ink });
    }
    for (const b of layout.bubbles) {
      page.drawCircle({ x: toX(b.x), y: toY(b.y), size: mm(b.r), borderColor: BRAND.ink, borderWidth: 0.8 });
      // Certo/errado: a letra fica dentro (as colunas A–E não se aplicam).
      if (b.inner) {
        const w = regular.widthOfTextAtSize(b.label, 5);
        drawTextTop(page, b.label, { x: toX(b.x) - w / 2, top: mm(b.y) - 2, size: 5, font: regular, color: rgb(0.7, 0.72, 0.71) });
      }
    }

    drawTextTop(page, `Deixa que eu Corrijo  ·  leitura por câmera  ·  layout v${layout.version}`, {
      x: mm(40), top: mm(289), size: 6.5, font: regular, color: BRAND.gray,
    });
  }

  return doc.save();
}
