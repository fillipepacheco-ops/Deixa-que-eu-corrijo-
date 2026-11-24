/** Símbolo: folha com check — correção simplificada. Funciona de 16px a cartaz. */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#0B3D2E" />
      <path d="M19 12h18l9 9v31a2 2 0 0 1-2 2H19a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2z" fill="#FFFFFF" />
      <path d="M37 12v7a2 2 0 0 0 2 2h7z" fill="#D7EFE0" />
      <path d="M23.5 35.5l6 6 12-13.5" fill="none" stroke="#1FB36B" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ light = false, size = 36 }: { light?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className={`leading-[1.05] ${light ? "text-white" : "text-brand-900"}`}>
        <span className="block text-[15px] font-medium tracking-tight">Deixa que eu</span>
        <span className="block text-[17px] font-extrabold tracking-tight">
          Corrijo<span className="text-brand-500">.</span>
        </span>
      </span>
    </span>
  );
}
