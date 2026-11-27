/**
 * PROVA EDITÁVEL (.docx) — modelo de avaliação de larga escala.
 *
 * Padrão pedido pelos professores: A4, Arial 12, texto justificado,
 * espaçamento 1,5, numeração automática "QUESTÃO 01", capa com cabeçalho
 * (os mesmos dados do cartão-resposta) e instruções numeradas.
 * Cada questão fica "presa" (manter com o próximo) para não ser cortada
 * entre páginas quando o professor editar no Word.
 */
import { tidyText } from "@/lib/assessment/tidy-text";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Packer,
  SectionType,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import JSZip from "jszip";
import type { AssessmentQuestion } from "@/lib/models/types";
import { QUESTION_LABEL, formatDateBR, type ExamHeader } from "@/lib/assessment/header";
import { imageSize } from "@/lib/assessment/image-size";
import { markupToDocx } from "./math-runs";

const FONT = "Arial";
const SIZE = 20; // meio-pontos → 10 pt (questões)
const COVER = 22; // capa: 11 pt
const LINE_15 = { line: 360, lineRule: LineRuleType.AUTO }; // espaçamento 1,5
const DARK = "0B3A1E";
const MID = "137A1A";
const GRAY = "5F6B65";
const LIGHT = "F0F8EB";

// A4 com margens de 2 cm (1134 DXA) → largura útil 9638 DXA
const PAGE_W = 11906;
const MARGIN = 1134;
const CONTENT_W = PAGE_W - 2 * MARGIN;
// Questões em duas colunas (economia de papel), com 1 cm entre as colunas.
const COL_GAP = 567;
const COL_W = Math.floor((CONTENT_W - COL_GAP) / 2);

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "B8C2BC" };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function fieldCell(label: string, value: string, width: number) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    verticalAlign: VerticalAlign.TOP,
    children: [
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: label.toUpperCase(), bold: true, size: 14, color: MID, font: FONT })],
      }),
      new Paragraph({
        spacing: { after: 20 },
        children: [new TextRun({ text: value || " ", size: COVER, font: FONT })],
      }),
    ],
  });
}

function row(cells: [string, string, number][]) {
  return new TableRow({ cantSplit: true, children: cells.map(([l, v, w]) => fieldCell(l, v, w)) });
}

export interface DocxOptions {
  /** Logo da escola (JPEG ou PNG). */
  schoolLogo?: Uint8Array | null;
  /** Nome e nº do aluno já preenchidos na capa. */
  student?: { name: string; rollNumber?: number | null } | null;
}

function coverPage(h: ExamHeader, opts: DocxOptions): (Paragraph | Table)[] {
  const half = Math.round(CONTENT_W / 2);
  const twoThirds = Math.round((CONTENT_W * 3) / 4);
  const out: (Paragraph | Table)[] = [];

  if (opts.schoolLogo?.length) {
    const kind = opts.schoolLogo[0] === 0x89 ? "png" : "jpg";
    const { width, height } = imageSize(opts.schoolLogo, kind);
    const sc = Math.min(83 / height, 265 / width); // até ~2,2 cm de altura e 7 cm de largura
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new ImageRun({ type: kind, data: opts.schoolLogo, transformation: { width: Math.round(width * sc), height: Math.round(height * sc) } }),
        ],
      }),
    );
  }

  if (h.schoolName) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: h.schoolName.toUpperCase(), bold: true, size: COVER, color: DARK, font: FONT })],
      }),
    );
  }
  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 80 },
      children: [new TextRun({ text: h.title, bold: true, size: 32, color: DARK, font: FONT })],
    }),
  );
  const sub = [h.subject, h.gradeLevel].filter(Boolean).join("  •  ");
  if (sub) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 280 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: MID, space: 8 } },
        children: [new TextRun({ text: sub, size: COVER, color: GRAY, font: FONT })],
      }),
    );
  }

  out.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [twoThirds, CONTENT_W - twoThirds],
      rows: [
        row([
          ["Nome do(a) aluno(a)", opts.student?.name ?? "", twoThirds],
          ["Nº", opts.student?.rollNumber ? String(opts.student.rollNumber) : "", CONTENT_W - twoThirds],
        ]),
      ],
    }),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [half, CONTENT_W - half],
      rows: [
        row([
          ["Turma", h.className, half],
          ["Data", formatDateBR(h.appliedOn), CONTENT_W - half],
        ]),
        row([
          ["Disciplina", h.subject, half],
          ["Professor(a)", h.teacherName, CONTENT_W - half],
        ]),
      ],
    }),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [CONTENT_W],
      rows: [row([["Assinatura do(a) estudante", "", CONTENT_W]])],
    }),
  );
  if (h.versionLetter) {
    out.push(
      new Paragraph({
        spacing: { before: 240, after: 0 },
        shading: { type: ShadingType.CLEAR, color: "auto", fill: DARK },
        children: [new TextRun({ text: ` VERSÃO DA PROVA: ${h.versionLetter} `, bold: true, size: 32, color: "FFFFFF", font: FONT })],
      }),
      new Paragraph({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: DARK },
        children: [
          new TextRun({ text: ` Pinte a letra ${h.versionLetter} no campo VERSÃO DA PROVA do seu cartão-resposta. `, size: 18, color: "FFFFFF", font: FONT }),
        ],
      }),
    );
  }

  out.push(
    new Paragraph({
      spacing: { before: 360, after: 120 },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: LIGHT },
      children: [new TextRun({ text: "INSTRUÇÕES", bold: true, size: COVER, color: DARK, font: FONT })],
    }),
    ...h.instructions.map(
      (text) =>
        new Paragraph({
          numbering: { reference: "instrucoes", level: 0 },
          alignment: AlignmentType.JUSTIFIED,
          spacing: { ...LINE_15, after: 60 },
          children: [new TextRun({ text, size: COVER, font: FONT })],
        }),
    ),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480 },
      children: [
        new TextRun({ text: "AGUARDE A AUTORIZAÇÃO DO APLICADOR PARA INICIAR A PROVA.", bold: true, size: COVER, color: DARK, font: FONT }),
      ],
    }),
  );
  return out;
}

/** Faixa com o nome da seção (disciplina na Prova Multi). */
function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 280, after: 60 },
    shading: { type: ShadingType.CLEAR, fill: DARK, color: "auto" },
    children: [new TextRun({ text: ` ${text.toUpperCase()} `, bold: true, size: SIZE, color: "FFFFFF", font: FONT })],
  });
}

function questionBlocks(q: AssessmentQuestion, number: number): (Paragraph | Table)[] {
  const blocks: (Paragraph | Table)[] = [];
  // Sem "manter com o próximo" em tudo: o Word encaixa as questões uma embaixo da outra
  // e só segura junto o que não deve separar (título + início, última linha do enunciado
  // + 1ª alternativa, cada alternativa inteira, as duas últimas alternativas).
  const keep = { keepNext: true, keepLines: true };

  const heading: TextRun[] = [new TextRun({ text: QUESTION_LABEL(number), bold: true, size: SIZE, color: DARK, font: FONT })];
  if (q.weight !== 1) {
    const v = q.weight.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    heading.push(new TextRun({ text: `   (${v} ${q.weight === 1 ? "ponto" : "pontos"})`, italics: true, size: 20, color: GRAY, font: FONT }));
  }
  blocks.push(new Paragraph({ ...keep, spacing: { before: 240, after: 80 }, children: heading }));

  const paragraphs = tidyText(q.statement).split(/\n/).filter((p) => p.trim() !== "");
  const stmt = paragraphs.length ? paragraphs : [" "];
  stmt.forEach((p, i) =>
    blocks.push(
      new Paragraph({
        keepNext: i === stmt.length - 1, // o fim do enunciado fica com o que vem depois
        widowControl: true,
        alignment: AlignmentType.JUSTIFIED,
        spacing: { ...LINE_15, after: 80 },
        children: markupToDocx(p, { size: SIZE, font: FONT }),
      }),
    ),
  );

  if (q.image) {
    const { width, height } = imageSize(q.image.bytes, q.image.kind);
    // Mesmo ajuste do PDF: largura da coluna, até 7,5 cm de altura, sem ampliar além de 150 dpi.
    const maxPx = Math.min(Math.round(((q.image.widthMm ?? 120) / 25.4) * 96), Math.round((COL_W / 1440) * 96));
    const maxHpx = Math.round((75 / 25.4) * 96);
    const scale = Math.min(96 / 150, maxPx / width, maxHpx / height);
    blocks.push(
      new Paragraph({
        ...keep,
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new ImageRun({
            type: q.image.kind,
            data: q.image.bytes,
            transformation: { width: Math.round(width * scale), height: Math.round(height * scale) },
          }),
        ],
      }),
    );
  }

  if (q.table_data?.rows?.length) {
    const rows = q.table_data.rows;
    const ncols = Math.max(...rows.map((r) => r.length));
    const colW = Math.floor(COL_W / ncols);
    const widths = Array.from({ length: ncols }, (_, i) => (i === ncols - 1 ? COL_W - colW * (ncols - 1) : colW));
    blocks.push(
      new Table({
        width: { size: COL_W, type: WidthType.DXA },
        columnWidths: widths,
        rows: rows.map(
          (r, ri) =>
            new TableRow({
              cantSplit: true,
              children: widths.map(
                (w, ci) =>
                  new TableCell({
                    width: { size: w, type: WidthType.DXA },
                    borders,
                    shading: ri === 0 ? { type: ShadingType.CLEAR, color: "auto", fill: LIGHT } : undefined,
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [
                      new Paragraph({
                        keepNext: true,
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: r[ci] ?? "", bold: ri === 0, size: 22, font: FONT })],
                      }),
                    ],
                  }),
              ),
            }),
        ),
      }),
      new Paragraph({ keepNext: true, spacing: { after: 60 }, children: [] }),
    );
  }

  if (q.type === "multiple_choice") {
    q.options.forEach((opt, i) => {
      blocks.push(
        new Paragraph({
          keepNext: i === q.options.length - 2, // as duas últimas alternativas ficam juntas
          keepLines: true,
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: 567, hanging: 567 },
          tabStops: [{ type: TabStopType.LEFT, position: 567 }],
          spacing: { ...LINE_15, after: 40 },
          children: [
            new TextRun({ text: `(${opt.label})`, bold: true, size: SIZE, color: MID, font: FONT }),
            new TextRun({ text: "\t", size: SIZE, font: FONT }),
            ...markupToDocx(tidyText(opt.text), { size: SIZE, font: FONT }),
          ],
        }),
      );
    });
  } else if (q.type === "true_false") {
    blocks.push(
      new Paragraph({
        spacing: { ...LINE_15 },
        children: [new TextRun({ text: "(     ) Certo          (     ) Errado", size: SIZE, font: FONT })],
      }),
    );
  } else if (q.type === "numeric") {
    blocks.push(
      new Paragraph({
        spacing: { ...LINE_15 },
        children: [
          new TextRun({ text: "Tipo B: marque a resposta no cartão-resposta (centena, dezena e unidade).", italics: true, size: SIZE - 4, color: GRAY, font: FONT }),
        ],
      }),
    );
  } else if (q.type === "lined") {
    // Tipo D: quadro com 10 linhas numeradas
    const border = { style: BorderStyle.SINGLE, size: 6, color: "1F2A24" };
    const thin = { style: BorderStyle.SINGLE, size: 4, color: "B8C2BC" };
    const NUM = 520;
    blocks.push(
      new Table({
        width: { size: COL_W, type: WidthType.DXA },
        columnWidths: [NUM, COL_W - NUM],
        borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: thin, insideVertical: border },
        rows: Array.from(
          { length: 10 },
          (_, i) =>
            new TableRow({
              cantSplit: true,
              height: { value: 440, rule: HeightRule.EXACT },
              children: [
                new TableCell({
                  width: { size: NUM, type: WidthType.DXA },
                  margins: { left: 40, right: 40 },
                  verticalAlign: "center",
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, keepNext: i < 9, children: [new TextRun({ text: String(i + 1), size: 16, color: GRAY, font: FONT })] })],
                }),
                new TableCell({ width: { size: COL_W - NUM, type: WidthType.DXA }, children: [new Paragraph({ keepNext: i < 9, children: [] })] }),
              ],
            }),
        ),
      }),
    );
  } else {
    // Linhas para resposta: tabela só com bordas inferiores (parágrafos com
    // a mesma borda seriam agrupados numa caixa só pelo Word).
    const lines = q.type === "short_answer" ? 2 : 6;
    const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const line = { style: BorderStyle.SINGLE, size: 4, color: "B8C2BC" };
    blocks.push(
      new Table({
        width: { size: COL_W, type: WidthType.DXA },
        columnWidths: [COL_W],
        borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
        rows: Array.from(
          { length: lines },
          () =>
            new TableRow({
              cantSplit: true,
              height: { value: 480, rule: HeightRule.EXACT },
              children: [
                new TableCell({
                  width: { size: COL_W, type: WidthType.DXA },
                  borders: { top: none, left: none, right: none, bottom: line },
                  children: [new Paragraph({ keepNext: true, children: [] })],
                }),
              ],
            }),
        ),
      }),
    );
  }
  return blocks;
}

export async function generateAssessmentDocx(header: ExamHeader, questions: AssessmentQuestion[], opts: DocxOptions = {}): Promise<Uint8Array> {
  const sorted = [...questions].sort((a, b) => a.position - b.position);

  const runningHeader = new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "B8C2BC", space: 4 } },
        children: [
          // logo da escola pequena em todas as páginas de questões
          ...(opts.schoolLogo?.length
            ? (() => {
                const kind = opts.schoolLogo[0] === 0x89 ? "png" : "jpg";
                const { width, height } = imageSize(opts.schoolLogo, kind);
                const sc = Math.min(22 / height, 100 / width); // ~0,6 cm de altura
                return [
                  new ImageRun({ type: kind, data: opts.schoolLogo, transformation: { width: Math.round(width * sc), height: Math.round(height * sc) } }),
                  new TextRun({ text: "  ", size: 16, font: FONT }),
                ];
              })()
            : []),
          new TextRun({ text: header.title, bold: true, size: 16, color: MID, font: FONT }),
          new TextRun({
            text: `\tAluno(a): ${opts.student?.name ?? "________________________________"}`,
            size: 16,
            color: GRAY,
            font: FONT,
          }),
        ],
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [
          new TextRun({ text: [header.subject, header.className].filter(Boolean).join(" — "), size: 16, color: GRAY, font: FONT }),
          new TextRun({ text: "\tPágina ", size: 16, bold: true, color: MID, font: FONT }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, bold: true, color: MID, font: FONT }),
          new TextRun({ text: " de ", size: 16, bold: true, color: MID, font: FONT }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, bold: true, color: MID, font: FONT }),
        ],
      }),
    ],
  });

  const pageProps = {
    size: { width: PAGE_W, height: 16838 },
    margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 567, footer: 567 },
  };

  const doc = new Document({
    creator: "Deixa que eu Corrijo",
    title: header.title,
    styles: {
      default: {
        document: { run: { font: FONT, size: SIZE }, paragraph: { spacing: LINE_15 } },
      },
    },
    numbering: {
      config: [
        {
          reference: "instrucoes",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 567, hanging: 397 } }, run: { font: FONT, size: SIZE, bold: true, color: MID } },
            },
          ],
        },
      ],
    },
    sections: [
      // 1) Capa: largura total, sem cabeçalho/rodapé.
      {
        properties: { page: pageProps },
        headers: { default: new Header({ children: [new Paragraph({ children: [] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ children: [] })] }) },
        children: coverPage(header, opts),
      },
      // 2) Questões em duas colunas, começando na página seguinte.
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: pageProps,
          column: { count: 2, space: COL_GAP, separate: true, equalWidth: true },
        },
        headers: { default: runningHeader },
        footers: { default: footer },
        children: sorted.flatMap((q, i) => [
          ...((q.section ?? "").trim() && (q.section ?? "").trim() !== (sorted[i - 1]?.section ?? "").trim()
            ? [sectionHeading((q.section ?? "").trim())]
            : []),
          ...questionBlocks(q, i + 1),
        ]),
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  // Remove as entradas de pasta do ZIP: o Word/OneDrive/Google Drive às vezes
  // recusa abrir .docx que as contenham.
  const zip = await JSZip.loadAsync(buf);
  // (zip.remove() de uma pasta apagaria os arquivos dentro dela; só tiramos a entrada.)
  for (const name of Object.keys(zip.files)) if (zip.files[name].dir) delete zip.files[name];
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
