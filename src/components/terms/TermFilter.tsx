import Link from "next/link";
import type { TermGroup } from "@/lib/assessment/term";

/**
 * Filtro por bimestre (chips no topo da lista). "Todos" mostra as avaliações
 * separadas por bimestre; um bimestre mostra só as dele.
 */
export function TermFilter<T>({ groups, current, basePath }: { groups: TermGroup<T>[]; current: string; basePath: string }) {
  if (groups.length < 2 && current === "todos") return null;
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-2 text-[13px] font-bold transition ${
      active ? "bg-brand-900 text-white" : "border border-line bg-white text-brand-900 hover:border-brand-200"
    }`;
  return (
    <nav className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Filtrar por bimestre">
      <Link href={basePath} className={chip(current === "todos")} scroll={false}>
        Todos
      </Link>
      {groups.map((g) => (
        <Link key={g.key} href={`${basePath}?bim=${g.key}`} className={chip(current === g.key)} scroll={false}>
          {g.label} <span className="opacity-70">({g.items.length})</span>
        </Link>
      ))}
    </nav>
  );
}

export function TermHeading({ label, count }: { label: string; count: number }) {
  return (
    <h2 className="mb-2.5 mt-6 flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wider text-brand-700 first:mt-0">
      {label}
      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-800">{count}</span>
    </h2>
  );
}

/** Grupos a mostrar conforme o filtro escolhido (?bim=ano-bimestre). */
export function visibleGroups<T>(groups: TermGroup<T>[], bim: string | undefined) {
  const current = bim && groups.some((g) => g.key === bim) ? bim : "todos";
  return { current, shown: current === "todos" ? groups : groups.filter((g) => g.key === current) };
}
