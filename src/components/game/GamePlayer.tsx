"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Delete, Loader2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MathPreview } from "@/components/math/MathPreview";
import { OPTION_STYLES } from "@/lib/game/scoring";
import { channelName, clockOffset, remainingSeconds, rpc, type PlayerState } from "@/lib/game/client";
import { GameBackdrop, TimerRing } from "./ui";

interface Creds {
  playerId: string;
  secret: string;
  gameId: string;
}

const STORE = "dqec:jogo";

function loadCreds(): Creds | null {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "null");
  } catch {
    return null;
  }
}
function saveCreds(c: Creds | null) {
  try {
    if (c) localStorage.setItem(STORE, JSON.stringify(c));
    else localStorage.removeItem(STORE);
  } catch {
    /* sem armazenamento: segue na memória */
  }
}
const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));

/**
 * CELULAR DO ALUNO: entra com o PIN, vê a questão com as alternativas coloridas,
 * responde (quanto mais rápido, mais pontos), vê se acertou e a posição no ranking.
 * Se sair da tela do jogo (outra aba, outro app), fica bloqueado até o professor liberar.
 */
export function GamePlayer({ initialPin }: { initialPin: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [creds, setCreds] = useState<Creds | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<PlayerState | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");

  useEffect(() => {
    setCreds(loadCreds());
    setReady(true);
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const fetchState = useCallback(async () => {
    if (!creds) return;
    try {
      const sent = Date.now();
      const s = await rpc<PlayerState>(supabase, "game_state", { p_player: creds.playerId, p_secret: creds.secret });
      setOffset(clockOffset(s.server_now, sent, Date.now()));
      setState(s);
      setError("");
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      if (/não encontrado/i.test(m)) {
        saveCreds(null);
        setCreds(null);
        setState(null);
      } else setError("Sem conexão… tentando de novo.");
    }
  }, [supabase, creds]);

  // atualização: aviso do telão (na hora) + conferência a cada 1,5 s
  useEffect(() => {
    if (!creds) return;
    fetchState();
    const t = setInterval(fetchState, 1500);
    const ch = supabase.channel(channelName(creds.gameId));
    ch.on("broadcast", { event: "state" }, () => fetchState()).subscribe();
    return () => {
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, [supabase, creds, fetchState]);

  // ---------- não pode sair da tela ----------
  const status = state?.status;
  const watching = !!creds && !!status && status !== "lobby" && status !== "finished";
  const reported = useRef(false);
  useEffect(() => {
    if (!watching) return;
    const onHide = () => {
      if (document.visibilityState === "hidden" && !reported.current && creds) {
        reported.current = true;
        rpc(supabase, "report_violation", { p_player: creds.playerId, p_secret: creds.secret })
          .then(() => fetchState())
          .catch(() => {})
          .finally(() => {
            reported.current = false;
          });
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [watching, supabase, creds, fetchState]);

  // tela sempre acesa durante o jogo (apagar a tela conta como sair)
  useEffect(() => {
    if (!creds) return;
    let lock: { release: () => Promise<void> } | null = null;
    const ask = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        lock = (await wl?.request("screen")) ?? null;
      } catch {
        /* sem suporte */
      }
    };
    ask();
    const again = () => document.visibilityState === "visible" && ask();
    document.addEventListener("visibilitychange", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
      lock?.release().catch(() => {});
    };
  }, [creds]);

  if (!ready) return <GameBackdrop>{null}</GameBackdrop>;
  if (!creds) {
    return (
      <Join
        initialPin={initialPin}
        onJoined={(c) => {
          saveCreds(c);
          setCreds(c);
        }}
      />
    );
  }

  const leave = () => {
    saveCreds(null);
    setCreds(null);
    setState(null);
  };

  return (
    <GameBackdrop>
      <header className="flex items-center gap-2 px-4 pt-3 text-white">
        <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">{state?.player.name ?? "…"}</span>
        {state && state.status !== "lobby" && (
          <span className="rounded-full bg-white/15 px-3 py-1 text-[14px] font-black tabular-nums">{state.player.score} pts</span>
        )}
      </header>
      {error && <p className="mx-4 mt-2 rounded-xl bg-black/30 px-3 py-1.5 text-center text-[13px] font-semibold text-white">{error}</p>}

      <main className="flex flex-1 flex-col px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!state ? (
          <div className="grid flex-1 place-items-center text-white">
            <Loader2 className="animate-spin" size={40} />
          </div>
        ) : state.status === "lobby" ? (
          <Waiting state={state} onLeave={leave} />
        ) : state.status === "question" && state.question ? (
          <Question key={state.index} state={state} creds={creds} remaining={remainingSeconds(state.started_at, state.question.time_limit, offset, now)} onSent={fetchState} />
        ) : state.status === "reveal" || state.status === "ranking" ? (
          <Result state={state} />
        ) : state.status === "finished" ? (
          <Final state={state} onLeave={leave} />
        ) : (
          <Waiting state={state} onLeave={leave} />
        )}
      </main>

      {state?.player.locked && <Locked />}
    </GameBackdrop>
  );
}

// ---------- entrada ----------
function Join({ initialPin, onJoined }: { initialPin: string; onJoined: (c: Creds) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [pin, setPin] = useState(initialPin);
  const [info, setInfo] = useState<{ title: string; team_size: number } | null>(null);
  const [team, setTeam] = useState("");
  const [members, setMembers] = useState<string[]>(["", "", ""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function findGame() {
    setBusy(true);
    setError("");
    try {
      setInfo(await rpc(supabase, "game_info", { p_pin: pin.trim() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "PIN não encontrado.");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!info) return;
    const solo = info.team_size === 1;
    const names = solo ? [team.trim()] : members.slice(0, info.team_size).map((m) => m.trim()).filter(Boolean);
    if (!team.trim()) return setError(solo ? "Digite o seu nome." : "Dê um nome para a equipe.");
    if (!solo && names.length === 0) return setError("Escreva o nome de quem está na equipe.");
    setBusy(true);
    setError("");
    try {
      // tela cheia ajuda o aluno a não sair do jogo (onde o aparelho permite)
      document.documentElement.requestFullscreen?.().catch(() => {});
      const secret = uuid();
      const r = await rpc<{ player_id: string; game_id: string }>(supabase, "join_game", {
        p_pin: pin.trim(),
        p_name: team.trim(),
        p_members: names,
        p_secret: secret,
      });
      onJoined({ playerId: r.player_id, secret, gameId: r.game_id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-2xl border-0 bg-white px-4 py-4 text-center text-[20px] font-extrabold text-violet-950 shadow-lg outline-none placeholder:text-violet-300 focus:ring-4 focus:ring-lime";

  return (
    <GameBackdrop>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-8">
        <div className="text-center text-white">
          <p className="text-[14px] font-extrabold uppercase tracking-[0.25em] text-lime">Deixa que eu Corrijo</p>
          <h1 className="text-[40px] font-black leading-tight drop-shadow">Modo Game</h1>
        </div>
        {!info ? (
          <>
            <input
              className={`${input} font-mono text-[34px] tracking-[0.3em]`}
              inputMode="numeric"
              maxLength={6}
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && pin.length === 6 && findGame()}
            />
            <button
              onClick={findGame}
              disabled={busy || pin.length !== 6}
              className="rounded-2xl bg-lime py-4 text-[22px] font-black text-brand-900 shadow-xl active:scale-95 disabled:opacity-50"
            >
              {busy ? <Loader2 className="mx-auto animate-spin" /> : "Entrar"}
            </button>
          </>
        ) : (
          <>
            <p className="rounded-2xl bg-white/15 px-4 py-3 text-center text-[16px] font-bold text-white">
              {info.title}
              <span className="block text-[13px] font-semibold text-white/75">
                {info.team_size === 1 ? "Jogo individual" : info.team_size === 2 ? "Jogo em duplas" : "Jogo em trios"}
              </span>
            </p>
            <input className={input} maxLength={40} placeholder={info.team_size === 1 ? "Seu nome" : "Nome da equipe"} value={team} onChange={(e) => setTeam(e.target.value)} />
            {info.team_size > 1 &&
              Array.from({ length: info.team_size }, (_, i) => (
                <input
                  key={i}
                  className={`${input} py-3 text-[17px]`}
                  maxLength={40}
                  placeholder={`Integrante ${i + 1}`}
                  value={members[i]}
                  onChange={(e) => setMembers((m) => m.map((x, k) => (k === i ? e.target.value : x)))}
                />
              ))}
            <button onClick={join} disabled={busy} className="rounded-2xl bg-lime py-4 text-[22px] font-black text-brand-900 shadow-xl active:scale-95 disabled:opacity-50">
              {busy ? <Loader2 className="mx-auto animate-spin" /> : "Vamos jogar!"}
            </button>
          </>
        )}
        {error && <p className="rounded-xl bg-white px-4 py-3 text-center text-[15px] font-bold text-red-700">{error}</p>}
        <p className="text-center text-[12px] font-semibold text-white/70">
          Durante o jogo, não saia desta tela: trocar de aba ou de aplicativo bloqueia a sua equipe até o professor liberar.
        </p>
      </main>
    </GameBackdrop>
  );
}

function Waiting({ state, onLeave }: { state: PlayerState; onLeave: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-white">
      <p className="text-[52px]">🎮</p>
      <h2 className="text-[30px] font-black">Você está no jogo!</h2>
      <p className="text-[17px] font-semibold text-white/85">Veja o seu nome no telão e aguarde o professor começar.</p>
      {state.player.members.length > 0 && <p className="rounded-full bg-white/15 px-4 py-2 text-[15px] font-bold">{state.player.members.join(" · ")}</p>}
      <button onClick={onLeave} className="mt-6 text-[13px] font-semibold text-white/70 underline">
        Sair e entrar com outro nome
      </button>
    </div>
  );
}

// ---------- questão ----------
function Question({ state, creds, remaining, onSent }: { state: PlayerState; creds: Creds; remaining: number; onSent: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const q = state.question!;
  const [chosen, setChosen] = useState<string | null>(state.answer?.answer ?? null);
  const [digits, setDigits] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const sent = chosen !== null || !!state.answer;

  async function send(answer: string) {
    if (sent || sending || remaining <= 0) return;
    setSending(true);
    setError("");
    setChosen(answer);
    navigator.vibrate?.(30);
    try {
      await rpc(supabase, "submit_answer", { p_player: creds.playerId, p_secret: creds.secret, p_idx: q.idx, p_answer: answer });
      onSent();
    } catch (e) {
      setChosen(null);
      setError(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  }

  const options =
    q.type === "true_false"
      ? [
          { label: "C", text: "Certo" },
          { label: "E", text: "Errado" },
        ]
      : q.options;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center gap-3">
        <TimerRing seconds={remaining} total={q.time_limit} size={64} />
        <p className="text-[14px] font-extrabold uppercase tracking-wider text-white/85">
          Questão {state.index + 1} de {state.count}
        </p>
      </div>
      <div className="max-h-[38dvh] overflow-y-auto rounded-2xl bg-white p-4 text-[17px] font-semibold leading-snug text-slate-900 shadow-lg">
        <MathPreview text={q.statement} />
        {q.image_url && <img src={q.image_url} alt="" className="mx-auto mt-2 max-h-48 rounded-lg" />}
      </div>

      {sent ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-white">
          <Loader2 className="animate-spin" size={42} />
          <p className="text-[24px] font-black">Resposta enviada!</p>
          <p className="text-[15px] font-semibold text-white/80">Aguarde o fim do tempo…</p>
        </div>
      ) : remaining <= 0 ? (
        <div className="grid flex-1 place-items-center text-center text-[24px] font-black text-white">Tempo esgotado!</div>
      ) : q.type === "numeric" ? (
        <NumericPad digits={digits} setDigits={setDigits} onSend={() => send(digits)} sending={sending} />
      ) : (
        <div className={`grid flex-1 gap-3 ${options.length > 2 ? "grid-cols-2" : "grid-cols-1"}`}>
          {options.map((o, i) => {
            const st = OPTION_STYLES[i % OPTION_STYLES.length];
            return (
              <button
                key={o.label}
                onClick={() => send(o.label)}
                disabled={sending}
                className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl p-3 text-white shadow-lg transition active:scale-95"
                style={{ background: st.bg }}
              >
                <span className="text-[30px] leading-none">{st.shape}</span>
                <span className="flex items-baseline justify-center gap-1 text-[16px] font-extrabold leading-tight">
                  {q.type === "multiple_choice" && <span className="opacity-80">{o.label})</span>}
                  <MathPreview text={o.text} />
                </span>
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="rounded-xl bg-white px-3 py-2 text-center text-[14px] font-bold text-red-700">{error}</p>}
    </div>
  );
}

function NumericPad({ digits, setDigits, onSend, sending }: { digits: string; setDigits: (d: string) => void; onSend: () => void; sending: boolean }) {
  const shown = digits.padStart(3, "0");
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex justify-center gap-2">
        {["Centena", "Dezena", "Unidade"].map((l, i) => (
          <div key={l} className="flex w-20 flex-col items-center rounded-2xl bg-white py-2 shadow-lg">
            <span className={`text-[40px] font-black tabular-nums ${digits.length >= 3 - i ? "text-violet-900" : "text-violet-200"}`}>{shown[i]}</span>
            <span className="text-[11px] font-bold uppercase text-violet-500">{l}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => digits.length < 3 && setDigits(digits + d)} className="rounded-2xl bg-white/90 py-3 text-[26px] font-black text-violet-900 active:scale-95">
            {d}
          </button>
        ))}
        <button onClick={() => setDigits(digits.slice(0, -1))} className="grid place-items-center rounded-2xl bg-white/30 py-3 text-white active:scale-95" aria-label="Apagar">
          <Delete size={26} />
        </button>
        <button onClick={() => digits.length < 3 && setDigits(digits + "0")} className="rounded-2xl bg-white/90 py-3 text-[26px] font-black text-violet-900 active:scale-95">
          0
        </button>
        <button onClick={onSend} disabled={!digits || sending} className="rounded-2xl bg-lime py-3 text-[18px] font-black text-brand-900 active:scale-95 disabled:opacity-40">
          Enviar
        </button>
      </div>
    </div>
  );
}

// ---------- resultado da questão ----------
function Result({ state }: { state: PlayerState }) {
  const a = state.answer;
  const right = a?.correct === true;
  const q = state.question;
  const correctText = (state.correct ?? [])
    .map((c) => (q?.type === "true_false" ? (c === "C" ? "Certo" : "Errado") : q?.type === "multiple_choice" ? `${c}) ${q.options.find((o) => o.label === c)?.text ?? ""}` : c))
    .join(" ou ");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-white">
      <div className={`grid h-32 w-32 place-items-center rounded-full text-[64px] shadow-2xl ${!a ? "bg-slate-500" : right ? "bg-green-500" : "bg-red-500"}`}>
        {!a ? "⏱" : right ? "✔" : "✖"}
      </div>
      <h2 className="text-[34px] font-black">{!a ? "Não respondeu" : right ? "Acertou!" : "Errou"}</h2>
      {right && <p className="rounded-full bg-lime px-5 py-1.5 text-[22px] font-black text-brand-900">+{a?.points} pontos</p>}
      {!right && correctText && (
        <div className="rounded-2xl bg-white px-4 py-3 text-[16px] font-bold text-slate-900">
          Resposta certa: <MathPreview text={correctText} />
        </div>
      )}
      <p className="text-[20px] font-extrabold">
        Você está em {state.player.rank}º lugar <span className="text-white/75">de {state.player.players}</span>
      </p>
      {state.status === "ranking" && state.top && (
        <ol className="w-full max-w-sm space-y-1.5">
          {state.top.map((t, i) => (
            <li key={t.name} className={`flex items-center gap-3 rounded-xl px-4 py-2 text-[16px] font-extrabold ${t.name === state.player.name ? "bg-lime text-brand-900" : "bg-white/90 text-slate-900"}`}>
              <span className="w-7">{i + 1}º</span>
              <span className="min-w-0 flex-1 truncate text-left">{t.name}</span>
              <span className="tabular-nums">{t.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Final({ state, onLeave }: { state: PlayerState; onLeave: () => void }) {
  const medal = ["🥇", "🥈", "🥉"][state.player.rank - 1] ?? "🎉";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-white">
      <p className="text-[80px] leading-none">{medal}</p>
      <h2 className="text-[34px] font-black">Fim de jogo!</h2>
      <p className="text-[22px] font-extrabold">
        {state.player.rank}º lugar · {state.player.score} pontos
      </p>
      <button onClick={onLeave} className="mt-6 rounded-2xl bg-white px-6 py-3 text-[16px] font-black text-violet-900">
        Sair
      </button>
    </div>
  );
}

function Locked() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-red-700/95 p-6 text-center text-white">
      <div className="flex flex-col items-center gap-4">
        <Lock size={64} />
        <h2 className="text-[30px] font-black">Jogo bloqueado</h2>
        <p className="max-w-xs text-[17px] font-semibold">Você saiu da tela do jogo. Chame o professor para liberar a sua equipe.</p>
      </div>
    </div>
  );
}
