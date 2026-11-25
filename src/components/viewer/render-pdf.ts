/**
 * Desenha as páginas de um PDF em <canvas> dentro do app (pdf.js),
 * para o professor ver a prova sem sair da tela.
 */
type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let loading: Promise<PdfJs> | null = null;

export function loadPdfJs(workerSrc: string): Promise<PdfJs> {
  loading ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((m) => {
    m.GlobalWorkerOptions.workerSrc = workerSrc;
    return m;
  });
  return loading;
}

export async function renderPdfPages(
  pdfjs: PdfJs,
  data: ArrayBuffer,
  container: HTMLElement,
  opts: { width: number; onPage?: (n: number, total: number) => void },
): Promise<number> {
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;
  container.innerHTML = "";
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = opts.width / base.width;
    const vp = page.getViewport({ scale: scale * ratio });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.style.width = `${Math.floor(vp.width / ratio)}px`;
    canvas.style.height = `${Math.floor(vp.height / ratio)}px`;
    canvas.className = "mx-auto block rounded-sm bg-white shadow-lg ring-1 ring-black/5";
    const wrap = document.createElement("div");
    wrap.className = "mb-5";
    const label = document.createElement("p");
    label.className = "mb-1.5 text-center text-[12px] font-semibold text-muted";
    label.textContent = `Página ${i} de ${doc.numPages}`;
    wrap.append(canvas, label);
    container.appendChild(wrap);
    await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
    opts.onPage?.(i, doc.numPages);
  }
  const total = doc.numPages;
  await task.destroy();
  return total;
}
