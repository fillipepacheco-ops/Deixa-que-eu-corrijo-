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
  // imagens no meio do texto ([[img:...]]) ficam protegidas e numa linha só delas
  const marks: string[] = [];
  const guarded = text.replace(/\[\[img:[^\]]*\]\]/g, (m) => `\n\u0001${marks.push(m) - 1}\u0001\n`);
  const lines = guarded
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
      !prev.startsWith("\u0001") &&
      !line.startsWith("\u0001") &&
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
  const body = out
    .join("\n")
    .replace(/\n*(\u0001\d+\u0001)\n*/g, "\n$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // a conversão de fórmulas não mexe nas marcações de imagem
  return body
    .split(/(\u0001\d+\u0001)/)
    .map((part) => (/^\u0001\d+\u0001$/.test(part) ? marks[Number(part.slice(1, -1))] : plainToMarkup(part)))
    .join("");
}
