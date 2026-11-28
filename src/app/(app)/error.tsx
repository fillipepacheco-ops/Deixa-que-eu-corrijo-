"use client";

import { buttonClass } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-xl font-extrabold text-brand-900">Algo não saiu como esperado</h1>
      <p className="mt-2 text-sm text-muted">Nenhum dado foi perdido. Tente novamente; se continuar, recarregue a página.</p>
      <button onClick={reset} className={`${buttonClass()} mt-6`}>Tentar novamente</button>
      {/* ajuda a achar o problema quando o professor manda o print */}
      <p className="mt-6 text-[11px] text-muted/70">
        {error.digest ? `Código: ${error.digest}` : error.message?.slice(0, 160)}
      </p>
    </div>
  );
}
