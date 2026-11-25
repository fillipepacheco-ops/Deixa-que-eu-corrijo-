"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { loadPdfJs, renderPdfPages } from "./render-pdf";

/** Mostra o PDF gerado dentro do app, página por página. */
export function PdfViewer({ src }: { src: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string>("Montando a prova…");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError("");
        setStatus("Montando a prova…");
        const [pdfjs, res] = await Promise.all([
          loadPdfJs(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString()),
          fetch(src, { cache: "no-store" }),
        ]);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Erro ${res.status}`);
        }
        const data = await res.arrayBuffer();
        if (cancelled || !box.current) return;
        const width = Math.min(860, box.current.clientWidth - 8);
        await renderPdfPages(pdfjs, data, box.current, {
          width,
          onPage: (n, total) => !cancelled && setStatus(n < total ? `Página ${n} de ${total}…` : ""),
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Não foi possível mostrar a prova.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div>
      {status && !error && (
        <p className="mb-4 flex items-center justify-center gap-2 text-sm font-semibold text-brand-700">
          <Loader2 size={16} className="animate-spin" /> {status}
        </p>
      )}
      {error && <p className="mx-auto max-w-lg rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-800">{error}</p>}
      <div ref={box} />
    </div>
  );
}
