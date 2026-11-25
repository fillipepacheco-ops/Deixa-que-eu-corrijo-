/**
 * FÓRMULAS — marcação simples (subconjunto de LaTeX) usada nos enunciados
 * e alternativas. O professor quase nunca digita isso: o botão de fórmulas e
 * a colagem inteligente geram a marcação sozinhos.
 *
 *   x^{2}  x^2        expoente
 *   a_{1}  a_1        índice
 *   \frac{a}{b}       fração
 *   \sqrt{x}          raiz quadrada
 *   \sqrt[3]{x}       raiz de índice n
 *   \pi \le \ge ...   símbolos (viram π ≤ ≥ ...)
 */

export type MathNode =
  | { t: "text"; s: string }
  | { t: "sup"; base: MathNode[]; exp: MathNode[] }
  | { t: "sub"; base: MathNode[]; idx: MathNode[] }
  | { t: "frac"; num: MathNode[]; den: MathNode[] }
  | { t: "sqrt"; body: MathNode[]; index?: MathNode[] };

export const SYMBOLS: Record<string, string> = {
  pi: "π", le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠", pm: "±", mp: "∓",
  times: "×", div: "÷", cdot: "·", infty: "∞", approx: "≈", equiv: "≡", degree: "°", circ: "°",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", epsilon: "ε", theta: "θ", lambda: "λ",
  mu: "μ", rho: "ρ", sigma: "σ", Sigma: "Σ", phi: "φ", omega: "ω", Omega: "Ω",
  in: "∈", notin: "∉", subset: "⊂", supset: "⊃", subseteq: "⊆", cup: "∪", cap: "∩", emptyset: "∅",
  to: "→", rightarrow: "→", Rightarrow: "⇒", Leftrightarrow: "⇔", leftarrow: "←",
  angle: "∠", perp: "⊥", parallel: "∥", triangle: "△", forall: "∀", exists: "∃",
  sum: "Σ", int: "∫", partial: "∂", nabla: "∇", sim: "~", propto: "∝", therefore: "∴",
  N: "ℕ", Z: "ℤ", Q: "ℚ", R: "ℝ", C: "ℂ",
  sen: "sen", cos: "cos", tg: "tg", tan: "tg", log: "log", ln: "ln",
};

/** Lê um grupo {…} a partir de s[i] === "{"; devolve o conteúdo e o índice após "}". */
function readGroup(s: string, i: number, open = "{", close = "}"): [string, number] | null {
  if (s[i] !== open) return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "\\") {
      j++;
      continue;
    }
    if (s[j] === open) depth++;
    else if (s[j] === close) {
      depth--;
      if (depth === 0) return [s.slice(i + 1, j), j + 1];
    }
  }
  return null;
}

/** Argumento de ^ ou _: {grupo} ou um único caractere. */
function readArg(s: string, i: number): [string, number] | null {
  if (i >= s.length) return null;
  if (s[i] === "{") return readGroup(s, i);
  if (s[i] === "\\") {
    const m = /^\\([A-Za-z]+)/.exec(s.slice(i));
    if (m) return [m[0], i + m[0].length];
  }
  return [s[i], i + 1];
}

function pushText(out: MathNode[], s: string) {
  if (!s) return;
  const last = out[out.length - 1];
  if (last?.t === "text") last.s += s;
  else out.push({ t: "text", s });
}

/**
 * Tira da saída a "base" de um expoente/índice:
 * fração/raiz anterior inteira, "(…)" inteiro, número inteiro ou a última letra.
 */
function takeBase(out: MathNode[]): MathNode[] {
  const last = out[out.length - 1];
  if (!last) return [];
  if (last.t !== "text") {
    out.pop();
    return [last];
  }
  const s = last.s;
  let k = s.length;
  if (s.endsWith(")")) {
    let depth = 0;
    for (let j = s.length - 1; j >= 0; j--) {
      if (s[j] === ")") depth++;
      else if (s[j] === "(" && --depth === 0) {
        k = j;
        break;
      }
    }
    if (k === s.length) k = s.length - 1;
  } else if (/\d$/.test(s)) {
    k = s.search(/[\d.,]*\d$/);
  } else if (/\s$/.test(s) || s.length === 0) {
    return [];
  } else {
    k = s.length - 1;
    // letras gregas/compostas ficam inteiras (ex.: "cos")
    const word = /(sen|cos|tg|log|ln)$/.exec(s);
    if (word) k = s.length - word[0].length;
  }
  const base = s.slice(k);
  last.s = s.slice(0, k);
  if (!last.s) out.pop();
  return [{ t: "text", s: base }];
}

export function parseMath(input: string): MathNode[] {
  const s = input ?? "";
  const out: MathNode[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\") {
      const m = /^\\([A-Za-z]+)/.exec(s.slice(i));
      if (!m) {
        // "\{" "\^" etc.: caractere literal
        pushText(out, s[i + 1] ?? "\\");
        i += 2;
        continue;
      }
      const cmd = m[1];
      let j = i + m[0].length;
      if (cmd === "frac" || cmd === "dfrac") {
        const a = readGroup(s, j);
        const b = a ? readGroup(s, a[1]) : null;
        if (a && b) {
          out.push({ t: "frac", num: parseMath(a[0]), den: parseMath(b[0]) });
          i = b[1];
          continue;
        }
      } else if (cmd === "sqrt") {
        let index: MathNode[] | undefined;
        const opt = readGroup(s, j, "[", "]");
        if (opt) {
          index = parseMath(opt[0]);
          j = opt[1];
        }
        const body = readGroup(s, j);
        if (body) {
          out.push({ t: "sqrt", body: parseMath(body[0]), ...(index ? { index } : {}) });
          i = body[1];
          continue;
        }
      } else if (SYMBOLS[cmd] !== undefined) {
        pushText(out, SYMBOLS[cmd]);
        i = j;
        continue;
      }
      pushText(out, m[0]);
      i = j;
      continue;
    }
    if (ch === "^" || ch === "_") {
      const arg = readArg(s, i + 1);
      if (arg) {
        const base = takeBase(out);
        const inner = parseMath(arg[0]);
        out.push(ch === "^" ? { t: "sup", base, exp: inner } : { t: "sub", base, idx: inner });
        i = arg[1];
        continue;
      }
    }
    if (ch === "{") {
      const g = readGroup(s, i);
      if (g) {
        // grupo solto: só agrupa (ex.: {(a+b)}^2)
        const inner = parseMath(g[0]);
        for (const n of inner) n.t === "text" ? pushText(out, n.s) : out.push(n);
        i = g[1];
        continue;
      }
    }
    pushText(out, ch);
    i++;
  }
  return out;
}

/** O texto tem alguma fórmula (estrutura além de texto simples)? */
export function hasMath(input: string): boolean {
  return /\\[A-Za-z]+|\^|_\{|_[A-Za-z0-9]/.test(input ?? "");
}

/** Versão em texto linear (para listas, buscas e títulos). */
export function mathToPlain(nodes: MathNode[]): string {
  return nodes
    .map((n) => {
      switch (n.t) {
        case "text":
          return n.s;
        case "sup": {
          const e = mathToPlain(n.exp);
          return mathToPlain(n.base) + (/^[0-9]$/.test(e) ? "⁰¹²³⁴⁵⁶⁷⁸⁹"[+e] : `^${e.length > 1 ? `(${e})` : e}`);
        }
        case "sub":
          return `${mathToPlain(n.base)}_${mathToPlain(n.idx)}`;
        case "frac": {
          const a = mathToPlain(n.num);
          const b = mathToPlain(n.den);
          return `${a.length > 1 ? `(${a})` : a}/${b.length > 1 ? `(${b})` : b}`;
        }
        case "sqrt":
          return `${n.index ? mathToPlain(n.index) : ""}√(${mathToPlain(n.body)})`;
      }
    })
    .join("");
}
