import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS, type PlanId } from "@/lib/billing/plans";

export function PlanCard({ id, highlight = false, cta }: { id: PlanId; highlight?: boolean; cta?: React.ReactNode }) {
  const p = PLANS[id];
  return (
    <div
      className={`relative flex flex-col rounded-3xl p-6 shadow-xl sm:p-7 ${
        highlight ? "bg-white ring-4 ring-lime" : "bg-white/95 ring-1 ring-black/5"
      }`}
    >
      {highlight && (
        <span className="absolute -top-3 left-6 rounded-full bg-lime px-3 py-1 text-[12px] font-extrabold uppercase tracking-wide text-brand-900">
          Mais escolhido
        </span>
      )}
      <p className="text-[15px] font-bold text-brand-700">{p.name}</p>
      <p className="mt-2 flex items-end gap-1 text-brand-900">
        <span className="text-[40px] font-extrabold leading-none tracking-tight">{p.price}</span>
        <span className="pb-1 text-[14px] font-semibold text-muted">/mês</span>
      </p>
      <p className="mt-2 text-[14px] text-muted">{p.tagline}</p>
      <ul className="mt-5 flex-1 space-y-2.5">
        {p.features.map((f) => (
          <li key={f} className="flex gap-2.5 text-[14px] text-ink">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
              <Check size={13} strokeWidth={3} />
            </span>
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        {cta ?? (
          <Link
            href={`/assinar?plano=${id}`}
            className={`block rounded-xl px-4 py-3 text-center text-[15px] font-extrabold transition ${
              highlight ? "bg-brand-900 text-white hover:bg-brand-800" : "bg-brand-50 text-brand-900 hover:bg-brand-100"
            }`}
          >
            Assinar o plano {p.name.split(" ")[0]}
          </Link>
        )}
      </div>
    </div>
  );
}

export function BrandBackground({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-brand-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,#1f9d55_0%,transparent_45%),radial-gradient(circle_at_95%_90%,#7cc520_0%,transparent_40%)] opacity-50" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:repeating-linear-gradient(0deg,#fff_0,#fff_1px,transparent_1px,transparent_32px)]" />
      <div className="relative">{children}</div>
    </main>
  );
}
