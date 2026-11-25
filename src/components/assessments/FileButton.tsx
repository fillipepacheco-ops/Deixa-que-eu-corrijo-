"use client";

import { useState } from "react";
import { Check, Loader2, Share2 } from "lucide-react";

type Status = { s: "idle" } | { s: "busy" } | { s: "ready"; file: File } | { s: "error"; msg: string };

function canShareFiles(file: File) {
  return typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Gera o arquivo SEM sair do app.
 * - iPad/celular: depois de gerar, um toque abre a folha de compartilhar
 *   (Imprimir, Salvar em Arquivos, AirDrop, WhatsApp...).
 * - Computador: baixa direto.
 */
export function FileButton({
  href,
  filename,
  mime,
  title,
  subtitle,
  icon,
  disabled,
}: {
  href: string;
  filename: string;
  mime: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  disabled?: string;
}) {
  const [st, setSt] = useState<Status>({ s: "idle" });

  async function generate() {
    setSt({ s: "busy" });
    try {
      const res = await fetch(href, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Erro ${res.status}`);
      }
      const file = new File([await res.blob()], filename, { type: mime });
      if (canShareFiles(file)) setSt({ s: "ready", file }); // precisa de um novo toque para compartilhar
      else {
        download(file);
        setSt({ s: "idle" });
      }
    } catch (e) {
      setSt({ s: "error", msg: e instanceof Error ? e.message : "Não foi possível gerar o arquivo." });
    }
  }

  async function share(file: File) {
    try {
      await navigator.share({ files: [file], title: file.name });
    } catch (e) {
      // cancelado pelo usuário: tudo bem. Outro erro: tenta baixar.
      if (!(e instanceof DOMException && e.name === "AbortError")) download(file);
    }
  }

  const ready = st.s === "ready";
  const iconBox = (
    <span
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
        disabled ? "bg-brand-50 text-brand-700/40" : ready ? "bg-brand-500 text-white" : "bg-linear-to-br from-brand-700 to-brand-900 text-white"
      }`}
    >
      {st.s === "busy" ? <Loader2 size={24} className="animate-spin" /> : ready ? <Share2 size={22} /> : icon}
    </span>
  );

  const sub =
    disabled ??
    (st.s === "busy"
      ? "Gerando… aguarde"
      : st.s === "ready"
        ? "Pronto! Toque para imprimir, salvar ou enviar"
        : st.s === "error"
          ? st.msg
          : subtitle);

  return (
    <button
      type="button"
      disabled={Boolean(disabled) || st.s === "busy"}
      onClick={() => (st.s === "ready" ? share(st.file) : generate())}
      className={`flex w-full items-center gap-3 rounded-2xl border bg-white p-3.5 text-left transition ${
        disabled ? "cursor-not-allowed border-line opacity-70" : ready ? "border-brand-500 shadow-md" : "border-line hover:border-brand-200 hover:shadow-md active:scale-[0.98]"
      }`}
    >
      {iconBox}
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-bold text-brand-900">
          {title} {ready && <Check size={16} className="text-brand-500" />}
        </span>
        <span className={`block text-[12px] ${st.s === "error" ? "text-red-700" : "text-muted"}`}>{sub}</span>
      </span>
    </button>
  );
}
