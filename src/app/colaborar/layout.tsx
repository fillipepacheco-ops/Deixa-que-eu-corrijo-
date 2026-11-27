import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/services/auth";

/** Área do professor convidado da Prova Multi (não depende de assinatura). */
export default async function ColaborarLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <div className="min-h-dvh bg-brand-50">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/colaborar">
            <Logo height={34} />
          </Link>
          <span className="ml-auto truncate text-[13px] text-muted">{user.email}</span>
          <form action={signOut}>
            <button className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-brand-700 hover:bg-brand-50">
              <LogOut size={15} /> Sair
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">{children}</main>
    </div>
  );
}
