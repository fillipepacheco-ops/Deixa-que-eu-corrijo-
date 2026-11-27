"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Lock, Maximize, Minus, Play, ShieldAlert, SkipForward, Trophy, Unlock, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MathPreview } from "@/components/math/MathPreview";
import { GAME_COLORS, ranking } from "@/lib/game/scoring";
import { channelName, clockOffset, remainingSeconds, rpc, type GameQuestion, type GameStatus } from "@/lib/game/client";
import { removePlayer, saveGameResults, setCeremonyStep, unlockAll, unlockPlayer } from "@/services/games";
import { Confetti, GameBackdrop, GameLogo, OptionBadge, SirenAlert, TimerRing, playFanfare, playSiren } from "./ui";

interface HostGame {
  id: string;
  title: string;
  pin: string;
  team_size: number;
  status: GameStatus;
  current_index: number;
  question_started_at: string | null;
  question_count: number;
  ceremony_step: number;
  results_saved_at: string | null;
}

interface Player {
  id: string;
  name: string;
  members: string[];
  score: number;
  violations: number;
  locked: boolean;
}

interface Answer {
  player_id: string;
  answer: string | null;
  correct: boolean;
}

/**
 * TELÃO DO PROFESSOR (data show).
 * Sem pontos nem ranking durante a partida: a cada questão só aparece quem acertou
 * e quem errou. No final, a cerimônia revela o 3º, o 2º e o campeão.
 */
export function GameHost({
  game: initial,
  questions,
  keys,
  joinUrl,
}: {
  game: HostGame;
  questions: GameQuestion[];
  keys: Record<number, string[]>;
  joinUrl: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<GameStatus>(initial.status);
  const [index, setIndex] = useState(initial.current_index);
  const [startedAt, setStartedAt] = useState<string | null>(initial.question_started_at);
  const [ceremony, setCeremony] = useState(initial.ceremony_step ?? 0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showBlocked, setShowBlocked] = useState(false);
  const [alerts, setAlerts] = useState<Player[]>([]);
  const [alertStage, setAlertStage] = useState<"siren" | "name">("siren");
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const revealing = useRef(false);
  const knownLocked = useRef<Set<string> | null>(null);

  const q = index >= 0 ? questions[index] : null;
  const correct = q ? (keys[q.idx] ?? []) : [];

  useEffect(() => {
    const sent = Date.now();
    rpc<string>(supabase, "game_now", {})
      .then((iso) => setOffset(clockOffset(iso, sent, Date.now())))
      .catch(() => {});
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [supabase]);

  useEffect(() => {
    const ch = supabase.channel(channelName(initial.id));
    ch.subscribe();
    channel.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, initial.id]);

  const notify = useCallback(() => {
    channel.current?.send({ type: "broadcast", event: "state", payload: { at: Date.now() } }).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    const [{ data: ps }, { data: as }] = await Promise.all([
      supabase.from("game_players").select("id, name, members, score, violations, locked").eq("game_id", initial.id).order("joined_at"),
      index >= 0
        ? supabase.from("game_answers").select("player_id, answer, correct").eq("game_id", initial.id).eq("idx", index)
        : Promise.resolve({ data: [] as Answer[] }),
    ]);
    if (ps) {
      const list = ps as Player[];
      // quem acabou de ser bloqueado → sirene no telão
      const lockedNow = new Set(list.filter((p) => p.locked).map((p) => p.id));
      if (knownLocked.current) {
        const fresh = list.filter((p) => p.locked && !knownLocked.current!.has(p.id));
        if (fresh.length) setAlerts((a) => [...a, ...fresh]);
      }
      knownLocked.current = lockedNow;
      setPlayers(list);
    }
    if (as) setAnswers(as as Answer[]);
  }, [supabase, initial.id, index]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, [refresh]);

  // fila de alertas: sirene (2,6 s) → nome na bola amarela (4 s)
  const currentAlert = alerts.length > 0 ? alerts[0].id : null;
  useEffect(() => {
    if (!currentAlert) return;
    setAlertStage("siren");
    playSiren();
    const t1 = setTimeout(() => setAlertStage("name"), 2600);
    const t2 = setTimeout(() => setAlerts((a) => a.slice(1)), 6800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [currentAlert]);

  const go = useCallback(
    async (next: GameStatus, nextIndex?: number) => {
      setBusy(true);
      setError("");
      try {
        const sent = Date.now();
        const r = await rpc<{ status: GameStatus; index: number; started_at: string | null; server_now: string }>(supabase, "game_go", {
          p_game: initial.id,
          p_status: next,
          p_index: nextIndex ?? null,
        });
        setOffset(clockOffset(r.server_now, sent, Date.now()));
        if (r.index !== index) setAnswers([]);
        setStatus(r.status);
        setIndex(r.index);
        setStartedAt(r.started_at);
        revealing.current = false;
        notify();
        if (next === "finished") {
          setCeremony(0);
          setAlerts([]);
          const res = await saveGameResults(initial.id);
          setNotice(
            res.ok
              ? `Notas salvas em Resultados: ${res.saved ?? 0} aluno(s)${res.skipped ? ` · ${res.skipped} já tinham correção pela câmera ou à mão e foram mantidos` : ""}.`
              : (res.error ?? ""),
          );
          refresh();
        }
      } catch (e) {
        revealing.current = false; // deixa tentar de novo
        setError(e instanceof Error ? e.message : "Erro ao mudar a fase do jogo.");
      } finally {
        setBusy(false);
      }
    },
    [supabase, initial.id, index, notify, refresh],
  );

  const reveal = async (step: number) => {
    setCeremony(step);
    playFanfare(step === 3);
    await setCeremonyStep(initial.id, step);
    notify();
  };

  const remaining = q ? remainingSeconds(startedAt, q.time_limit, offset, now) : 0;
  const active = players.filter((p) => !p.locked);
  const answeredIds = new Set(answers.map((a) => a.player_id));
  const allAnswered = active.length > 0 && active.every((p) => answeredIds.has(p.id));

  // tempo acabou ou todos responderam → encerra a questão e mostra o resultado.
  // (O relógio atualiza a tela 5x por segundo; o encerramento não pode ser cancelado por isso.)
  const timeUp = remaining <= 0;
  const shouldReveal = status === "question" && !!q && (timeUp || allAnswered);
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    if (!shouldReveal || revealing.current) return;
    revealing.current = true;
    setTimeout(() => goRef.current("reveal"), timeUp ? 0 : 800);
  }, [shouldReveal, timeUp]);

  const hits = answers.filter((a) => a.correct).length;
  const misses = answers.length - hits;
  const noAnswer = Math.max(0, players.length - answers.length);
  const blocked = players.filter((p) => p.violations > 0 || p.locked);
  const lockedNow = players.filter((p) => p.locked);
  const ranked = ranking(players);
  const last = index + 1 >= questions.length;

  const optionList =
    q?.type === "multiple_choice"
      ? q.options
      : q?.type === "true_false"
        ? [
            { label: "C", text: "Certo" },
            { label: "E", text: "Errado" },
          ]
        : [];

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <GameBackdrop>
      <header className="flex items-center gap-3 px-4 py-3 sm:px-8">
        <Link
          href="/jogos"
          onClick={async (e) => {
            // sair no meio do jogo: encerrar libera todos os bloqueados e salva as notas
            if (status === "question" || status === "reveal") {
              e.preventDefault();
              if (window.confirm("Encerrar o jogo agora? Todos os alunos bloqueados serão liberados e as notas vão para Resultados.")) {
                await go("finished");
                window.location.href = "/jogos";
              }
            }
          }}
          className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20"
          title="Sair do telão"
        >
          <ArrowLeft size={20} />
        </Link>
        <GameLogo />
        <p className="min-w-0 flex-1 truncate text-[15px] font-bold text-white/85">{initial.title}</p>
        {status !== "lobby" && status !== "finished" && <span className="rounded-full bg-white/15 px-3 py-1.5 text-[14px] font-extrabold text-white">PIN {initial.pin}</span>}
        <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[14px] font-bold text-white">
          <Users size={16} /> {players.length}
        </span>
        <button
          onClick={() => setShowBlocked(true)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-bold ${lockedNow.length ? "bg-yellow-400 text-yellow-950" : "bg-white/15 text-white"}`}
          title="Alunos que saíram da tela"
        >
          <ShieldAlert size={16} /> Bloqueados{lockedNow.length > 0 && ` (${lockedNow.length})`}
        </button>
        <button onClick={fullscreen} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20" title="Tela cheia">
          <Maximize size={18} />
        </button>
      </header>

      {error && <p className="mx-4 rounded-xl bg-red-600 px-4 py-2 text-center font-bold text-white sm:mx-8">{error}</p>}

      <main className="flex flex-1 flex-col px-4 pb-6 sm:px-8">
        {/* ---------- ENTRADA ---------- */}
        {status === "lobby" && (
          <div className="flex flex-1 flex-col items-center gap-6 pt-4 text-center text-white">
            <div className="rounded-3xl bg-white px-8 py-5 shadow-2xl">
              <p className="text-[18px] font-bold text-[#0f5132]">
                Abra <span className="underline">{joinUrl.replace(/^https?:\/\//, "").replace(/\/jogar$/, "")}</span>, toque em <strong>Aluno(a)</strong> e digite o PIN
              </p>
              <p className="mt-1 font-mono text-[72px] font-black leading-none tracking-[0.12em] text-[#0b3b29] sm:text-[110px]">{initial.pin}</p>
            </div>
            <p className="text-[18px] font-bold text-white/80">
              {initial.team_size === 1 ? "Individual" : initial.team_size === 2 ? "Em duplas" : "Em trios"} · {questions.length} questões
            </p>
            <div className="flex max-w-5xl flex-wrap justify-center gap-3">
              {players.length === 0 && <p className="animate-pulse text-[20px] font-bold text-white/70">Esperando os alunos entrarem…</p>}
              {players.map((p) => (
                <span key={p.id} className="group flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[18px] font-extrabold text-[#0b3b29] shadow-lg" title={p.members.join(", ")}>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#7cc520]" />
                  {p.name}
                  <button
                    onClick={async () => {
                      await removePlayer(p.id);
                      refresh();
                    }}
                    className="hidden rounded-full bg-black/10 p-0.5 group-hover:block"
                    title="Tirar do jogo"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
            <button
              onClick={() => go("question", 0)}
              disabled={busy || players.length === 0}
              className="mt-auto flex items-center gap-3 rounded-2xl bg-[#7cc520] px-10 py-5 text-[24px] font-black text-[#0b3b29] shadow-xl transition hover:scale-105 disabled:opacity-40"
            >
              <Play size={28} fill="currentColor" /> Começar
            </button>
          </div>
        )}

        {/* ---------- QUESTÃO / RESULTADO DA QUESTÃO ---------- */}
        {(status === "question" || status === "reveal") && q && (
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1 rounded-3xl bg-white p-5 text-[22px] font-bold leading-snug text-slate-900 shadow-xl sm:text-[28px]">
                <p className="mb-1 text-[14px] font-extrabold uppercase tracking-wider text-[#1f9d55]">
                  Questão {index + 1} de {questions.length}
                </p>
                <MathPreview text={q.statement} />
                {q.image_url && <img src={q.image_url} alt="" className="mx-auto mt-3 max-h-[26vh] rounded-xl" />}
              </div>
              <div className="flex shrink-0 flex-col items-center gap-2">
                {status === "question" ? (
                  <TimerRing seconds={remaining} total={q.time_limit} size={120} />
                ) : (
                  <div className="grid h-[120px] w-[120px] place-items-center rounded-full bg-white text-center text-[16px] font-black text-[#0b3b29]">
                    Tempo
                    <br />
                    encerrado
                  </div>
                )}
                <div className="rounded-2xl bg-white/15 px-4 py-2 text-center text-white">
                  <p className="text-[34px] font-black leading-none">{answers.length}</p>
                  <p className="text-[13px] font-bold text-white/80">de {active.length} responderam</p>
                </div>
              </div>
            </div>

            {/* alternativas sem nenhum número: ninguém vê o que os outros marcaram */}
            {q.type !== "numeric" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {optionList.map((o) => {
                  const showRight = status === "reveal" && correct.includes(o.label);
                  return (
                    <div
                      key={o.label}
                      className={`flex items-center gap-4 rounded-2xl px-5 shadow-lg transition ${status === "reveal" ? "py-2.5" : "py-4"} ${
                        showRight ? "bg-[#7cc520] text-[#0b3b29] ring-4 ring-white" : status === "reveal" ? "bg-white/40 text-slate-700" : "bg-white text-slate-900"
                      }`}
                    >
                      <OptionBadge label={o.label} />
                      <span className={`flex min-w-0 flex-1 items-baseline font-extrabold ${status === "reveal" ? "text-[19px]" : "text-[20px] sm:text-[24px]"}`}>
                        <MathPreview text={o.text} />
                      </span>
                      {showRight && <Check size={34} strokeWidth={4} />}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-white/10 p-6 text-center text-white">
                <p className="text-[22px] font-extrabold">Tipo B · resposta numérica</p>
                {status === "reveal" && (
                  <p className="text-[40px] font-black">
                    Resposta: <span className="rounded-2xl bg-[#7cc520] px-4 text-[#0b3b29]">{correct.join(" ou ")}</span>
                  </p>
                )}
              </div>
            )}

            {status === "reveal" && <RevealPanel players={players} answers={answers} hits={hits} misses={misses} noAnswer={noAnswer} />}

            <div className="flex justify-end gap-3">
              {status === "question" && (
                <button onClick={() => go("reveal")} disabled={busy} className="rounded-2xl bg-white/15 px-5 py-3 text-[16px] font-bold text-white hover:bg-white/25">
                  Encerrar a questão agora
                </button>
              )}
              {status === "reveal" &&
                (last ? (
                  <button
                    onClick={() => go("finished")}
                    disabled={busy}
                    className="flex items-center gap-2 rounded-2xl bg-[#7cc520] px-7 py-4 text-[20px] font-black text-[#0b3b29] shadow-xl hover:scale-105"
                  >
                    <Trophy size={24} /> Encerrar a partida e ir para a cerimônia
                  </button>
                ) : (
                  <button
                    onClick={() => go("question", index + 1)}
                    disabled={busy}
                    className="flex items-center gap-2 rounded-2xl bg-[#7cc520] px-7 py-4 text-[20px] font-black text-[#0b3b29] shadow-xl hover:scale-105"
                  >
                    <SkipForward size={24} /> Próxima questão ({index + 2} de {questions.length})
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* ---------- CERIMÔNIA ---------- */}
        {status === "finished" && <Ceremony ranked={ranked} step={ceremony} onReveal={reveal} notice={notice} />}

        {/* partida antiga parada no ranking (versão anterior do jogo) */}
        {status === "ranking" && (
          <div className="grid flex-1 place-items-center">
            <button
              onClick={() => (last ? go("finished") : go("question", index + 1))}
              className="rounded-2xl bg-[#7cc520] px-8 py-4 text-[20px] font-black text-[#0b3b29]"
            >
              {last ? "Encerrar a partida" : "Próxima questão"}
            </button>
          </div>
        )}
      </main>

      {alerts.length > 0 && status !== "finished" && <SirenAlert name={alerts[0].name} members={alerts[0].members} stage={alertStage} />}

      {showBlocked && (
        <BlockedList
          players={blocked}
          onClose={() => setShowBlocked(false)}
          onUnlock={async (id) => {
            await unlockPlayer(id);
            refresh();
          }}
          onUnlockAll={async () => {
            await unlockAll(initial.id);
            refresh();
          }}
        />
      )}
    </GameBackdrop>
  );
}

/** Resultado da questão: gráfico de acertos e erros + quem acertou e quem errou. */
function RevealPanel({ players, answers, hits, misses, noAnswer }: { players: Player[]; answers: Answer[]; hits: number; misses: number; noAnswer: number }) {
  const max = Math.max(1, hits, misses, noAnswer);
  const bars = [
    { label: "Acertaram", n: hits, color: GAME_COLORS.right },
    { label: "Erraram", n: misses, color: GAME_COLORS.wrong },
    { label: "Sem resposta", n: noAnswer, color: GAME_COLORS.none },
  ];
  const byPlayer = new Map(answers.map((a) => [a.player_id, a]));
  return (
    <div className="grid gap-4 rounded-3xl bg-white p-5 text-slate-900 shadow-xl lg:grid-cols-[360px_1fr]">
      <div className="flex h-44 items-end justify-around gap-4">
        {bars.map((b) => (
          <div key={b.label} className="flex h-full w-full max-w-24 flex-col items-center justify-end gap-1">
            <span className="text-[26px] font-black tabular-nums">{b.n}</span>
            <div className="w-full rounded-t-xl transition-all duration-700" style={{ height: `${(b.n / max) * 100}%`, minHeight: 6, background: b.color }} />
            <span className="text-center text-[13px] font-extrabold text-slate-600">{b.label}</span>
          </div>
        ))}
      </div>
      <div className="flex max-h-44 flex-wrap content-start gap-2 overflow-y-auto">
        {players.map((p) => {
          const a = byPlayer.get(p.id);
          const st = !a ? "none" : a.correct ? "right" : "wrong";
          return (
            <span
              key={p.id}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[15px] font-bold ${
                st === "right" ? "bg-green-100 text-green-800" : st === "wrong" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-500"
              }`}
            >
              {st === "right" ? <Check size={16} strokeWidth={3} /> : st === "wrong" ? <X size={16} strokeWidth={3} /> : <Minus size={16} />}
              {p.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function BlockedList({
  players,
  onClose,
  onUnlock,
  onUnlockAll,
}: {
  players: Player[];
  onClose: () => void;
  onUnlock: (id: string) => void;
  onUnlockAll: () => void;
}) {
  const lockedCount = players.filter((p) => p.locked).length;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 text-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="text-yellow-600" />
          <h2 className="flex-1 text-[20px] font-black">Saíram da tela do jogo</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        {players.length === 0 ? (
          <p className="py-6 text-center text-slate-500">Ninguém saiu da tela até agora.</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {players.map((p) => (
              <li key={p.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${p.locked ? "bg-yellow-100" : "bg-slate-50"}`}>
                {p.locked ? <Lock size={18} className="text-yellow-700" /> : <Unlock size={18} className="text-green-700" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold">{p.name}</span>
                  <span className="block text-[12px] text-slate-600">
                    {p.members.length > 1 ? `${p.members.join(", ")} · ` : ""}saiu {p.violations} vez(es) · {p.locked ? "bloqueado" : "liberado"}
                  </span>
                </span>
                {p.locked && (
                  <button onClick={() => onUnlock(p.id)} className="rounded-xl bg-[#0b3b29] px-3 py-2 text-[13px] font-bold text-white">
                    Liberar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {lockedCount > 1 && (
          <button onClick={onUnlockAll} className="mt-3 w-full rounded-xl bg-[#7cc520] px-4 py-3 font-black text-[#0b3b29]">
            Liberar todos ({lockedCount})
          </button>
        )}
      </div>
    </div>
  );
}

/** Cerimônia: o professor revela o 3º, depois o 2º e por fim o campeão. */
function Ceremony({
  ranked,
  step,
  onReveal,
  notice,
}: {
  ranked: (Player & { position: number })[];
  step: number;
  onReveal: (step: number) => void;
  notice: string;
}) {
  const [first, second, third] = [ranked[0], ranked[1], ranked[2]];
  const slots = [
    { p: second, place: 2, show: step >= 2, h: "h-44", medal: "🥈", color: "#cbd5e1" },
    { p: first, place: 1, show: step >= 3, h: "h-60", medal: "🏆", color: "#7cc520" },
    { p: third, place: 3, show: step >= 1, h: "h-32", medal: "🥉", color: "#d6a35c" },
  ];
  const nextStep = step === 0 && !third ? (second ? 2 : 3) : step === 1 && !second ? 3 : step + 1;
  const nextLabel = nextStep === 1 ? "Revelar o 3º lugar" : nextStep === 2 ? "Revelar o 2º lugar" : "Revelar o CAMPEÃO";

  return (
    <div className="flex flex-1 flex-col items-center gap-6 pt-2 text-white">
      {step >= 3 && <Confetti />}
      <h2 className="text-[40px] font-black drop-shadow">{step >= 3 ? "Temos um campeão!" : "Cerimônia de premiação"}</h2>
      <div className="flex w-full max-w-4xl items-end justify-center gap-4">
        {slots.map((s) => (
          <div key={s.place} className="flex w-1/3 max-w-64 flex-col items-center gap-2">
            {s.p && s.show ? (
              <div className="flex flex-col items-center gap-1" style={{ animation: "dqec-pop 0.6s ease-out" }}>
                <span className="text-[56px] leading-none">{s.medal}</span>
                <p className="text-center text-[24px] font-black">{s.p.name}</p>
                {s.p.members.length > 1 && <p className="text-center text-[14px] font-semibold text-white/80">{s.p.members.join(" · ")}</p>}
                <p className="text-[18px] font-bold text-[#7cc520]">{s.p.score} pontos</p>
              </div>
            ) : (
              <span className="text-[56px] leading-none opacity-60">{s.p ? "❔" : ""}</span>
            )}
            <div className={`grid w-full ${s.h} place-items-center rounded-t-3xl text-[48px] font-black text-[#0b3b29] shadow-2xl`} style={{ background: s.color }}>
              {s.place}º
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes dqec-pop { from { transform: scale(0.3); opacity: 0 } 70% { transform: scale(1.15) } to { transform: scale(1); opacity: 1 } }`}</style>

      {step < 3 && ranked.length > 0 && (
        <button
          onClick={() => onReveal(nextStep)}
          className="flex animate-pulse items-center gap-3 rounded-2xl bg-[#7cc520] px-9 py-4 text-[24px] font-black text-[#0b3b29] shadow-xl hover:scale-105"
        >
          <Trophy size={28} /> {nextLabel}
        </button>
      )}

      {step >= 3 && ranked.length > 3 && (
        <ol className="w-full max-w-2xl space-y-1.5">
          {ranked.slice(3).map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl bg-white/90 px-4 py-2 text-[17px] font-bold text-slate-900">
              <span className="w-8 text-center">{p.position}º</span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="tabular-nums">{p.score}</span>
            </li>
          ))}
        </ol>
      )}
      {notice && <p className="rounded-xl bg-white/15 px-4 py-2 text-center text-[14px] font-semibold text-white">{notice}</p>}
    </div>
  );
}
