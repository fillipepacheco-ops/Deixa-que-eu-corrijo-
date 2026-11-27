import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Minhas questões" };

export default async function ColaborarPage() {
  const supabase = await createClient();
  await supabase.rpc("claim_invites");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: slots } = await supabase
    .from("multi_slots")
    .select("id, discipline, question_count, submitted_at, multi_exams(title, status)")
    .eq("teacher_id", user!.id)
    .order("created_at", { ascending: false });
  const list = slots ?? [];
  if (list.length === 1) redirect(`/colaborar/${list[0].id}`);

  return (
    <>
      <h1 className="text-[26px] font-extrabold tracking-tight text-brand-900">Suas provas</h1>
      <p className="mt-1 text-[15px] text-muted">Provas para as quais a coordenação convidou você.</p>
      <div className="mt-6 space-y-3">
        {list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-brand-200 bg-white px-5 py-8 text-center text-[14px] text-muted">
            Nenhum convite para o e-mail <b>{user!.email}</b>. Confira com a coordenação se o e-mail cadastrado é este mesmo e se você já confirmou o seu e-mail.
          </p>
        ) : (
          list.map((s) => {
            const e = s.multi_exams as unknown as { title: string; status: string } | null;
            return (
              <Link key={s.id} href={`/colaborar/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-4 hover:border-brand-200">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-extrabold text-brand-900">{e?.title}</p>
                  <p className="text-[13px] text-muted">
                    {s.discipline} · {s.question_count} {s.question_count === 1 ? "questão" : "questões"} · {s.submitted_at ? "enviada ✓" : e?.status === "fechada" ? "fechada" : "pendente"}
                  </p>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
