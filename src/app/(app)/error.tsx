"use client";

import { buttonClass } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-xl font-extrabold text-brand-900">Algo não saiu como esperado</h1>
      <p className="mt-2 text-sm text-muted">Nenhum dado foi perdido. Tente novamente; se continuar, recarregue a página.</p>
      <button onClick={reset} className={`${buttonClass()} mt-6`}>Tentar novamente</button>
    </div>
  );
}
