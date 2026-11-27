import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";
import { currentSchool } from "@/services/school-context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { schools, current }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    currentSchool(supabase),
  ]);

  return (
    <AppShell teacherName={profile?.full_name || user.email || ""} schools={schools} currentSchool={current?.id ?? ""}>
      {children}
    </AppShell>
  );
}
