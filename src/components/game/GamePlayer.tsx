"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Delete, Loader2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MathPreview } from "@/components/math/MathPreview";
import { channelName, clockOffset, remainingSeconds, rpc, type PlayerState } from "@/lib/game/client";
import { GameBackdrop, GameLogo, OptionBadge, TimerRing } from "./ui";

interface Creds {
  playerId: string;
  secret: string;
  gameId: string;
}

interface Info {
  title: string;
  team_size: number;
  students: { id: string; name: string; roll: number | null; taken: boolean }[];
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
 * CELULAR DO ALUNO: escolhe o próprio nome na lista da turma, responde as questões
 * e vê se acertou. Pontos e posição só aparecem no fim, depois da cerimônia no telão.
 * Sair da tela do jogo (outra aba, outro app, tela dividida, tela apagada) bloqueia
 * o aluno até o professor liberar.
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
  const report = useCallback(() => {
    if (reported.current || !creds) return;
    reported.current = true;
    rpc(supabase, "report_violation", { p_player: creds.playerId, p_secret: creds.secret })
      .then(() => fetchState())
      .catch(() => {})
      .finally(() => {
        setTimeout(() => (reported.current = false), 3000);
      });
  }, [supabase, creds, fetchState]);

  useEffect(() => {
    if (!watching) return;
    const onHide = () => document.visibilityState === "hidden" && report();
    // Tela dividida / janela flutuante (Android): a página perde o foco ou fica bem menor que a tela.
    let unfocused = 0;
    const full = { w: window.innerWidth, h: window.innerHeight };
    const check = setInterval(() => {
      const typing = document.activeElement instanceof HTMLInputElement;
      if (!document.hasFocus()) {
        unfocused++;
        if (unfocused >= 2) report();
      } else unfocused = 0;
      const area = window.innerWidth * window.innerHeight;
      const fullArea = Math.max(full.w * full.h, 1);
      if (!typing && area < fullArea * 0.6) report();
    }, 1000);
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      clearInterval(check);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [watching, report]);

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
        <GameLogo height={30} />
        <span className="min-w-0 flex-1 truncate text-right text-[15px] font-extrabold">{state?.player.name ?? "…"}</span>
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
        ) : state.status === "reveal" ? (
          <Result state={state} />
        ) : state.status === "finished" ? (
          <Final state={state} onLeave={leave} />
        ) : (
          <Between />
        )}
      </main>

      {state?.player.locked && state.status !== "finished" && <Locked />}
    </GameBackdrop>
  );
}

// ---------- entrada ----------
function Join({ initialPin, onJoined }: { initialPin: string; onJoined: (c: Creds) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [pin, setPin] = useState(initialPin);
  const [info, setInfo] = useState<Info | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [team, setTeam] = useState("");
  const [members, setMembers] = useState<string[]>(["", "", ""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function findGame() {
    setBusy(true);
    setError("");
    try {
      const r = await rpc<Info>(supabase, "game_info", { p_pin: pin.trim() });
      setInfo({ ...r, students: r.students ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "PIN não encontrado.");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!info) return;
    const fromList = info.students.length > 0;
    const solo = info.team_size === 1;
    if (fromList && picked.length === 0) return setError(solo ? "Toque no seu nome." : "Toquem nos nomes de quem está na equipe.");
    const names = fromList ? [] : solo ? [team.trim()] : members.slice(0, info.team_size).map((m) => m.trim()).filter(Boolean);
    if (!fromList && !team.trim()) return setError(solo ? "Digite o seu nome." : "Dê um nome para a equipe.");
    setBusy(true);
    setError("");
    try {
      document.documentElement.requestFullscreen?.().catch(() => {});
      const secret = uuid();
      const r = await rpc<{ player_id: string; game_id: string }>(supabase, "join_game", {
        p_pin: pin.trim(),
        p_name: team.trim(),
        p_members: names,
        p_secret: secret,
        p_students: picked,
      });
      onJoined({ playerId: r.player_id, secret, gameId: r.game_id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar.");
      if (info.students.length) findGame();
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-2xl border-0 bg-white px-4 py-4 text-center text-[20px] font-extrabold text-[#0b3b29] shadow-lg outline-none placeholder:text-[#9cc5a8] focus:ring-4 focus:ring-[#7cc520]";
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : info?.team_size === 1 ? [id] : p.length < (info?.team_size ?? 1) ? [...p, id] : p));

  return (
    <GameBackdrop>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-8">
        <div className="flex flex-col items-center gap-2 text-center text-white">
          <GameLogo height={48} />
          <h1 className="text-[34px] font-black leading-tight drop-shadow">Modo Game</h1>
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
              className="rounded-2xl bg-[#7cc520] py-4 text-[22px] font-black text-[#0b3b29] shadow-xl active:scale-95 disabled:opacity-50"
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
            {info.students.length > 0 ? (
              <>
                <p className="text-center text-[15px] font-bold text-white">
                  {info.team_size === 1 ? "Toque no seu nome" : `Toquem nos nomes de todos da equipe (até ${info.team_size})`}
                  {info.team_size > 1 && (
                    <span className="block text-[12px] font-semibold text-white/80">
                      Só um celular por equipe. Cada integrante recebe a nota no próprio boletim. {picked.length}/{info.team_size} escolhidos
                    </span>
                  )}
                </p>
                <div className="max-h-[42dvh] space-y-1.5 overflow-y-auto rounded-2xl bg-white/10 p-2">
                  {info.students.map((s) => {
                    const on = picked.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        disabled={s.taken}
                        onClick={() => toggle(s.id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[16px] font-bold transition ${
                          on ? "bg-[#7cc520] text-[#0b3b29]" : s.taken ? "bg-white/10 text-white/40" : "bg-white text-[#0b3b29] active:scale-[0.98]"
                        }`}
                      >
                        <span className="w-7 text-right text-[13px] opacity-70">{s.roll ?? "–"}</span>
                        <span className="min-w-0 flex-1 truncate">{s.name}</span>
                        {on && <Check size={20} strokeWidth={3} />}
                        {s.taken && <span className="text-[11px] font-semibold">já entrou</span>}
                      </button>
                    );
                  })}
                </div>
                {info.team_size > 1 && (
                  <input className={`${input} py-3 text-[17px]`} maxLength={40} placeholder="Nome da equipe (opcional)" value={team} onChange={(e) => setTeam(e.target.value)} />
                )}
              </>
            ) : (
              <>
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
              </>
            )}
            <button onClick={join} disabled={busy} className="rounded-2xl bg-[#7cc520] py-4 text-[22px] font-black text-[#0b3b29] shadow-xl active:scale-95 disabled:opacity-50">
              {busy ? <Loader2 className="mx-auto animate-spin" /> : "Vamos jogar!"}
            </button>
          </>
        )}
        {error && <p className="rounded-xl bg-white px-4 py-3 text-center text-[15px] font-bold text-red-700">{error}</p>}
        <a href="/login" className="text-center text-[13px] font-semibold text-white/80 underline">
          Sou professor(a)
        </a>
        <p className="text-center text-[12px] font-semibold text-white/70">
          Durante o jogo, não saia desta tela: trocar de aba, abrir outro app ou dividir a tela bloqueia você até o professor liberar.
        </p>
      </main>
    </GameBackdrop>
  );
}

function Waiting({ state, onLeave }: { state: PlayerState; onLeave: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-white">
      <p className="text-[52px]">✏️</p>
      <h2 className="text-[30px] font-black">Você está no jogo!</h2>
      <p className="text-[17px] font-semibold text-white/85">Veja o seu nome no telão e aguarde o professor começar.</p>
      {state.player.members.length > 0 && <p className="rounded-full bg-white/15 px-4 py-2 text-[15px] font-bold">{state.player.members.join(" · ")}</p>}
      <button onClick={onLeave} className="mt-6 text-[13px] font-semibold text-white/70 underline">
        Sair e entrar com outro nome
      </button>
    </div>
  );
}

function Between() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-white">
      <Loader2 className="animate-spin" size={42} />
      <p className="text-[22px] font-black">Preparando a próxima questão…</p>
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
        <div className="flex flex-1 flex-col gap-2.5">
          {options.map((o) => (
            <button
              key={o.label}
              onClick={() => send(o.label)}
              disabled={sending}
              className="flex min-h-16 items-center gap-3 rounded-2xl bg-white p-3 text-left text-[17px] font-extrabold text-[#0b3b29] shadow-lg ring-[#7cc520] transition active:scale-[0.98] active:ring-4"
            >
              <OptionBadge label={o.label} size={42} />
              <span className="min-w-0 flex-1">
                <MathPreview text={o.text} />
              </span>
            </button>
          ))}
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
            <span className={`text-[40px] font-black tabular-nums ${digits.length >= 3 - i ? "text-[#0b3b29]" : "text-[#c7dccd]"}`}>{shown[i]}</span>
            <span className="text-[11px] font-bold uppercase text-[#1f9d55]">{l}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => digits.length < 3 && setDigits(digits + d)} className="rounded-2xl bg-white/90 py-3 text-[26px] font-black text-[#0b3b29] active:scale-95">
            {d}
          </button>
        ))}
        <button onClick={() => setDigits(digits.slice(0, -1))} className="grid place-items-center rounded-2xl bg-white/30 py-3 text-white active:scale-95" aria-label="Apagar">
          <Delete size={26} />
        </button>
        <button onClick={() => digits.length < 3 && setDigits(digits + "0")} className="rounded-2xl bg-white/90 py-3 text-[26px] font-black text-[#0b3b29] active:scale-95">
          0
        </button>
        <button onClick={onSend} disabled={!digits || sending} className="rounded-2xl bg-[#7cc520] py-3 text-[18px] font-black text-[#0b3b29] active:scale-95 disabled:opacity-40">
          Enviar
        </button>
      </div>
    </div>
  );
}

// ---------- resultado da questão (sem pontos) ----------
function Result({ state }: { state: PlayerState }) {
  const a = state.answer;
  const right = a?.correct === true;
  const q = state.question;
  const correctText = (state.correct ?? [])
    .map((c) => (q?.type === "true_false" ? (c === "C" ? "Certo" : "Errado") : q?.type === "multiple_choice" ? `${c}) ${q.options.find((o) => o.label === c)?.text ?? ""}` : c))
    .join(" ou ");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-white">
      <div className={`grid h-32 w-32 place-items-center rounded-full text-[64px] shadow-2xl ${!a ? "bg-slate-500" : right ? "bg-[#1f9d55]" : "bg-[#d64545]"}`}>
        {!a ? "⏱" : right ? "✔" : "✖"}
      </div>
      <h2 className="text-[34px] font-black">{!a ? "Não respondeu" : right ? "Acertou!" : "Errou"}</h2>
      {!right && correctText && (
        <div className="rounded-2xl bg-white px-4 py-3 text-[16px] font-bold text-slate-900">
          Resposta certa: <MathPreview text={correctText} />
        </div>
      )}
      <p className="text-[15px] font-semibold text-white/80">Os pontos e o ranking só aparecem na cerimônia, no final.</p>
    </div>
  );
}

function Final({ state, onLeave }: { state: PlayerState; onLeave: () => void }) {
  // até o professor revelar o campeão, o celular só pede para olhar o telão
  if (state.ceremony_step < 3 || state.player.rank === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-white">
        <p className="animate-bounce text-[80px] leading-none">🏆</p>
        <h2 className="text-[30px] font-black">Fim de jogo!</h2>
        <p className="text-[18px] font-bold text-white/85">Olhe para o telão: a cerimônia vai revelar o 3º, o 2º e o campeão.</p>
        {state.player.hits !== null && (
          <p className="rounded-full bg-white/15 px-4 py-2 text-[15px] font-bold">
            Você acertou {state.player.hits} de {state.count}
          </p>
        )}
      </div>
    );
  }
  const medal = ["🏆", "🥈", "🥉"][state.player.rank - 1] ?? "🎉";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-white">
      <p className="text-[80px] leading-none">{medal}</p>
      <h2 className="text-[34px] font-black">{state.player.rank}º lugar</h2>
      <p className="text-[22px] font-extrabold text-[#7cc520]">{state.player.score} pontos</p>
      <p className="text-[16px] font-semibold text-white/85">
        Acertou {state.player.hits} de {state.count} · {state.player.players} participante(s)
      </p>
      <button onClick={onLeave} className="mt-6 rounded-2xl bg-white px-6 py-3 text-[16px] font-black text-[#0b3b29]">
        Sair
      </button>
    </div>
  );
}

function Locked() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#b91c1c]/95 p-6 text-center text-white">
      <div className="flex flex-col items-center gap-4">
        <span className="text-[72px] leading-none">🚨</span>
        <Lock size={48} />
        <h2 className="text-[30px] font-black">Jogo bloqueado</h2>
        <p className="max-w-xs text-[17px] font-semibold">Você saiu da tela do jogo e o seu nome apareceu no telão. Chame o professor para liberar.</p>
      </div>
    </div>
  );
}
