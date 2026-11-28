/**
 * IMAGENS NO MEIO DO TEXTO — usadas pelas questões do Banco de Questões, que
 * têm várias figuras (no enunciado e até nas alternativas), cada uma no lugar
 * exato em que aparece na prova original.
 *
 * Marcação: [[img:/banco/enem/2025/q101-1.png|62.5]]  (caminho | largura em mm)
 * Ela fica numa linha própria do enunciado ou ocupa a alternativa inteira.
 */
export const IMG_MARK = /\[\[img:([^\]|\s]+)(?:\|(\d+(?:\.\d+)?))?\]\]/g;

export type InlineSeg = { t: "text"; s: string } | { t: "img"; src: string; wmm: number | null };

/** Separa o texto em pedaços de texto e de imagem, na ordem. */
export function splitInline(text: string | null | undefined): InlineSeg[] {
  const s = text ?? "";
  const out: InlineSeg[] = [];
  let last = 0;
  for (const m of s.matchAll(IMG_MARK)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ t: "text", s: s.slice(last, i) });
    out.push({ t: "img", src: m[1], wmm: m[2] ? Number(m[2]) : null });
    last = i + m[0].length;
  }
  if (last < s.length) out.push({ t: "text", s: s.slice(last) });
  return out;
}

export function hasInlineImages(text: string | null | undefined): boolean {
  return /\[\[img:/.test(text ?? "");
}

/** Todas as imagens citadas no enunciado e nas alternativas. */
export function inlineImageSources(q: { statement: string; options?: { text: string }[] }): string[] {
  const set = new Set<string>();
  for (const t of [q.statement, ...(q.options ?? []).map((o) => o.text)]) {
    for (const seg of splitInline(t)) if (seg.t === "img") set.add(seg.src);
  }
  return [...set];
}

/** Texto sem as marcações (para resumos e buscas). */
export function stripInline(text: string | null | undefined, replacement = "[figura]"): string {
  return (text ?? "").replace(IMG_MARK, replacement).replace(/\s{2,}/g, " ").trim();
}

/** Só aceita imagens do próprio site (banco de questões). */
export function isAllowedInlineSrc(src: string): boolean {
  return /^\/banco\/[a-z0-9/_-]+\.(png|jpe?g)$/i.test(src);
}
