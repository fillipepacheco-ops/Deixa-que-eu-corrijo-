"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { School } from "lucide-react";
import { chooseSchool } from "@/services/schools";

/** Escola em que o professor está trabalhando agora: filtra turmas, avaliações, correção e resultados. */
export function SchoolSwitcher({ schools, current, dark = false }: { schools: { id: string; name: string }[]; current: string; dark?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (schools.length === 0) return null;
  return (
    <label className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${dark ? "bg-white/10 text-white" : "border border-line bg-white text-brand-900"} ${pending ? "opacity-60" : ""}`}>
      <School size={16} className={dark ? "text-lime" : "text-brand-700"} />
      <select
        aria-label="Escola"
        value={current}
        onChange={(e) =>
          start(async () => {
            await chooseSchool(e.target.value);
            router.refresh();
          })
        }
        className={`min-w-0 flex-1 cursor-pointer truncate bg-transparent text-[13px] font-bold outline-none ${dark ? "[&>option]:text-ink" : ""}`}
      >
        <option value="">Todas as escolas</option>
        {schools.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
