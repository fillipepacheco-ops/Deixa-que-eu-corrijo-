/**
 * Lê um arquivo Word (.docx) no navegador: parágrafos (com a numeração
 * automática do Word), fórmulas (equações do Word, expoente/índice) e imagens.
 */
import JSZip from "jszip";
import { ommlToMarkup } from "@/lib/math/paste";
import type { TextBlock } from "./parse-questions";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export interface DocxContent {
  blocks: TextBlock[];
  images: Map<string, Blob>;
}

const kids = (el: Element) => Array.from(el.children);
const wAttr = (el: Element | null | undefined, name: string) => el?.getAttributeNS(W, name) ?? el?.getAttribute(`w:${name}`) ?? null;
const child = (el: Element | null | undefined, name: string) => (el ? kids(el).find((k) => k.localName === name) ?? null : null);

// ---------- numeração automática ----------
interface Level {
  fmt: string;
  text: string;
  start: number;
}

function toLetter(n: number) {
  let s = "";
  while (n > 0) {
    n--;
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}
function toRoman(n: number) {
  const map: [number, string][] = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let s = "";
  for (const [v, r] of map) while (n >= v) (s += r), (n -= v);
  return s;
}
function formatCounter(n: number, fmt: string) {
  switch (fmt) {
    case "lowerLetter":
      return toLetter(n);
    case "upperLetter":
      return toLetter(n).toUpperCase();
    case "lowerRoman":
      return toRoman(n);
    case "upperRoman":
      return toRoman(n).toUpperCase();
    case "decimalZero":
      return String(n).padStart(2, "0");
    case "bullet":
    case "none":
      return "";
    default:
      return String(n);
  }
}

function readNumbering(xml: string | null) {
  const levels = new Map<string, Map<number, Level>>(); // numId → nível → formato
  if (!xml) return levels;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const abstract = new Map<string, Map<number, Level>>();
  for (const a of Array.from(doc.getElementsByTagNameNS(W, "abstractNum"))) {
    const m = new Map<number, Level>();
    for (const lvl of kids(a).filter((k) => k.localName === "lvl")) {
      m.set(Number(wAttr(lvl, "ilvl") ?? 0), {
        fmt: wAttr(child(lvl, "numFmt"), "val") ?? "decimal",
        text: wAttr(child(lvl, "lvlText"), "val") ?? "%1.",
        start: Number(wAttr(child(lvl, "start"), "val") ?? 1),
      });
    }
    abstract.set(wAttr(a, "abstractNumId") ?? "", m);
  }
  for (const n of Array.from(doc.getElementsByTagNameNS(W, "num"))) {
    const id = wAttr(child(n, "abstractNumId"), "val") ?? "";
    if (abstract.has(id)) levels.set(wAttr(n, "numId") ?? "", abstract.get(id)!);
  }
  return levels;
}

// ---------- conteúdo ----------
export async function extractDocx(data: ArrayBuffer): Promise<DocxContent> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error("Não consegui abrir o arquivo. Se for um Word antigo (.doc), abra no Word e salve como .docx.");
  }
  const main = zip.file("word/document.xml");
  if (!main) throw new Error("Este arquivo não parece ser um documento do Word (.docx).");
  const [xml, relsXml, numXml] = await Promise.all([
    main.async("string"),
    zip.file("word/_rels/document.xml.rels")?.async("string") ?? Promise.resolve(""),
    zip.file("word/numbering.xml")?.async("string") ?? Promise.resolve(null),
  ]);

  const rels = new Map<string, string>();
  if (relsXml) {
    const rd = new DOMParser().parseFromString(relsXml, "application/xml");
    for (const r of Array.from(rd.getElementsByTagName("Relationship"))) rels.set(r.getAttribute("Id") ?? "", r.getAttribute("Target") ?? "");
  }
  const numbering = readNumbering(numXml);
  const counters = new Map<string, number[]>(); // numId → contador por nível

  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const body = doc.getElementsByTagNameNS(W, "body")[0];
  const blocks: TextBlock[] = [];
  const images = new Map<string, Blob>();
  const wanted = new Set<string>();

  const listPrefix = (p: Element) => {
    const numPr = child(child(p, "pPr"), "numPr");
    if (!numPr) return "";
    const numId = wAttr(child(numPr, "numId"), "val") ?? "";
    const ilvl = Number(wAttr(child(numPr, "ilvl"), "val") ?? 0);
    const lv = numbering.get(numId);
    if (!lv || numId === "0") return "";
    const c = counters.get(numId) ?? [];
    for (let i = 0; i <= ilvl; i++) c[i] ??= (lv.get(i)?.start ?? 1) - 1;
    c[ilvl]++;
    c.length = ilvl + 1; // níveis abaixo recomeçam
    counters.set(numId, c);
    const level = lv.get(ilvl);
    if (!level || level.fmt === "bullet" || level.fmt === "none") return "";
    return level.text.replace(/%(\d)/g, (_, k) => formatCounter(c[Number(k) - 1] ?? 1, lv.get(Number(k) - 1)?.fmt ?? "decimal")) + " ";
  };

  const run = (r: Element, out: string[], imgs: string[]) => {
    const rPr = child(r, "rPr");
    const va = wAttr(child(rPr, "vertAlign"), "val");
    let text = "";
    for (const k of kids(r)) {
      if (k.localName === "t") text += k.textContent ?? "";
      else if (k.localName === "tab") text += " ";
      else if (k.localName === "br" || k.localName === "cr") text += " ";
      else if (k.localName === "drawing" || k.localName === "pict" || k.localName === "object" || k.localName === "AlternateContent") {
        const blips = [...Array.from(k.getElementsByTagNameNS("*", "blip")), ...Array.from(k.getElementsByTagNameNS("*", "imagedata"))];
        for (const b of blips) {
          const id = b.getAttributeNS(R, "embed") || b.getAttributeNS(R, "id") || b.getAttribute("r:embed") || b.getAttribute("r:id");
          const target = id ? rels.get(id) : null;
          if (target && /^(?!https?:)/.test(target)) {
            const path = target.startsWith("/") ? target.slice(1) : `word/${target}`;
            if (!imgs.includes(path)) imgs.push(path);
            wanted.add(path);
          }
        }
      }
    }
    if (!text) return;
    if (va === "superscript" && text.trim()) out.push(`^{${text.trim()}}`);
    else if (va === "subscript" && text.trim()) out.push(`_{${text.trim()}}`);
    else out.push(text);
  };

  const inline = (el: Element, out: string[], imgs: string[]) => {
    for (const k of kids(el)) {
      const n = k.localName;
      if (n === "r") run(k, out, imgs);
      else if (n === "oMath" || n === "oMathPara") out.push(" " + ommlToMarkup(k).trim() + " ");
      else if (n === "pPr" || n === "rPr" || n === "del" || n === "moveFrom") continue;
      else inline(k, out, imgs); // hyperlink, ins, smartTag, sdt...
    }
  };

  const paragraph = (p: Element) => {
    const out: string[] = [];
    const imgs: string[] = [];
    inline(p, out, imgs);
    const text = (listPrefix(p) + out.join("")).replace(/\s+/g, " ").trim();
    if (text || imgs.length) blocks.push({ text, newParagraph: true, images: imgs.length ? imgs : undefined });
  };

  // Linha de tabela: uma linha de texto com as células separadas por " | ".
  // Se cada célula é uma alternativa ("a) ..."), cada uma vira uma linha.
  const row = (tr: Element) => {
    const cells: { text: string; imgs: string[] }[] = [];
    for (const tc of kids(tr).filter((k) => k.localName === "tc")) {
      const before = blocks.length;
      container(tc);
      const inner = blocks.splice(before);
      cells.push({ text: inner.map((b) => b.text).filter(Boolean).join(" "), imgs: inner.flatMap((b) => b.images ?? []) });
    }
    const filled = cells.filter((c) => c.text || c.imgs.length);
    if (!filled.length) return;
    if (filled.every((c) => /^\(?\s*[A-Ea-e]\s*[).]/.test(c.text))) {
      for (const c of filled) blocks.push({ text: c.text, newParagraph: true, images: c.imgs.length ? c.imgs : undefined });
    } else {
      const imgs = filled.flatMap((c) => c.imgs);
      blocks.push({ text: filled.map((c) => c.text).join(" | "), newParagraph: true, images: imgs.length ? imgs : undefined });
    }
  };

  const container = (el: Element) => {
    for (const k of kids(el)) {
      if (k.localName === "p") paragraph(k);
      else if (k.localName === "tr") row(k);
      else if (k.localName === "tbl" || k.localName === "sdt" || k.localName === "sdtContent" || k.localName === "txbxContent" || k.localName === "customXml") container(k);
    }
  };
  if (body) container(body);

  await Promise.all(
    [...wanted].map(async (path) => {
      const f = zip.file(path);
      if (!f) return;
      const ext = path.split(".").pop()?.toLowerCase() ?? "";
      const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : ext === "bmp" ? "image/bmp" : ext === "webp" ? "image/webp" : "";
      if (!mime) return; // EMF/WMF não abrem no navegador
      images.set(path, new Blob([await f.async("arraybuffer")], { type: mime }));
    }),
  );
  for (const b of blocks) if (b.images) b.images = b.images.filter((i) => images.has(i));
  return { blocks, images };
}
