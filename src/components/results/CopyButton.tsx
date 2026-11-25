"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Safari antigo / sem permissão: método clássico
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function CopyButton({ text, label, hint, primary = false }: { text: () => string; label: string; hint: string; primary?: boolean }) {
  const [st, setSt] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        setSt((await copyText(text())) ? "ok" : "fail");
        setTimeout(() => setSt("idle"), 3500);
      }}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.98] ${
        primary ? "border-brand-900 bg-brand-900 text-white" : "border-line bg-white text-brand-900 hover:border-brand-200"
      }`}
    >
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${primary ? "bg-white/15" : "bg-linear-to-br from-brand-700 to-brand-900 text-white"}`}>
        {st === "ok" ? <Check size={22} /> : <Copy size={22} />}
      </span>
      <span className="min-w-0">
        <span className="block font-bold">{st === "ok" ? "Copiado!" : label}</span>
        <span className={`block text-[12px] ${primary ? "text-brand-100" : "text-muted"}`}>
          {st === "ok" ? "Agora é só colar no diário" : st === "fail" ? "Não deu para copiar neste navegador" : hint}
        </span>
      </span>
    </button>
  );
}
