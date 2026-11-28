"use client";
/* eslint-disable @next/next/no-img-element */

import type { ReactNode } from "react";

/** Fundo do modo game com a identidade do app (verde-escuro, verde e verde-limão). */
export function GameBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#0b3b29] font-sans select-none">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,#1f9d55_0%,transparent_42%),radial-gradient(circle_at_92%_85%,#7cc520_0%,transparent_38%),radial-gradient(circle_at_80%_10%,#0f5132_0%,transparent_45%)] opacity-60" />
      {/* folhas de caderno ao fundo */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(0deg,#fff_0,#fff_1px,transparent_1px,transparent_34px)]" />
      <div className="relative flex min-h-dvh flex-col">{children}</div>
    </div>
  );
}

/** Logo do app em versão clara para o fundo verde. */
export function GameLogo({ height = 34 }: { height?: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="grid place-items-center rounded-xl bg-white p-1 shadow" style={{ height, width: height }}>
        <img src="/brand/simbolo.png" alt="" className="h-full w-full object-contain" />
      </span>
      <span className="leading-none text-white">
        <span className="block text-[11px] font-bold opacity-80">Deixa que eu</span>
        <span className="block text-[17px] font-black text-[#7cc520]">Corrijo</span>
      </span>
    </span>
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
          stroke={urgent ? "#d64545" : "#1f9d55"}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
      </svg>
      <span
        className={`absolute font-black tabular-nums ${urgent ? "text-[#d64545]" : "text-[#0b3b29]"}`}
        style={{ fontSize: size * (seconds >= 60 ? 0.26 : 0.36) }}
      >
        {seconds >= 60 ? `${Math.floor(Math.ceil(seconds) / 60)}:${String(Math.ceil(seconds) % 60).padStart(2, "0")}` : Math.ceil(seconds)}
      </span>
    </div>
  );
}

/** Letra da alternativa no selo verde do app. */
export function OptionBadge({ label, size = 44 }: { label: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl bg-[#0b3b29] font-black text-[#7cc520]"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {label}
    </span>
  );
}

// ---------- sons (gerados no aparelho, sem arquivos) ----------
// O navegador (principalmente no iPad) só deixa tocar som depois de um toque na tela.
// Por isso há UM contexto de áudio, destravado no primeiro toque e reaproveitado sempre.
let shared: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (shared && shared.state !== "closed") return shared;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    shared = new Ctx();
    return shared;
  } catch {
    return null;
  }
}

/** Chame num toque/clique: libera o som para o resto da partida. */
export function unlockAudio() {
  const ctx = audio();
  if (!ctx) return;
  if (ctx.state !== "running") ctx.resume().catch(() => {});
  try {
    // um "silêncio" curtinho é o que o iOS exige para soltar o áudio
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* ignora */
  }
}

export const audioReady = () => !!shared && shared.state === "running";

/** Toca quando o áudio estiver liberado (tenta liberar antes). */
function withAudio(play: (ctx: AudioContext) => void) {
  const ctx = audio();
  if (!ctx) return;
  if (ctx.state === "running") play(ctx);
  else
    ctx
      .resume()
      .then(() => ctx.state === "running" && play(ctx))
      .catch(() => {});
}

/** Sirene de ~2,5 s (aluno saiu da tela). */
export function playSiren() {
  withAudio((ctx) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sawtooth";
    const t = ctx.currentTime + 0.02;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
    for (let i = 0; i < 5; i++) {
      o.frequency.setValueAtTime(620, t + i * 0.5);
      o.frequency.linearRampToValueAtTime(1180, t + i * 0.5 + 0.25);
      o.frequency.linearRampToValueAtTime(620, t + i * 0.5 + 0.5);
    }
    g.gain.setValueAtTime(0.12, t + 2.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 2.55);
  });
}

/** Fanfarra curta (revelação na cerimônia). */
export function playFanfare(big = false) {
  withAudio((ctx) => {
    const notes = big ? [523, 659, 784, 1047, 784, 1047] : [523, 659, 784];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (i === notes.length - 1 ? 0.9 : 0.3));
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 1);
    });
  });
}

/** Sirene no meio do telão e, em seguida, o nome de quem saiu numa bola amarela. */
export function SirenAlert({ name, members, stage }: { name: string; members: string[]; stage: "siren" | "name" }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm">
      {stage === "siren" ? (
        <div className="flex flex-col items-center gap-4">
          <div className="relative grid h-56 w-56 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-red-600/60" />
            <span className="absolute inset-6 animate-pulse rounded-full bg-[radial-gradient(circle,#ff3b3b_0%,#b91c1c_70%)] shadow-[0_0_80px_30px_rgba(239,68,68,0.7)]" />
            <span className="relative text-[110px] leading-none">🚨</span>
          </div>
          <p className="animate-pulse text-[40px] font-black uppercase tracking-wider text-white drop-shadow">Alguém saiu do jogo!</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5">
          <div className="grid h-80 w-80 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff59d_0%,#facc15_45%,#ca8a04_100%)] p-8 text-center shadow-[0_0_90px_20px_rgba(250,204,21,0.6)]">
            <div>
              <p className="text-[38px] font-black leading-tight text-[#3b2a00]">{name}</p>
              {members.length > 1 && <p className="mt-1 text-[18px] font-bold text-[#5c4300]">{members.join(" · ")}</p>}
            </div>
          </div>
          <p className="text-[26px] font-black text-white">saiu da tela do jogo e foi bloqueado(a)</p>
        </div>
      )}
    </div>
  );
}

/** Confete simples para a cerimônia. */
export function Confetti() {
  const colors = ["#7cc520", "#1f9d55", "#facc15", "#ffffff", "#34d399"];
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {Array.from({ length: 80 }, (_, i) => (
        <span
          key={i}
          className="absolute top-[-5%] block h-3 w-2 rounded-sm"
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animation: `dqec-fall ${2.5 + (i % 7) * 0.4}s linear ${(i % 10) * 0.25}s infinite`,
            transform: `rotate(${i * 23}deg)`,
          }}
        />
      ))}
      <style>{`@keyframes dqec-fall { to { transform: translateY(110vh) rotate(720deg); } }`}</style>
    </div>
  );
}
