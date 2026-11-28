/**
 * Lê no navegador a lista de alunos de um arquivo (Excel, CSV, Word ou PDF)
 * e devolve as linhas "nº;nome;matrícula" para o professor conferir.
 */
import JSZip from "jszip";
import { finishRoster, parseCsv, rosterFromLines, rosterFromRows } from "./roster";

const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");
const byTag = (el: Document | Element, tag: string) => Array.from(el.getElementsByTagNameNS("*", tag));

function colIndex(ref: string) {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

async function readXlsx(data: ArrayBuffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(data);
  const shared = zip.file("xl/sharedStrings.xml");
  const strings = shared ? byTag(xml(await shared.async("string")), "si").map((si) => byTag(si, "t").map((t) => t.textContent ?? "").join("")) : [];
  // primeira planilha do arquivo
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = zip.file("xl/workbook.xml");
  const rels = zip.file("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const first = byTag(xml(await wb.async("string")), "sheet")[0];
    const rid = first?.getAttribute("r:id") ?? first?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const target = byTag(xml(await rels.async("string")), "Relationship").find((r) => r.getAttribute("Id") === rid)?.getAttribute("Target");
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  }
  const sheet = zip.file(sheetPath) ?? zip.file(/xl\/worksheets\/sheet\d+\.xml/)[0];
  if (!sheet) throw new Error("Não encontrei a planilha dentro do arquivo.");
  const rows: string[][] = [];
  for (const row of byTag(xml(await sheet.async("string")), "row")) {
    const cells: string[] = [];
    for (const c of byTag(row, "c")) {
      const t = c.getAttribute("t");
      const v = byTag(c, "v")[0]?.textContent ?? "";
      const text = t === "s" ? (strings[Number(v)] ?? "") : t === "inlineStr" ? byTag(c, "t").map((x) => x.textContent ?? "").join("") : v;
      cells[colIndex(c.getAttribute("r") ?? "A1")] = text;
    }
    rows.push(Array.from(cells, (x) => x ?? ""));
  }
  return rows;
}

async function readDocx(data: ArrayBuffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(data);
  const main = zip.file("word/document.xml");
  if (!main) throw new Error("Este arquivo não parece ser um documento do Word (.docx).");
  const doc = xml(await main.async("string"));
  const paraText = (p: Element) => byTag(p, "t").map((t) => t.textContent ?? "").join("");
  // tabelas: cada linha da tabela é uma linha da planilha
  const tables = byTag(doc, "tbl").filter((t) => !t.parentElement?.closest?.("tbl"));
  const fromTables: string[] = [];
  for (const tbl of tables) {
    const rows = Array.from(tbl.children)
      .filter((k) => k.localName === "tr")
      .map((tr) =>
        Array.from(tr.children)
          .filter((k) => k.localName === "tc")
          .map((tc) => byTag(tc, "p").map(paraText).join(" ")),
      );
    fromTables.push(...rosterFromRows(rows));
  }
  if (fromTables.length) return fromTables;
  // sem tabela: um aluno por parágrafo
  return rosterFromLines(byTag(doc, "p").map(paraText));
}

async function readPdf(data: ArrayBuffer): Promise<string[]> {
  const { loadPdfJs } = await import("@/components/viewer/render-pdf");
  const pdfjs = await loadPdfJs(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString());
  const { extractPdf } = await import("@/lib/import/pdf-extract");
  const blocks = await extractPdf(pdfjs, data);
  if (!blocks.length) throw new Error("Este PDF parece ser uma foto/digitalização: não tem texto para ler.");
  return rosterFromLines(blocks.flatMap((b) => b.text.split(/\n/)));
}

export async function readRosterFile(file: File): Promise<string[]> {
  return finishRoster(await readAny(file));
}

async function readAny(file: File): Promise<string[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls")) throw new Error("Arquivo .xls (Excel antigo): abra no Excel e salve como .xlsx ou .csv.");
  if (name.endsWith(".doc")) throw new Error("Arquivo .doc (Word antigo): abra no Word e salve como .docx.");
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type.startsWith("text/")) {
    const text = await file.text();
    const rows = rosterFromRows(parseCsv(text));
    return rows.length ? rows : rosterFromLines(text.split(/\r?\n/));
  }
  const data = await file.arrayBuffer();
  if (name.endsWith(".xlsx") || name.endsWith(".xlsm") || (!name.endsWith(".ods") && file.type.includes("spreadsheetml"))) {
    return rosterFromRows(await readXlsx(data));
  }
  if (name.endsWith(".docx")) return readDocx(data);
  if (name.endsWith(".pdf") || file.type === "application/pdf") return readPdf(data);
  throw new Error("Use um arquivo Excel (.xlsx), CSV, Word (.docx) ou PDF.");
}
