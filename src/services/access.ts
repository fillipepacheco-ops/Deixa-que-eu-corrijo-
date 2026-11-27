import type { SupabaseClient } from "@supabase/supabase-js";
import { accessState, todayISO, type AccessState, type Subscription } from "@/lib/billing/plans";

export interface Access {
  isAdmin: boolean;
  sub: Subscription | null;
  state: AccessState;
  /** Banco ainda sem a migração 0010: não bloqueia ninguém. */
  missing: boolean;
}

/** Situação da assinatura de quem está logado. */
export async function loadAccess(supabase: SupabaseClient, userId: string): Promise<Access> {
  const [subRes, adminRes] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
    supabase.rpc("is_app_admin"),
  ]);
  if (subRes.error && /subscriptions|schema cache|does not exist/i.test(subRes.error.message)) {
    return { isAdmin: false, sub: null, state: "em_dia", missing: true };
  }
  const sub = (subRes.data as Subscription | null) ?? null;
  return { isAdmin: adminRes.data === true, sub, state: accessState(sub, todayISO()), missing: false };
}
