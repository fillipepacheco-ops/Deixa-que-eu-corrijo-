"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "@/services/auth";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function AuthForm({
  plan,
  initialMode = "entrar",
  lockedEmail,
  next,
}: { plan?: "professor" | "direcao"; initialMode?: "entrar" | "criar"; lockedEmail?: string; next?: string } = {}) {
  const [mode, setMode] = useState<"entrar" | "criar">(initialMode);
  const [inState, inAction] = useActionState<AuthState, FormData>(signIn, {});
  const [upState, upAction] = useActionState<AuthState, FormData>(signUp, {});
  const state = mode === "entrar" ? inState : upState;

  return (
    <div>
      <h2 className="text-2xl font-extrabold tracking-tight text-brand-900">
        {mode === "entrar" ? "Entrar" : "Criar conta de professor"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {mode === "entrar" ? "Bem-vindo de volta." : "Leva menos de um minuto."}
      </p>

      <form action={mode === "entrar" ? inAction : upAction} className="mt-7 space-y-4">
        {mode === "criar" && plan && <input type="hidden" name="plan" value={plan} />}
        {next && <input type="hidden" name="next" value={next} />}
        {mode === "criar" && (
          <div>
            <label className="label" htmlFor="full_name">Nome completo</label>
            <input className="field" id="full_name" name="full_name" autoComplete="name" required />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input
            className="field read-only:bg-brand-50"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={lockedEmail}
            readOnly={!!lockedEmail}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Senha</label>
          <input
            className="field"
            id="password"
            name="password"
            type="password"
            minLength={mode === "criar" ? 8 : undefined}
            autoComplete={mode === "entrar" ? "current-password" : "new-password"}
            required
          />
        </div>

        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>}
        {state.message && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">{state.message}</p>}

        <SubmitButton className="w-full">{mode === "entrar" ? "Entrar" : "Criar conta"}</SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {mode === "entrar" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "entrar" ? "criar" : "entrar")}
          className="font-semibold text-brand-700 hover:underline"
        >
          {mode === "entrar" ? "Criar conta" : "Entrar"}
        </button>
      </p>
    </div>
  );
}
