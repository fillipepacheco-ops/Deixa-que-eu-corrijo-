"use client";

import type { ReactNode } from "react";

/** Fundo colorido do modo game (telão e celular). */
export function GameBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#3b1477] font-sans select-none">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,#7c3aed_0%,transparent_45%),radial-gradient(circle_at_90%_80%,#0ea5e9_0%,transparent_40%),radial-gradient(circle_at_70%_15%,#db2777_0%,transparent_35%)] opacity-70" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#7cc520]/25 blur-3xl" />
      <div className="relative flex min-h-dvh flex-col">{children}</div>
    </div>
  );
}

/** Relógio redondo da questão. */
export function TimerRing({ seconds, total, size = 96 }: { seconds: number; total: number; size?: number }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const urgent = seconds <= 5;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="white" stroke="rgba(255,255,255,0.25)" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={urgent ? "#e21b3c" : "#7c3aed"}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
      </svg>
      <span
        className={`absolute font-black tabular-nums ${urgent ? "text-[#e21b3c]" : "text-violet-900"}`}
        style={{ fontSize: size * (seconds >= 60 ? 0.26 : 0.36) }}
      >
        {/* acima de 1 minuto: 7:45 */}
        {seconds >= 60 ? `${Math.floor(Math.ceil(seconds) / 60)}:${String(Math.ceil(seconds) % 60).padStart(2, "0")}` : Math.ceil(seconds)}
      </span>
    </div>
  );
}
