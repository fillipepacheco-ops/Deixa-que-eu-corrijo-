"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Lock, Maximize, Play, SkipForward, Trophy, Unlock, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MathPreview } from "@/components/math/MathPreview";
import { OPTION_STYLES, ranking } from "@/lib/game/scoring";
import { channelName, clockOffset, remainingSeconds, rpc, type GameQuestion, type GameStatus } from "@/lib/game/client";
import { removePlayer, unlockPlayer } from "@/services/games";
import { GameBackdrop, TimerRing } from "./ui";

interface HostGame {
  id: string;
  title: string;
  pin: string;
  team_size: number;
  status: GameStatus;
  current_index: number;
  question_started_at: string | null;
  question_count: number;
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
  points: number;
}

const TF_LABEL: Record<string, string> = { C: "Certo", E: "Errado" };

/**
 * TELÃO DO PROFESSOR (data show): PIN e equipes na entrada, questão com o tempo
 * correndo e os números de cada alternativa subindo ao vivo, gráfico de acertos
 * e erros, ranking entre as questões e pódio no final.
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
  const [players, setPlayers] = useState<Player[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const revealing = useRef(false);

  const q = index >= 0 ? questions[index] : null;
  const correct = q ? (keys[q.idx] ?? []) : [];

  // relógio do servidor
  useEffect(() => {
    const sent = Date.now();
    rpc<string>(supabase, "game_now", {})
      .then((iso) => setOffset(clockOffset(iso, sent, Date.now())))
      .catch(() => {});
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [supabase]);

  // canal ao vivo (avisa os celulares quando a fase muda)
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

  // equipes e respostas (atualiza a cada segundo)
  const refresh = useCallback(async () => {
    const [{ data: ps }, { data: as }] = await Promise.all([
      supabase.from("game_players").select("id, name, members, score, violations, locked").eq("game_id", initial.id).order("joined_at"),
      index >= 0
        ? supabase.from("game_answers").select("player_id, answer, correct, points").eq("game_id", initial.id).eq("idx", index)
        : Promise.resolve({ data: [] as Answer[] }),
    ]);
    if (ps) setPlayers(ps as Player[]);
    if (as) setAnswers(as as Answer[]);
  }, [supabase, initial.id, index]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, [refresh]);

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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao mudar a fase do jogo.");
      } finally {
        setBusy(false);
      }
    },
    [supabase, initial.id, index, notify],
  );

  const remaining = q ? remainingSeconds(startedAt, q.time_limit, offset, now) : 0;
  const active = players.filter((p) => !p.locked);
  const answeredIds = new Set(answers.map((a) => a.player_id));
  const allAnswered = active.length > 0 && active.every((p) => answeredIds.has(p.id));

  // tempo acabou ou todos responderam → mostra o resultado da questão
  useEffect(() => {
    if (status !== "question" || revealing.current) return;
    if (remaining <= 0 || allAnswered) {
      revealing.current = true;
      const t = setTimeout(() => go("reveal"), allAnswered && remaining > 0 ? 600 : 0);
      return () => clearTimeout(t);
    }
  }, [status, remaining, allAnswered, go]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of answers) {
      const k = q?.type === "numeric" ? String(Number(a.answer)) : (a.answer ?? "").toUpperCase();
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [answers, q?.type]);
  const hits = answers.filter((a) => a.correct).length;
  const misses = answers.length - hits;
  const locked = players.filter((p) => p.locked);
  const ranked = ranking(players);

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
      {/* barra do professor */}
      <header className="flex items-center gap-3 px-4 py-3 sm:px-8">
        <Link href="/jogos" className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20" title="Sair do telão">
          <ArrowLeft size={20} />
        </Link>
        <p className="min-w-0 flex-1 truncate text-[15px] font-bold text-white/90">{initial.title}</p>
        {status !== "lobby" && status !== "finished" && (
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-[14px] font-extrabold text-white">
            PIN {initial.pin}
          </span>
        )}
        <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[14px] font-bold text-white">
          <Users size={16} /> {players.length}
        </span>
        <button onClick={fullscreen} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20" title="Tela cheia">
          <Maximize size={18} />
        </button>
      </header>

      {error && <p className="mx-4 rounded-xl bg-red-600 px-4 py-2 text-center font-bold text-white sm:mx-8">{error}</p>}

      {locked.length > 0 && (
        <div className="mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-2xl bg-amber-400 px-4 py-2.5 text-amber-950 sm:mx-8">
          <Lock size={18} />
          <span className="font-extrabold">Saíram da tela do jogo:</span>
          {locked.map((p) => (
            <button
              key={p.id}
              onClick={async () => {
                await unlockPlayer(p.id);
                refresh();
              }}
              className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[14px] font-bold hover:bg-amber-50"
            >
              {p.name} <Unlock size={14} /> liberar
            </button>
          ))}
        </div>
      )}

      <main className="flex flex-1 flex-col px-4 pb-6 sm:px-8">
        {/* ---------- ENTRADA ---------- */}
        {status === "lobby" && (
          <div className="flex flex-1 flex-col items-center gap-6 pt-4 text-center text-white">
            <div className="rounded-3xl bg-white px-8 py-5 text-brand-900 shadow-2xl">
              <p className="text-[18px] font-bold text-violet-700">
                Abra <span className="underline">{joinUrl.replace(/^https?:\/\//, "").replace(/\/jogar$/, "")}</span>, toque em <strong>Aluno(a)</strong> e digite o PIN
              </p>
              <p className="mt-1 font-mono text-[72px] font-black leading-none tracking-[0.12em] text-violet-950 sm:text-[110px]">{initial.pin}</p>
            </div>
            <p className="text-[18px] font-bold text-white/80">
              {initial.team_size === 1 ? "Individual" : initial.team_size === 2 ? "Em duplas" : "Em trios"} · {initial.question_count} questões
            </p>
            <div className="flex max-w-5xl flex-wrap justify-center gap-3">
              {players.length === 0 && <p className="animate-pulse text-[20px] font-bold text-white/70">Esperando as equipes entrarem…</p>}
              {players.map((p, i) => (
                <span
                  key={p.id}
                  className="group flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[18px] font-extrabold text-white shadow-lg"
                  style={{ background: OPTION_STYLES[i % OPTION_STYLES.length].bg }}
                  title={p.members.join(", ")}
                >
                  {p.name}
                  <button
                    onClick={async () => {
                      await removePlayer(p.id);
                      refresh();
                    }}
                    className="hidden rounded-full bg-black/20 p-0.5 group-hover:block"
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
              className="mt-auto flex items-center gap-3 rounded-2xl bg-lime px-10 py-5 text-[24px] font-black text-brand-900 shadow-xl transition hover:scale-105 disabled:opacity-40"
            >
              <Play size={28} fill="currentColor" /> Começar
            </button>
          </div>
        )}

        {/* ---------- QUESTÃO ---------- */}
        {(status === "question" || status === "reveal") && q && (
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1 rounded-3xl bg-white p-5 text-[22px] font-bold leading-snug text-slate-900 shadow-xl sm:text-[28px]">
                <p className="mb-1 text-[14px] font-extrabold uppercase tracking-wider text-violet-600">
                  Questão {index + 1} de {questions.length}
                </p>
                <MathPreview text={q.statement} />
                {q.image_url && <img src={q.image_url} alt="" className="mx-auto mt-3 max-h-[28vh] rounded-xl" />}
              </div>
              <div className="flex shrink-0 flex-col items-center gap-2">
                {status === "question" ? (
                  <TimerRing seconds={remaining} total={q.time_limit} size={120} />
                ) : (
                  <div className="grid h-[120px] w-[120px] place-items-center rounded-full bg-white text-[18px] font-black text-violet-700">Fim!</div>
                )}
                <div className="rounded-2xl bg-white/15 px-4 py-2 text-center text-white">
                  <p className="text-[34px] font-black leading-none">{answers.length}</p>
                  <p className="text-[13px] font-bold text-white/80">de {active.length} responderam</p>
                </div>
              </div>
            </div>

            {q.type !== "numeric" ? (
              <div className={`grid gap-3 sm:grid-cols-2 ${status === "reveal" ? "" : "flex-1"}`}>
                {optionList.map((o, i) => {
                  const st = OPTION_STYLES[i % OPTION_STYLES.length];
                  const n = counts.get(o.label) ?? 0;
                  const right = correct.includes(o.label);
                  const dim = status === "reveal" && !right;
                  return (
                    <div
                      key={o.label}
                      className={`flex items-center gap-4 rounded-2xl px-5 text-white shadow-lg transition ${status === "reveal" ? "py-2" : "py-4"}`}
                      style={{ background: st.bg, opacity: dim ? 0.35 : 1 }}
                    >
                      <span className="text-[30px] leading-none">{st.shape}</span>
                      <span className={`flex min-w-0 flex-1 items-baseline gap-2 font-extrabold ${status === "reveal" ? "text-[18px]" : "text-[20px] sm:text-[24px]"}`}>
                        {q.type === "multiple_choice" && <span className="opacity-80">{o.label})</span>}
                        <MathPreview text={o.text} />
                      </span>
                      {status === "reveal" && right && <Check size={34} strokeWidth={4} />}
                      <span className="grid min-w-14 place-items-center rounded-xl bg-black/25 px-3 py-1.5 text-[28px] font-black tabular-nums">{n}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl bg-white/10 p-6 text-center text-white">
                <p className="text-[22px] font-extrabold">Tipo B · resposta numérica</p>
                {status === "reveal" && (
                  <p className="text-[40px] font-black">
                    Resposta: <span className="rounded-2xl bg-lime px-4 text-brand-900">{correct.join(" ou ")}</span>
                  </p>
                )}
              </div>
            )}

            {status === "reveal" && (
              <RevealChart
                q={q}
                optionList={optionList}
                counts={counts}
                correct={correct}
                hits={hits}
                misses={misses}
                noAnswer={Math.max(0, active.length - answers.length)}
              />
            )}

            <div className="flex justify-end gap-3">
              {status === "question" && (
                <button onClick={() => go("reveal")} disabled={busy} className="rounded-2xl bg-white/15 px-5 py-3 text-[16px] font-bold text-white hover:bg-white/25">
                  Encerrar a questão agora
                </button>
              )}
              {status === "reveal" && (
                <button onClick={() => go("ranking")} disabled={busy} className="flex items-center gap-2 rounded-2xl bg-lime px-7 py-4 text-[20px] font-black text-brand-900 shadow-xl hover:scale-105">
                  <Trophy size={24} /> Ver ranking
                </button>
              )}
            </div>
          </div>
        )}

        {/* ---------- RANKING ---------- */}
        {status === "ranking" && (
          <div className="flex flex-1 flex-col items-center gap-5 pt-2">
            <h2 className="text-[34px] font-black text-white drop-shadow">Ranking</h2>
            <ol className="w-full max-w-3xl space-y-2.5">
              {ranked.slice(0, 8).map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-4 rounded-2xl px-5 py-3.5 text-[22px] font-extrabold shadow-lg ${
                    p.position === 1 ? "bg-lime text-brand-900" : "bg-white text-slate-900"
                  }`}
                >
                  <span className="w-10 text-center text-[26px] font-black">{p.position}º</span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="tabular-nums">{p.score}</span>
                </li>
              ))}
            </ol>
            <button
              onClick={() => (index + 1 < questions.length ? go("question", index + 1) : go("finished"))}
              disabled={busy}
              className="mt-auto flex items-center gap-3 rounded-2xl bg-lime px-9 py-4 text-[22px] font-black text-brand-900 shadow-xl hover:scale-105"
            >
              {index + 1 < questions.length ? (
                <>
                  <SkipForward size={26} /> Próxima questão ({index + 2} de {questions.length})
                </>
              ) : (
                <>
                  <Trophy size={26} /> Ver o pódio
                </>
              )}
            </button>
          </div>
        )}

        {/* ---------- PÓDIO ---------- */}
        {status === "finished" && <Podium ranked={ranked} />}
      </main>
    </GameBackdrop>
  );
}

function RevealChart({
  q,
  optionList,
  counts,
  correct,
  hits,
  misses,
  noAnswer,
}: {
  q: GameQuestion;
  optionList: { label: string; text: string }[];
  counts: Map<string, number>;
  correct: string[];
  hits: number;
  misses: number;
  noAnswer: number;
}) {
  // Barras por alternativa (ou pelos números mais respondidos no Tipo B)
  const bars =
    q.type === "numeric"
      ? [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([label, n], i) => ({ label, n, right: correct.some((c) => Number(c) === Number(label)), color: OPTION_STYLES[i % 5].bg }))
      : optionList.map((o, i) => ({
          label: q.type === "true_false" ? TF_LABEL[o.label] : o.label,
          n: counts.get(o.label) ?? 0,
          right: correct.includes(o.label),
          color: OPTION_STYLES[i % 5].bg,
        }));
  const max = Math.max(1, ...bars.map((b) => b.n), hits, misses);

  return (
    <div className="grid items-center gap-4 rounded-3xl bg-white p-5 text-slate-900 shadow-xl md:grid-cols-[1fr_380px]">
      <div className="flex h-40 items-end justify-around gap-3">
        {bars.length === 0 && <p className="self-center font-bold text-slate-500">Ninguém respondeu.</p>}
        {bars.map((b) => (
          <div key={b.label} className="flex h-full w-full max-w-28 flex-col items-center justify-end gap-1">
            <span className="text-[22px] font-black tabular-nums">{b.n}</span>
            <div
              className="w-full rounded-t-xl transition-all duration-700"
              style={{ height: `${(b.n / max) * 100}%`, minHeight: 6, background: b.color, opacity: b.right ? 1 : 0.45 }}
            />
            <span className={`flex items-center gap-1 text-[16px] font-extrabold ${b.right ? "text-green-700" : "text-slate-600"}`}>
              {b.label} {b.right && <Check size={18} strokeWidth={4} />}
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-green-600 p-3 text-center text-white">
          <p className="text-[36px] font-black leading-none">{hits}</p>
          <p className="text-[14px] font-bold">acertaram</p>
        </div>
        <div className="rounded-2xl bg-red-600 p-3 text-center text-white">
          <p className="text-[36px] font-black leading-none">{misses}</p>
          <p className="text-[14px] font-bold">erraram</p>
        </div>
        <div className="rounded-2xl bg-slate-200 p-3 text-center text-slate-700">
          <p className="text-[36px] font-black leading-none">{noAnswer}</p>
          <p className="text-[14px] font-bold">sem resposta</p>
        </div>
      </div>
    </div>
  );
}

function Podium({ ranked }: { ranked: (Player & { position: number })[] }) {
  const top = ranked.slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const heights = ["h-40", "h-56", "h-28"];
  const medals = ["🥈", "🥇", "🥉"];
  return (
    <div className="flex flex-1 flex-col items-center gap-6 pt-2">
      <h2 className="text-[38px] font-black text-white drop-shadow">Pódio</h2>
      <div className="flex w-full max-w-4xl items-end justify-center gap-4">
        {order.map((p, i) =>
          p ? (
            <div key={p.id} className="flex w-1/3 max-w-60 flex-col items-center gap-2">
              <span className="text-[48px]">{medals[i]}</span>
              <p className="text-center text-[22px] font-black text-white">{p.name}</p>
              <p className="text-[18px] font-bold text-white/80">{p.score} pts</p>
              <div className={`w-full rounded-t-3xl ${heights[i]} grid place-items-center text-[44px] font-black text-white shadow-2xl`} style={{ background: OPTION_STYLES[i].bg }}>
                {p.position}º
              </div>
            </div>
          ) : (
            <div key={i} className="w-1/3" />
          ),
        )}
      </div>
      {ranked.length > 3 && (
        <ol className="w-full max-w-2xl space-y-1.5" start={4}>
          {ranked.slice(3).map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl bg-white/90 px-4 py-2 text-[17px] font-bold text-slate-900">
              <span className="w-8 text-center">{p.position}º</span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="tabular-nums">{p.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
