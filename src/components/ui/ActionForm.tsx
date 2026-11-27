"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "./SubmitButton";

type State = { error?: string; ok?: boolean; message?: string };

/**
 * Formulário ligado a uma Server Action, com mensagem de erro e
 * confirmação. resetOnSuccess limpa os campos (ex.: adicionar vários alunos).
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  successText,
  resetOnSuccess = false,
  className = "",
  submitClassName = "",
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  children: React.ReactNode;
  submitLabel: string;
  successText?: string;
  resetOnSuccess?: boolean;
  className?: string;
  submitClassName?: string;
}) {
  const [state, formAction] = useActionState<State, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>}
      {state.ok && (state.message || successText) && <p className="mt-3 text-sm font-medium text-brand-700">{state.message || successText}</p>}
      <div className="mt-4">
        <SubmitButton className={submitClassName}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
