/**
 * FÓRMULAS NO WORD — expoente/índice simples viram texto sobrescrito/subscrito
 * (continua em Arial); fração e raiz viram equações nativas do Word,
 * que o professor pode editar com o editor de equações.
 */
import { Math as DocxMath, MathFraction, MathRadical, MathRun, MathSubScript, MathSuperScript, TextRun, type MathComponent, type ParagraphChild } from "docx";
import { parseMath, type MathNode } from "@/lib/math/parse";

type RunStyle = { font: string; size: number; bold?: boolean; color?: string };

function toMath(nodes: MathNode[]): MathComponent[] {
  return nodes.map((n): MathComponent => {
    switch (n.t) {
      case "text":
        return new MathRun(n.s);
      case "sup":
        return new MathSuperScript({ children: toMath(n.base.length ? n.base : [{ t: "text", s: "" }]), superScript: toMath(n.exp) });
      case "sub":
        return new MathSubScript({ children: toMath(n.base.length ? n.base : [{ t: "text", s: "" }]), subScript: toMath(n.idx) });
      case "frac":
        return new MathFraction({ numerator: toMath(n.num), denominator: toMath(n.den) });
      case "sqrt":
        return new MathRadical({ children: toMath(n.body), ...(n.index ? { degree: toMath(n.index) } : {}) });
    }
  });
}

const isText = (nodes: MathNode[]) => nodes.every((n) => n.t === "text");
const plain = (nodes: MathNode[]) => nodes.map((n) => (n.t === "text" ? n.s : "")).join("");

/** Converte texto com marcação de fórmulas em filhos de um parágrafo do Word. */
export function markupToDocx(markup: string, style: RunStyle): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const n of parseMath(markup)) {
    if (n.t === "text") {
      out.push(new TextRun({ text: n.s, ...style }));
    } else if (n.t === "sup" && isText(n.base) && isText(n.exp)) {
      if (n.base.length) out.push(new TextRun({ text: plain(n.base), ...style }));
      out.push(new TextRun({ text: plain(n.exp), superScript: true, ...style }));
    } else if (n.t === "sub" && isText(n.base) && isText(n.idx)) {
      if (n.base.length) out.push(new TextRun({ text: plain(n.base), ...style }));
      out.push(new TextRun({ text: plain(n.idx), subScript: true, ...style }));
    } else {
      out.push(new DocxMath({ children: toMath([n]) }));
    }
  }
  return out;
}
