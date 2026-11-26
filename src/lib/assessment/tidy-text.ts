/**
 * Arruma o texto colado de outros lugares antes de montar a prova:
 *  - letra + acento separados viram um caractere só (NFC);
 *  - tira caracteres invisíveis, tabulações e espaços repetidos/no começo da linha;
 *  - junta as quebras de linha "falsas" de texto copiado de PDF/site
 *    (linha comprida que não termina em ponto), para o parágrafo ficar
 *    justificado por inteiro. Versos e listas (linhas curtas) ficam como estão.
 */
import { plainToMarkup } from "@/lib/math/paste";

const SOFT_MIN = 45; // linhas mais curtas que isso são intencionais (versos, itens)

export function tidyText(text: string | null | undefined): string {
  if (!text) return "";
  const lines = text
    .normalize("NFC")
    .replace(/[​-‍⁠﻿­]/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[\t  -  　]/g, " ").replace(/ {2,}/g, " ").trim());

  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    const soft =
      prev !== undefined &&
      prev !== "" &&
      line !== "" &&
      prev.length >= SOFT_MIN &&
      !/[.!?:;]["'”’)]?$/.test(prev) &&
      !/^(?:[-–—•*]\s|\(?[A-Ea-e]\)|\d{1,2}[.)]\s|[IVX]+\s*[-–.)])/.test(line);
    if (soft) out[out.length - 1] = prev.endsWith("-") && /^[a-zà-ú]/.test(line) ? prev.slice(0, -1) + line : `${prev} ${line}`;
    else out.push(line);
  }
  // sem linhas vazias no começo/fim nem várias seguidas
  // x² → x^{2}, ½ → \frac{1}{2} (expoentes digitados direto saem certinhos na prova)
  return plainToMarkup(out.join("\n").replace(/\n{3,}/g, "\n\n").trim());
}
