/** Utilitários de câmera/foto → leitura do cartão (navegador). */
import { readAnswerSheet, toGray, type ReadResult } from "@/lib/omr/reader";
import type { SheetQuestionSpec } from "@/lib/answer-sheet/layout";

type Source = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap;

function sourceSize(src: Source) {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

/** Copia o quadro/foto para um canvas com o maior lado ≤ maxSide. */
export function toCanvas(src: Source, maxSide: number, target?: HTMLCanvasElement): HTMLCanvasElement {
  const { w, h } = sourceSize(src);
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const c = target ?? document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

export function readCanvas(canvas: HTMLCanvasElement, specs: SheetQuestionSpec[], versions = 1, layoutVersion?: number): ReadResult {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return readAnswerSheet(toGray(data.data, canvas.width, canvas.height), specs, { versions, layoutVersion });
}

/** Arquivo de imagem (galeria) → <img> carregada. */
export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível abrir a foto."));
    img.src = url;
  });
}
