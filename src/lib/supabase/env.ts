/**
 * Variáveis do Supabase. Aceita o nome novo (PUBLISHABLE_KEY, que o painel
 * do Supabase mostra hoje) e o antigo (ANON_KEY).
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
