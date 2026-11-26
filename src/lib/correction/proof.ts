/**
 * COMPROVANTE DE CORREÇÃO — desenha sobre a foto do cartão:
 *  - verde: questão certa (bolha marcada pelo aluno);
 *  - vermelho: questão errada (bolha marcada) + contorno tracejado verde na resposta certa;
 *  - cinza: anulada; âmbar: leitura incerta ainda não resolvida;
 * e uma faixa no topo com aluno, avaliação, nota, acertos e data/hora.
 * Roda no navegador (canvas).
 */
import { sheetLayout, type SheetQuestionSpec } from "@/lib/answer-sheet/layout";
import { applyHomography, type Homography } from "@/lib/omr/homography";
import { MULTIPLE_MARKS, UNCERTAIN, formatScore, type AnswerKeyItem, type GradeResult, type GivenAnswer } from "@/lib/grading/grading";

export const GREEN = "#16a34a";
export const RED = "#dc2626";
export const AMBER = "#d97706";
export const GRAY = "#6b7280";

export interface ProofInput {
  photo: CanvasImageSource & { width: number; height: number };
  homography: Homography;
  specs: SheetQuestionSpec[];
  key: AnswerKeyItem[];
  answers: Record<number, GivenAnswer>;
  /** Bolhas que o leitor viu marcadas (para dupla marcação). */
  marked: Record<number, string[]>;
  grade: GradeResult;
  studentName: string;
  assessmentTitle: string;
  when: Date;
  /** Logo da escola (já carregada), à esquerda na faixa do comprovante. */
  logo?: (CanvasImageSource & { width: number; height: number }) | null;
}

export function buildProof(input: ProofInput): HTMLCanvasElement {
  const { photo, homography: H, specs, grade } = input;
  const W = photo.width;
  const band = Math.round(W * 0.2);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = photo.height + band;
  const ctx = canvas.getContext("2d")!;

  // ---- faixa do comprovante ----
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, band);
  ctx.fillStyle = "#0b3a1e";
  ctx.fillRect(0, band - Math.max(3, W * 0.004), W, Math.max(3, W * 0.004));
  const u = W / 100; // unidade relativa à largura
  ctx.textBaseline = "alphabetic";
  // logo da escola à esquerda; o texto começa depois dela
  let tx = 3 * u;
  if (input.logo && input.logo.width && input.logo.height) {
    const sc = Math.min((15 * u) / input.logo.height, (16 * u) / input.logo.width);
    const lw = input.logo.width * sc;
    const lh = input.logo.height * sc;
    try {
      ctx.drawImage(input.logo, 3 * u, (band - lh) / 2 - u * 0.5, lw, lh);
      tx = 3 * u + lw + 2.5 * u;
    } catch {
      /* logo não carregou: segue sem */
    }
  }
  const textW = 66 * u - tx;
  ctx.fillStyle = "#137a1a";
  ctx.font = `700 ${2.2 * u}px Helvetica, Arial, sans-serif`;
  ctx.fillText(clip(ctx, "DEIXA QUE EU CORRIJO · COMPROVANTE DE CORREÇÃO", textW), tx, 4.2 * u);
  ctx.fillStyle = "#0b3a1e";
  ctx.font = `800 ${4.2 * u}px Helvetica, Arial, sans-serif`;
  ctx.fillText(clip(ctx, input.studentName || "Aluno não identificado", textW - 1 * u), tx, 9.6 * u);
  ctx.fillStyle = "#333";
  ctx.font = `500 ${2.6 * u}px Helvetica, Arial, sans-serif`;
  ctx.fillText(clip(ctx, input.assessmentTitle, textW - 1 * u), tx, 13.4 * u);
  ctx.fillStyle = "#5f6b65";
  ctx.font = `500 ${2.2 * u}px Helvetica, Arial, sans-serif`;
  const stats = `${grade.correctCount} certas · ${grade.wrongCount} erradas · ${grade.blankCount} em branco · ${input.when.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`;
  ctx.fillText(clip(ctx, stats, textW + 3 * u), tx, 17.2 * u);
  // nota
  ctx.fillStyle = "#0b3a1e";
  roundRect(ctx, 70 * u, 2.5 * u, 27 * u, 15 * u, 2 * u);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = `600 ${1.9 * u}px Helvetica, Arial, sans-serif`;
  ctx.fillText("NOTA", 83.5 * u, 6.3 * u);
  ctx.font = `800 ${6.2 * u}px Helvetica, Arial, sans-serif`;
  ctx.fillText(formatScore(grade.score), 83.5 * u, 13.2 * u);
  ctx.font = `500 ${1.9 * u}px Helvetica, Arial, sans-serif`;
  ctx.fillText(`de ${formatScore(grade.maxScore)}`, 83.5 * u, 16.3 * u);
  ctx.textAlign = "left";

  // ---- foto + marcações ----
  ctx.drawImage(photo, 0, band);
  const layout = sheetLayout(specs);
  const toPx = (x: number, y: number) => {
    const p = applyHomography(H, { x, y });
    return { x: p.x, y: p.y + band };
  };
  const radiusPx = (x: number, y: number, r: number) => {
    const a = toPx(x, y);
    const b = toPx(x + r, y);
    const c = toPx(x, y + r);
    return Math.max(Math.hypot(b.x - a.x, b.y - a.y), Math.hypot(c.x - a.x, c.y - a.y));
  };
  const ring = (x: number, y: number, r: number, color: string, opts: { fill?: boolean; dashed?: boolean } = {}) => {
    const c = toPx(x, y);
    const rp = radiusPx(x, y, r) * 1.4;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rp, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2, rp * 0.28);
    ctx.strokeStyle = color;
    ctx.setLineDash(opts.dashed ? [rp * 0.5, rp * 0.35] : []);
    if (opts.fill) {
      ctx.fillStyle = `${color}33`;
      ctx.fill();
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  const sign = (x: number, y: number, text: string, color: string) => {
    const c = toPx(x, y);
    const size = radiusPx(x, y, 4.6);
    ctx.fillStyle = color;
    ctx.font = `900 ${size}px Helvetica, Arial, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(text, c.x, c.y);
    ctx.textBaseline = "alphabetic";
  };

  for (const q of grade.questions) {
    const bubbles = layout.bubbles.filter((b) => b.question === q.number);
    if (!bubbles.length) continue; // discursivas não estão no cartão
    const last = bubbles[bubbles.length - 1];
    const keyItem = input.key.find((k) => k.number === q.number);
    const accepted = new Set((keyItem?.accepted ?? []).map((a) => a.toUpperCase()));
    const given = typeof q.given === "string" ? q.given.toUpperCase() : null;
    const marked = input.marked[q.number] ?? (given && given !== MULTIPLE_MARKS && given !== UNCERTAIN ? [given] : []);
    const signX = last.x + 5.5;

    if (q.status === "annulled") {
      for (const b of bubbles) ring(b.x, b.y, b.r, GRAY, { dashed: true });
      sign(signX, last.y, "–", GRAY);
      continue;
    }
    if (q.status === "uncertain") {
      for (const b of bubbles) ring(b.x, b.y, b.r, AMBER, { dashed: true });
      sign(signX, last.y, "?", AMBER);
      continue;
    }
    const ok = q.status === "correct" || (q.status === "manual" && q.points >= q.maxPoints && q.maxPoints > 0);
    for (const b of bubbles) {
      const isMarked = marked.includes(b.label.toUpperCase()) || given === b.label.toUpperCase();
      if (isMarked) ring(b.x, b.y, b.r, ok ? GREEN : RED, { fill: true });
      else if (!ok && accepted.has(b.label.toUpperCase())) ring(b.x, b.y, b.r, GREEN, { dashed: true });
    }
    sign(signX, last.y, ok ? "✓" : "✗", ok ? GREEN : RED);
  }
  return canvas;
}

function clip(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
