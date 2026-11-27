"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlan } from "@/lib/billing/plans";

/** O professor troca o plano escolhido (só enquanto não está pago). */
export async function choosePlan(plan: string) {
  if (!isPlan(plan)) return;
  const supabase = await createClient();
  await supabase.rpc("choose_plan", { p_plan: plan });
  revalidatePath("/assinatura");
  redirect("/assinatura");
}

const ACTIONS = ["pagou", "suspender", "reativar", "plano"] as const;

/** Aba Gestão: confirmar pagamento, suspender, reativar, trocar plano. O banco confere se é o gestor. */
export async function adminSubscription(userId: string, action: string, plan?: string) {
  if (!(ACTIONS as readonly string[]).includes(action)) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_subscription", {
    p_user: userId,
    p_action: action,
    p_plan: plan && isPlan(plan) ? plan : null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/gestao");
}

export async function adminChangePlan(userId: string, formData: FormData) {
  await adminSubscription(userId, "plano", String(formData.get("plan") ?? ""));
}

/** Aba Gestão: apagar a conta (e todos os dados) de um usuário. */
export async function adminDeleteUser(userId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_user", { p_user: userId });
  if (error) throw new Error(error.message);
  revalidatePath("/gestao");
}
