"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

const MSG: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "Email not confirmed": "Confirme seu e-mail pelo link que enviamos antes de entrar.",
  "User already registered": "Já existe uma conta com este e-mail.",
};
const translate = (m: string) => MSG[m] ?? m;
/** Só caminhos internos (evita redirecionar para outro site). */
const safeNext = (v: FormDataEntryValue | null, dflt: string) => {
  const s = String(v ?? "");
  return /^\/(?![\/\\])[\w\-/?=&.%]*$/.test(s) ? s : dflt;
};

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: translate(error.message) };
  redirect(safeNext(formData.get("next"), "/dashboard"));
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const plan = formData.get("plan") === "direcao" ? "direcao" : "professor";
  if (!fullName || !email) return { error: "Informe nome e e-mail." };
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, plan }, emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) return { error: translate(error.message) };
  if (!data.session) {
    return { message: "Conta criada! Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, entre para fazer o pagamento." };
  }
  redirect(safeNext(formData.get("next"), "/assinatura"));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
