/**
 * IMPORTAR PROVA — transforma o texto de um PDF ou Word em questões.
 *
 * Entende os jeitos mais comuns de escrever uma prova:
 *   "1)", "1.", "01 -", "QUESTÃO 01", "Questão 1:"   → início de questão
 *   "a)", "(A)", "A)", "a." , "A -" (uma por linha ou várias na mesma linha) → alternativas
 *   "(  ) Certo  (  ) Errado"                       → certo ou errado
 *   "GABARITO: 1-A 2-C 3-E" ou "Resposta: B"         → resposta correta
 * Sem alternativas = discursiva. Cabeçalho e instruções antes da 1ª questão são ignorados.
 * Puro (sem navegador) e testado.
 */
import { plainToMarkup } from "@/lib/math/paste";
import type { QuestionOption, QuestionType } from "@/lib/models/types";

export interface TextBlock {
  text: string;
  /** Começa um parágrafo novo (Word: sempre; PDF: quando há espaço maior antes). */
  newParagraph?: boolean;
  /** Imagens que aparecem neste ponto do documento. */
  images?: string[];
}

export interface ImportedQuestion {
  number: number;
  type: QuestionType;
  statement: string;
  options: QuestionOption[];
  correct_answers: string[];
  images: string[];
}

export interface ImportResult {
  questions: ImportedQuestion[];
  /** Quantas questões vieram com a resposta (gabarito) do próprio arquivo. */
  withAnswer: number;
  warnings: string[];
}

const LETTERS = ["A", "B", "C", "D", "E"];

// "QUESTÃO 01", "Questão 3 -", "Q.4"
const EXPLICIT = /^(?:quest[aã]o|q\.)\s*(\d{1,3})\b\s*(?:[ºª°.)\-–—:])?\s*(.*)$/i;
// "1)", "1.", "01 -", "3:" , "2º)"
const NUMBERED = /^(\d{1,3})\s*(?:[ºª°]\s*)?(?:\)\s*|[.\-–—:](?=\s|$)\s*)(.*)$/;
// marcador de alternativa: "(A)", "A)", "a)", "A.", "a -"
const OPTION_MARK = /(^|\s)(?:\(\s*([A-Ea-e])\s*\)|([A-Ea-e])\s*\)|([A-Ea-e])\s*[.\-–—](?=\s))\s*/g;
const TRUE_FALSE = /\(\s*\)\s*certo\b[\s\S]*\(\s*\)\s*errado\b|\bcerto\s*\(\s*\)[\s\S]*\berrado\s*\(\s*\)/i;
const KEY_HEADING = /^(?:gabarito(?:\s+oficial)?|respostas|chave de respostas)\s*[:\-–]?\s*/i;
const INLINE_ANSWER = /^(?:resposta(?:\s+correta)?|gabarito|alternativa correta)\s*[:\-–]\s*\(?\s*([A-Ea-e]|certo|errado|C|E|V|F)\s*\)?\s*\.?$/i;
const KEY_PAIR = /(\d{1,3})\s*[).\-–—:=]?\s*\(?\s*(certo|errado|[A-Ea-e])\s*\)?(?![A-Za-zÀ-ú])/gi;
const SUPPORT_TEXT = /^(?:texto\b|leia\b|observe\b|considere\b|analise\b|com base\b|utilize\b|o texto\b|a tirinha\b|a charge\b)/i;
const ANSWER_LINES = /^[_.\s-]{8,}$/;
const PAGE_NUMBER = /^(?:p[aá]g(?:ina)?\.?\s*\d{1,3}(?:\s*(?:de|\/)\s*\d{1,3})?|\d{1,3}\s*(?:de|\/)\s*\d{1,3})$/i;

/** Linha com cara de início de questão ou de alternativa (nunca é cabeçalho/rodapé repetido). */
export function looksStructural(text: string) {
  const t = clean(text);
  return EXPLICIT.test(t) || NUMBERED.test(t) || optionsInLine(t, 0) !== null || /^\(?\s*[A-Ea-e]\s*[).]/.test(t);
}

function clean(s: string) {
  return s.replace(/[ \t]/g, " ").replace(/[ ]{2,}/g, " ").trim();
}

interface Mark {
  index: number; // início do marcador
  end: number; // início do texto da alternativa
  letter: string;
}

/** Alternativas na linha, desde que comecem no início e sigam a ordem (A, B, C...). */
function optionsInLine(t: string, nextLetter: number): { letter: string; text: string }[] | null {
  const marks: Mark[] = [];
  for (const m of t.matchAll(OPTION_MARK)) {
    const letter = (m[2] ?? m[3] ?? m[4]).toUpperCase();
    marks.push({ index: m.index! + m[1].length, end: m.index! + m[0].length, letter });
  }
  if (!marks.length || marks[0].index !== 0 || LETTERS.indexOf(marks[0].letter) !== nextLetter) return null;
  const seq: Mark[] = [marks[0]];
  for (const m of marks.slice(1)) {
    if (LETTERS.indexOf(m.letter) === LETTERS.indexOf(seq[seq.length - 1].letter) + 1) seq.push(m);
  }
  return seq.map((m, i) => ({ letter: m.letter, text: clean(t.slice(m.end, i + 1 < seq.length ? seq[i + 1].index : undefined)) }));
}

function normalizeAnswer(a: string): string {
  const v = a.toLowerCase();
  if (v === "certo" || v === "v") return "C";
  if (v === "errado" || v === "f") return "E";
  return a.toUpperCase();
}

interface Draft {
  number: number;
  statement: string[];
  options: { letter: string; text: string[] }[];
  trueFalse: boolean;
  answer: string | null;
  images: string[];
}

export function parseExam(blocks: TextBlock[]): ImportResult {
  const drafts: Draft[] = [];
  const keyAnswers = new Map<number, string>();
  let cur: Draft | null = null;
  let pending: string[] = []; // texto entre questões (ex.: "Leia o texto...") → vai para a próxima
  let pendingImages: string[] = [];
  let inKey = false;

  const startQuestion = (number: number, rest: string) => {
    cur = { number, statement: [...pending], options: [], trueFalse: false, answer: null, images: [...pendingImages] };
    pending = [];
    pendingImages = [];
    drafts.push(cur);
    if (rest) addText(rest, cur.statement.length > 0);
  };

  const addText = (t: string, newParagraph: boolean) => {
    const q = cur!;
    if (TRUE_FALSE.test(t)) {
      q.trueFalse = true;
      return;
    }
    const opts = optionsInLine(t, q.options.length);
    if (opts) {
      if (pending.length) {
        // era continuação da alternativa anterior
        q.options.at(-1)?.text.push(...pending);
        pending = [];
      }
      for (const o of opts) q.options.push({ letter: o.letter, text: o.text ? [o.text] : [] });
      return;
    }
    if (q.options.length === 0) {
      q.statement.push(newParagraph ? "\n" + t : t);
      return;
    }
    // depois das alternativas: parágrafo novo ou texto de apoio provavelmente é da próxima questão
    if (newParagraph || pending.length || SUPPORT_TEXT.test(t)) pending.push(pending.length && newParagraph ? "\n" + t : t);
    else q.options.at(-1)!.text.push(t);
  };

  // Se a prova usa "QUESTÃO 1", só isso conta como início (listas numeradas nas instruções não confundem).
  const explicitMode = blocks.filter((b) => EXPLICIT.test(clean(b.text))).length >= 2;

  // Primeira alternativa "A" do documento: antes dela, uma nova numeração a partir do 1 pode ser a prova de verdade.
  const firstOption = blocks.findIndex((b) => optionsInLine(clean(b.text), 0) !== null);

  for (const [i, b] of blocks.entries()) {
    const t = clean(b.text);
    const images = b.images ?? [];

    if (!inKey && drafts.length && KEY_HEADING.test(t) && !INLINE_ANSWER.test(t)) {
      inKey = true;
      cur = null;
      pending = [];
    }
    if (inKey) {
      for (const m of t.replace(KEY_HEADING, "").matchAll(KEY_PAIR)) keyAnswers.set(Number(m[1]), normalizeAnswer(m[2]));
      continue;
    }

    const explicit = EXPLICIT.exec(t);
    const numbered = explicit || explicitMode ? null : NUMBERED.exec(t);
    const expected = drafts.length ? drafts[drafts.length - 1].number + 1 : null;
    const n = Number((explicit ?? numbered)?.[1]);
    // Lista numerada das instruções (sem alternativas) seguida da prova de verdade, que recomeça no 1.
    const restart = numbered && n === 1 && i < firstOption && drafts.length > 0 && drafts.every((d) => d.options.length === 0 && !d.trueFalse);
    if (restart) {
      drafts.length = 0;
      pending = [];
      pendingImages = [];
    }
    if (explicit || (numbered && (restart || (expected === null ? n <= 3 : n === expected)))) {
      const m = (explicit ?? numbered)!;
      startQuestion(Number(m[1]), clean(m[2]));
      (cur as Draft | null)?.images.push(...images);
      continue;
    }
    if (!cur) continue; // cabeçalho, instruções

    const q: Draft = cur;
    const ans = INLINE_ANSWER.exec(t);
    if (ans) {
      q.answer = normalizeAnswer(ans[1]);
      continue;
    }
    if (images.length) {
      if (pending.length || (q.options.length && b.newParagraph && !t)) pendingImages.push(...images);
      else q.images.push(...images);
    }
    if (!t || ANSWER_LINES.test(t) || PAGE_NUMBER.test(t)) continue;
    addText(t, Boolean(b.newParagraph));
  }

  const warnings: string[] = [];
  let withAnswer = 0;
  const questions: ImportedQuestion[] = drafts.map((d) => {
    const text = (parts: string[]) =>
      plainToMarkup(
        parts
          .join(" ")
          .replace(/ ?\n ?/g, "\n")
          .replace(/[ ]{2,}/g, " ")
          .trim(),
      );
    // "(2 pontos)", "(Valor: 1,5)" no começo do enunciado
    const statement = text(d.statement).replace(/^\(\s*(?:valor\s*:?\s*)?[\d,.]+\s*(?:pontos?|pts?\.?)?\s*\)\s*/i, "");
    let type: QuestionType = "essay";
    let options: QuestionOption[] = [];
    if (d.options.length >= 2) {
      type = "multiple_choice";
      options = d.options.map((o, i) => ({ label: LETTERS[i], text: text(o.text) }));
    } else if (d.trueFalse) type = "true_false";
    else if (d.options.length === 1) warnings.push(`Questão ${d.number}: só uma alternativa foi encontrada — ficou como discursiva.`);

    const raw = keyAnswers.get(d.number) ?? d.answer;
    let correct: string[] = [];
    if (raw) {
      if (type === "multiple_choice" && options.some((o) => o.label === raw)) correct = [raw];
      else if (type === "true_false" && (raw === "C" || raw === "E")) correct = [raw];
    }
    if (correct.length) withAnswer++;
    if (!statement && type !== "essay") warnings.push(`Questão ${d.number}: enunciado não encontrado.`);
    return { number: d.number, type, statement, options, correct_answers: correct, images: d.images };
  });

  for (let i = 1; i < questions.length; i++) {
    if (questions[i].number !== questions[i - 1].number + 1) {
      warnings.push(`A numeração pula da questão ${questions[i - 1].number} para a ${questions[i].number}. Confira se nenhuma ficou de fora.`);
    }
  }
  if (!questions.length) warnings.push("Não encontrei questões numeradas (ex.: “1)”, “01 -” ou “QUESTÃO 1”).");
  return { questions, withAnswer, warnings };
}
