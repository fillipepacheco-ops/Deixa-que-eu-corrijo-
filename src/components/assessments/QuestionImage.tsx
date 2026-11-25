"use client";
/* eslint-disable @next/next/no-img-element */

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toJpeg } from "@/components/upload/resize";

export interface QuestionImageHandle {
  /** Recebe uma imagem colada no enunciado. */
  upload: (file: Blob) => void;
}

/**
 * Imagem da questão (gráfico, figura, mapa...). Vai para o Storage do
 * professor já reduzida; na prova ela é ajustada sozinha à largura da coluna.
 */
export const QuestionImage = forwardRef<QuestionImageHandle, { initialPath?: string | null; initialUrl?: string | null }>(
  function QuestionImage({ initialPath, initialUrl }, ref) {
    const [path, setPath] = useState(initialPath ?? "");
    const [preview, setPreview] = useState(initialUrl ?? "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const input = useRef<HTMLInputElement>(null);

    async function upload(file: Blob) {
      setError("");
      setBusy(true);
      try {
        const jpeg = await toJpeg(file, 1600, 0.9);
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Sessão expirada. Entre de novo.");
        const newPath = `${user.id}/questao-${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from("question-images").upload(newPath, jpeg, { contentType: "image/jpeg" });
        if (upErr) throw new Error(upErr.message);
        setPath(newPath);
        setPreview(URL.createObjectURL(jpeg));
      } catch (e) {
        setError(`Não foi possível enviar a imagem. (${e instanceof Error ? e.message : "erro"})`);
      } finally {
        setBusy(false);
        if (input.current) input.current.value = "";
      }
    }

    useImperativeHandle(ref, () => ({ upload: (f) => void upload(f) }));

    return (
      <div>
        <input type="hidden" name="image_path" value={path} />
        {preview ? (
          <div className="rounded-xl border border-line bg-white p-3">
            <img src={preview} alt="Imagem da questão" className="mx-auto max-h-60 w-auto max-w-full object-contain" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] text-muted">Na prova, ela se ajusta sozinha à largura da coluna.</span>
              <span className="flex gap-1">
                <button type="button" onClick={() => input.current?.click()} className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-brand-700 hover:bg-brand-50">
                  Trocar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPath("");
                    setPreview("");
                  }}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={14} /> Remover
                </button>
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-white px-4 py-4 text-[14px] font-semibold text-brand-700 hover:bg-brand-50"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
            {busy ? "Enviando imagem…" : "Adicionar imagem (gráfico, figura, mapa…)"}
          </button>
        )}
        {busy && preview && <p className="mt-1 text-[12px] text-muted">Enviando…</p>}
        {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
    );
  },
);
