"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";

/** Link do convite: copiar ou mandar pelo WhatsApp, já com o login do professor. */
export function InviteShare({ url, teacher, discipline, email, title }: { url: string; teacher: string; discipline: string; email: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const text =
    `Olá, ${teacher}! Você foi convidado(a) para enviar as questões de ${discipline} da prova "${title}" no Deixa que eu Corrijo.\n\n` +
    `Abra o link e entre com o e-mail ${email} (se ainda não tiver conta, crie uma com esse e-mail — é gratuito para você):\n${url}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] font-bold text-brand-900 hover:bg-brand-50">
        {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copiado!" : "Copiar convite"}
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-[13px] font-bold text-white hover:brightness-95"
      >
        <MessageCircle size={15} /> WhatsApp
      </a>
    </div>
  );
}
