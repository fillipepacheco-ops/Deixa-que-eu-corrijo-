"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Reduz a foto para no máximo 800 px e salva como JPEG (leve para PDF e Word). */
async function toSmallJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Imagem inválida"));
      i.src = url;
    });
    const scale = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; // PNG transparente vira fundo branco
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao converter"))), "image/jpeg", 0.88),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Logo da escola: o arquivo vai direto para o Storage do professor
 * (pasta com o id dele) e o caminho segue no formulário.
 */
export function LogoUpload({ initialPath, initialUrl }: { initialPath?: string | null; initialUrl?: string | null }) {
  const [path, setPath] = useState(initialPath ?? "");
  const [preview, setPreview] = useState(initialUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const jpeg = await toSmallJpeg(file);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada. Entre de novo.");
      const newPath = `${user.id}/logo-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("school-logos").upload(newPath, jpeg, { contentType: "image/jpeg" });
      if (upErr) throw new Error(upErr.message);
      setPath(newPath);
      setPreview(URL.createObjectURL(jpeg));
    } catch (e) {
      setError(`Não foi possível enviar a logo. (${e instanceof Error ? e.message : "erro"})`);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <input type="hidden" name="school_logo_path" value={path} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="grid h-24 w-40 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-brand-200 bg-white text-brand-700 hover:bg-brand-50"
          aria-label="Escolher logo da escola"
        >
          {busy ? (
            <Loader2 className="animate-spin" />
          ) : preview ? (
            <img src={preview} alt="Logo da escola" className="max-h-20 max-w-36 object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-[12px] font-semibold">
              <ImagePlus size={22} /> Enviar logo
            </span>
          )}
        </button>
        <div className="text-[12px] text-muted">
          <p>JPEG ou PNG. Aparece no topo da capa da prova.</p>
          {path && (
            <button
              type="button"
              onClick={() => {
                setPath("");
                setPreview("");
              }}
              className="mt-1.5 inline-flex items-center gap-1 font-semibold text-red-700 hover:underline"
            >
              <X size={13} /> Remover logo
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <input ref={input} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
    </div>
  );
}
