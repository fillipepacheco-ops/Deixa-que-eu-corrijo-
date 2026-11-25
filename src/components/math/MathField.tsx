"use client";

import { useState } from "react";
import { hasMath } from "@/lib/math/parse";
import { clipboardToMarkup } from "@/lib/math/paste";
import { MathPreview } from "./MathPreview";
import { insertAtCursor, type TextField } from "./math-field";

const SYMBOL_CHARS = /[π≤≥≠≈±×÷·°∞ΔθαβγλμσΣω∈∉⊂⊃⊆∪∩∅→⇒⇔ℝℕℤℚℂ∠⊥∥√∛]/;

/**
 * Campo de texto que entende fórmulas:
 *  - ao colar (Word, sites, PDF), converte expoentes, frações e raízes;
 *  - mostra logo abaixo como a fórmula vai sair na prova.
 */
export function MathField({
  name,
  defaultValue,
  multiline = false,
  placeholder,
  className = "",
  onFocusField,
  onImagePaste,
}: {
  name: string;
  defaultValue: string;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  onFocusField?: (el: TextField) => void;
  /** Imagem colada (print, figura copiada): vira a imagem da questão. */
  onImagePaste?: (file: File) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const showPreview = hasMath(value) || SYMBOL_CHARS.test(value);

  const common = {
    name,
    defaultValue,
    placeholder,
    onFocus: (e: React.FocusEvent<TextField>) => onFocusField?.(e.currentTarget),
    onInput: (e: React.FormEvent<TextField>) => setValue(e.currentTarget.value),
    onPaste: (e: React.ClipboardEvent<TextField>) => {
      const image = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
      if (image && onImagePaste) {
        onImagePaste(image);
        if (!e.clipboardData.getData("text/plain").trim()) {
          e.preventDefault();
          return;
        }
      }
      const converted = clipboardToMarkup(e.clipboardData);
      if (converted === null) return; // deixa o navegador colar normalmente
      e.preventDefault();
      insertAtCursor(e.currentTarget, multiline ? converted : converted.replace(/\n+/g, " "));
    },
  };

  return (
    <div className="min-w-0 flex-1">
      {multiline ? (
        <textarea {...common} className={`field min-h-32 leading-relaxed ${className}`} />
      ) : (
        <input {...common} className={`field ${className}`} />
      )}
      {showPreview && (
        <div className="mt-1.5 rounded-lg border border-dashed border-brand-200 bg-brand-50/60 px-3 py-2 text-[15px] text-ink">
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-brand-700">Como sai na prova</span>
          <MathPreview text={value} />
        </div>
      )}
    </div>
  );
}
