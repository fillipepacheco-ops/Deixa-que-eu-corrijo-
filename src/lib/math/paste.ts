/**
 * COLAGEM INTELIGENTE — converte o que o professor colar (Word, Google Docs,
 * páginas da internet, PDFs) para a marcação de fórmulas.
 *
 *  - Word (equações nativas OMML): fração, expoente, índice, raiz, parênteses
 *  - HTML: <sup>, <sub>, estilo "vertical-align: super/sub"
 *  - MathML (sites, Wikipedia, KaTeX, MathJax): usa o LaTeX embutido ou converte
 *  - Texto puro: x², a₁, ½, √2, ∛8
 *
 * Roda no navegador (usa DOMParser).
 */

// ---------- texto puro ----------------------------------------------------
const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "-", "⁽": "(", "⁾": ")", "ⁿ": "n", "ˣ": "x", "ʸ": "y" };
const SUB: Record<string, string> = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9", "₊": "+", "₋": "-", "ₙ": "n", "ₓ": "x" };
const VULGAR: Record<string, [string, string]> = {
  "½": ["1", "2"], "⅓": ["1", "3"], "⅔": ["2", "3"], "¼": ["1", "4"], "¾": ["3", "4"], "⅕": ["1", "5"], "⅖": ["2", "5"],
  "⅗": ["3", "5"], "⅘": ["4", "5"], "⅙": ["1", "6"], "⅚": ["5", "6"], "⅛": ["1", "8"], "⅜": ["3", "8"], "⅝": ["5", "8"], "⅞": ["7", "8"],
};

/** "x²" → "x^{2}", "a₁" → "a_{1}", "½" → "\frac{1}{2}", "√2" → "\sqrt{2}". */
export function plainToMarkup(text: string): string {
  let s = text;
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁽⁾ⁿˣʸ]+/g, (m) => `^{${[...m].map((c) => SUP[c]).join("")}}`);
  s = s.replace(/[₀₁₂₃₄₅₆₇₈₉₊₋ₙₓ]+/g, (m) => `_{${[...m].map((c) => SUB[c]).join("")}}`);
  s = s.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (c) => `\\frac{${VULGAR[c][0]}}{${VULGAR[c][1]}}`);
  // raízes: √(x+1), √x, √25, ∛8, ∜16
  const root = (sym: string, idx: string) => {
    const pre = idx ? `\\sqrt[${idx}]` : "\\sqrt";
    s = s.replace(new RegExp(`${sym}\\s*\\(([^()]*)\\)`, "g"), (_, a) => `${pre}{${a}}`);
    s = s.replace(new RegExp(`${sym}\\s*([0-9]+(?:[.,][0-9]+)?|[A-Za-zα-ω])`, "g"), (_, a) => `${pre}{${a}}`);
  };
  root("√", "");
  root("∛", "3");
  root("∜", "4");
  return s;
}

// ---------- LaTeX vindo de sites ------------------------------------------
/** Ajusta LaTeX "de verdade" para o subconjunto suportado. */
export function normalizeLatex(tex: string): string {
  return tex
    .replace(/\\(displaystyle|textstyle|scriptstyle|left|right|big|Big|bigg|Bigg)\b/g, "")
    .replace(/\\(text|mathrm|mathbf|mathit|operatorname|textrm|mbox)\s*\{([^{}]*)\}/g, "$2")
    .replace(/\\[,;:! ]/g, " ")
    .replace(/\\quad|\\qquad/g, "  ")
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}")
    .replace(/\\%/g, "%")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- MathML --------------------------------------------------------
const kids = (el: Element) => Array.from(el.children);

function grp(s: string) {
  return s.length === 1 ? s : `{${s}}`;
}

export function mathmlToMarkup(el: Element): string {
  const tag = el.localName;
  if (tag === "math" || tag === "semantics") {
    const tex = el.querySelector('annotation[encoding="application/x-tex"]')?.textContent || el.getAttribute("alttext");
    if (tex) return normalizeLatex(tex);
  }
  const c = kids(el);
  switch (tag) {
    case "annotation":
    case "annotation-xml":
      return "";
    case "mi":
    case "mn":
    case "mo":
    case "mtext":
    case "ms":
      return el.textContent ?? "";
    case "mspace":
      return " ";
    case "mfrac":
      return `\\frac{${mathmlToMarkup(c[0])}}{${mathmlToMarkup(c[1])}}`;
    case "msup":
      return `${mathmlToMarkup(c[0])}^{${mathmlToMarkup(c[1])}}`;
    case "msub":
      return `${mathmlToMarkup(c[0])}_{${mathmlToMarkup(c[1])}}`;
    case "msubsup":
      return `${mathmlToMarkup(c[0])}_{${mathmlToMarkup(c[1])}}^{${mathmlToMarkup(c[2])}}`;
    case "msqrt":
      return `\\sqrt{${c.map(mathmlToMarkup).join("")}}`;
    case "mroot":
      return `\\sqrt[${mathmlToMarkup(c[1])}]{${mathmlToMarkup(c[0])}}`;
    case "mfenced": {
      const open = el.getAttribute("open") ?? "(";
      const close = el.getAttribute("close") ?? ")";
      return `${open}${c.map(mathmlToMarkup).join(el.getAttribute("separators") ?? ",")}${close}`;
    }
    case "semantics":
      return c[0] ? mathmlToMarkup(c[0]) : "";
    default:
      return c.length ? c.map(mathmlToMarkup).join("") : (el.textContent ?? "");
  }
}

// ---------- Word (OMML) ---------------------------------------------------
function ommlChild(el: Element, name: string): Element | undefined {
  return kids(el).find((k) => k.localName === name);
}

function ommlAttr(el: Element | undefined, name: string): string | null {
  if (!el) return null;
  for (const a of Array.from(el.attributes)) if (a.localName === name) return a.value;
  return null;
}

export function ommlToMarkup(el: Element): string {
  const tag = el.localName;
  const inner = (name: string) => {
    const k = ommlChild(el, name);
    return k ? ommlToMarkup(k) : "";
  };
  switch (tag) {
    case "t":
      return el.textContent ?? "";
    case "f":
      return `\\frac{${inner("num")}}{${inner("den")}}`;
    case "sSup":
      return `${grp(inner("e"))}^{${inner("sup")}}`;
    case "sSub":
      return `${grp(inner("e"))}_{${inner("sub")}}`;
    case "sSubSup":
      return `${grp(inner("e"))}_{${inner("sub")}}^{${inner("sup")}}`;
    case "rad": {
      const degHide = ommlAttr(ommlChild(ommlChild(el, "radPr") ?? el, "degHide"), "val");
      const deg = inner("deg");
      return deg && degHide !== "1" && degHide !== "on" ? `\\sqrt[${deg}]{${inner("e")}}` : `\\sqrt{${inner("e")}}`;
    }
    case "d": {
      const pr = ommlChild(el, "dPr");
      const beg = ommlAttr(pr && ommlChild(pr, "begChr"), "val") ?? "(";
      const end = ommlAttr(pr && ommlChild(pr, "endChr"), "val") ?? ")";
      const parts = kids(el).filter((k) => k.localName === "e").map(ommlToMarkup);
      return `${beg}${parts.join(", ")}${end}`;
    }
    case "nary": {
      const pr = ommlChild(el, "naryPr");
      const chr = ommlAttr(pr && ommlChild(pr, "chr"), "val") ?? "∫";
      const sub = inner("sub");
      const sup = inner("sup");
      return `${chr}${sub ? `_{${sub}}` : ""}${sup ? `^{${sup}}` : ""} ${inner("e")}`;
    }
    case "func":
      return `${inner("fName")} ${inner("e")}`;
    case "rPr":
    case "fPr":
    case "radPr":
    case "dPr":
    case "naryPr":
    case "sSupPr":
    case "sSubPr":
    case "ctrlPr":
    case "oMathParaPr":
      return "";
    default:
      return kids(el).map(ommlToMarkup).join("");
  }
}

const OMML_NS =
  'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function ommlStringToMarkup(xml: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(`<root ${OMML_NS}>${xml}</root>`, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) return null;
    return ommlToMarkup(doc.documentElement);
  } catch {
    return null;
  }
}

// ---------- HTML ----------------------------------------------------------
const BLOCK = new Set(["p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "table"]);

function walk(node: Node, out: string[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(plainToMarkup((node.textContent ?? "").replace(/ /g, " ")));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  const tag = el.localName;
  if (["script", "style", "head", "title", "meta", "img", "svg", "annotation"].includes(tag)) return;
  if (el.getAttribute("aria-hidden") === "true" || el.classList.contains("katex-html")) return;

  const placeholder = el.getAttribute("data-dqec-math");
  if (placeholder !== null) {
    out.push(placeholder);
    return;
  }
  if (tag === "math") {
    out.push(mathmlToMarkup(el));
    return;
  }
  if (tag === "br") {
    out.push("\n");
    return;
  }

  const style = (el.getAttribute("style") ?? "").toLowerCase();
  const isSup = tag === "sup" || /vertical-align:\s*(super|top)/.test(style);
  const isSub = tag === "sub" || /vertical-align:\s*(sub|bottom)/.test(style);
  const inner: string[] = [];
  el.childNodes.forEach((c) => walk(c, inner));
  const text = inner.join("");

  if (isSup && text.trim()) out.push(`^{${text.trim()}}`);
  else if (isSub && text.trim()) out.push(`_{${text.trim()}}`);
  else if (tag === "td" || tag === "th") out.push(`${text} `);
  else if (BLOCK.has(tag)) out.push(`\n${text}\n`);
  else out.push(text);
}

function tidy(s: string): string {
  return s
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{2,}/g, "\n") // um parágrafo por linha
    .trim();
}

/** Converte o HTML da área de transferência em texto com marcação de fórmulas. */
export function htmlToMarkup(html: string): string {
  // Equações do Word chegam dentro de comentários condicionais.
  let h = html.replace(/<!--\[if gte msEquation 12\]>([\s\S]*?)<!\[endif\]-->/g, (_, xml: string) => {
    const tex = ommlStringToMarkup(xml);
    return tex === null ? "" : `<span data-dqec-math="${tex.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}"></span>`;
  });
  // A imagem de reserva da equação (quando o Word manda as duas) é descartada no walk.
  h = h.replace(/<!\[if !msEquation\]>[\s\S]*?<!\[endif\]>/g, "");
  const doc = new DOMParser().parseFromString(h, "text/html");
  const out: string[] = [];
  walk(doc.body, out);
  return tidy(out.join(""));
}

/** Ponto de entrada do evento de colar: prefere HTML (tem formatação) e cai no texto. */
export function clipboardToMarkup(data: DataTransfer): string | null {
  const html = data.getData("text/html");
  if (html) {
    const r = htmlToMarkup(html);
    if (r) return r;
  }
  const text = data.getData("text/plain");
  return text ? tidy(plainToMarkup(text)) : null;
}
