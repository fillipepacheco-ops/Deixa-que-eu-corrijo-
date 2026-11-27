"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, ImageUp, Loader2, RotateCcw, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { gradeSubmission, formatScore, UNCERTAIN, type AnswerKeyItem, type GivenAnswer, type GradeResult } from "@/lib/grading/grading";
import type { SheetQuestionSpec } from "@/lib/answer-sheet/layout";
import type { AnnulPolicy } from "@/lib/models/types";
import type { ReadResult } from "@/lib/omr/reader";
import { MARKED_MIN } from "@/lib/omr/reader";
import { buildProof } from "@/lib/correction/proof";
import { loadImage, readCanvas, toCanvas } from "@/lib/correction/capture";
import { saveCorrection } from "@/services/corrections";
import { answersToBase, keyForVersion, versionLabel } from "@/lib/versions/versions";

export interface StationStudent {
  id: string;
  name: string;
  roll_number: number | null;
}

interface Props {
  assessmentId: string;
  assessmentTitle: string;
  maxScore: number;
  annulPolicy: AnnulPolicy;
  answerKey: AnswerKeyItem[];
  specs: SheetQuestionSpec[];
  sheets: { sheet_number: number; student_id: string | null; version?: number | null }[];
  /** Versões A–D: ordem das questões de cada versão (posição da versão A por nº impresso). */
  versionOrders?: number[][] | null;
  students: StationStudent[];
  corrected: Record<string, number>; // aluno → nota já salva
  /** Logo da escola (link temporário) para o comprovante. */
  schoolLogoUrl?: string | null;
}

interface Shot {
  photo: HTMLCanvasElement;
  read: ReadResult;
  /** Versão da prova deste cartão (0 = A). */
  version: number;
  /** De onde veio a versão: pintada pelo aluno, do cartão impresso ou não identificada. */
  versionFrom: "marked" | "card" | "none";
}

type Banner =
  | { k: "saving"; name: string }
  | { k: "saved"; name: string; score: number; proof: string; shot: Shot }
  | { k: "already"; name: string; score: number; shot: Shot }
  | null;

const SCAN_EVERY_MS = 450;
const DETECT_SIDE = 900; // leitura rápida durante a busca
const PHOTO_SIDE = 1600; // foto guardada / leitura final
const SAME_CARD_MS = 6000; // o mesmo cartão só é lido de novo depois de sair da frente da câmera

function signal() {
  try {
    navigator.vibrate?.(80);
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.25);
    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch {
    /* sem som: tudo bem */
  }
}

function markedOf(r: ReadResult) {
  const m: Record<number, string[]> = {};
  for (const q of r.questions) m[q.number] = Object.entries(q.fills).filter(([, f]) => f >= MARKED_MIN).map(([l]) => l);
  return m;
}

export function CorrectionStation(props: Props) {
  const { answerKey, specs, students } = props;
  const video = useRef<HTMLVideoElement>(null);
  const work = useRef<HTMLCanvasElement | null>(null);
  const busyRef = useRef(false);
  const recent = useRef(new Map<number, number>()); // nº do cartão → última vez visto
  const [mode, setMode] = useState<"camera" | "review">("camera");
  const [review, setReview] = useState<Shot | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [cameraError, setCameraError] = useState("");
  const [hint, setHint] = useState("Aponte a câmera para o cartão-resposta inteiro, com os 4 quadrados pretos aparecendo.");
  const [found, setFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [corrected, setCorrected] = useState<Record<string, number>>(props.corrected);
  const correctedRef = useRef(corrected);
  correctedRef.current = corrected;

  // logo da escola para o comprovante (carregada uma vez; CORS liberado no Storage)
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!props.schoolLogoUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setLogo(img);
    img.src = props.schoolLogoUrl;
  }, [props.schoolLogoUrl]);

  // ---------- regras ----------
  const identify = useCallback(
    (r: ReadResult): { id: string; source: "" | "code" | "roll" | "other-assessment" } => {
      if (r.sheetNumber !== null) {
        const sheet = props.sheets.find((s) => s.sheet_number === r.sheetNumber);
        if (!sheet) return { id: "", source: "other-assessment" };
        if (sheet.student_id) return { id: sheet.student_id, source: "code" };
      }
      if (r.rollNumber !== null) {
        const st = students.find((s) => s.roll_number === r.rollNumber);
        if (st) return { id: st.id, source: "roll" };
      }
      return { id: "", source: "" };
    },
    [props.sheets, students],
  );

  // Versões: o cartão é lido na numeração da versão do aluno; a nota é salva na numeração da versão A.
  const orders = props.versionOrders && props.versionOrders.length > 1 ? props.versionOrders : null;
  const keyOf = useCallback((v: number) => (orders?.[v] ? keyForVersion(answerKey, orders[v]) : answerKey), [orders, answerKey]);
  const versionOfRead = useCallback(
    (r: ReadResult): { version: number; from: Shot["versionFrom"] } => {
      if (!orders) return { version: 0, from: "card" };
      // 1º: a letra que o aluno pintou no campo VERSÃO DA PROVA
      if (r.versionMark === "ok" && r.examVersion !== null && r.examVersion !== undefined && r.examVersion < orders.length) {
        return { version: r.examVersion, from: "marked" };
      }
      let sheet = r.sheetNumber !== null ? props.sheets.find((s) => s.sheet_number === r.sheetNumber) : undefined;
      if (!sheet && r.rollNumber !== null) {
        const st = students.find((s) => s.roll_number === r.rollNumber);
        sheet = st ? props.sheets.find((s) => s.student_id === st.id) : undefined;
      }
      const v = sheet?.version ?? 0;
      return { version: v >= 0 && v < orders.length ? v : 0, from: sheet ? "card" : "none" };
    },
    [orders, props.sheets, students],
  );

  const gradeOf = useCallback(
    (answers: Record<number, GivenAnswer>, version = 0) =>
      gradeSubmission(keyOf(version), answers, { maxScore: props.maxScore, annulPolicy: props.annulPolicy }),
    [keyOf, props.maxScore, props.annulPolicy],
  );

  const proofOf = useCallback(
    (shot: Shot, answers: Record<number, GivenAnswer>, grade: GradeResult, studentName: string) =>
      buildProof({
        photo: shot.photo,
        homography: shot.read.homography!,
        specs,
        key: keyOf(shot.version),
        answers,
        marked: markedOf(shot.read),
        grade,
        studentName,
        assessmentTitle: props.assessmentTitle,
        when: new Date(),
        logo,
      }).toDataURL("image/jpeg", 0.85),
    [specs, keyOf, props.assessmentTitle, logo],
  );

  /** Envia o comprovante e grava a nota no banco. Devolve a nota salva. */
  const persist = useCallback(
    async (shot: Shot, student: StationStudent, answers: Record<number, GivenAnswer>, proof: string) => {
      const blob = await (await fetch(proof)).blob();
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada. Entre de novo.");
      const path = `${user.id}/${props.assessmentId}/${student.id}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("answer-sheet-photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw new Error(error.message);
      const order = orders?.[shot.version];
      const base = order ? answersToBase(answers, order) : answers;
      const res = await saveCorrection(props.assessmentId, {
        studentId: student.id,
        sheetNumber: shot.read.sheetNumber,
        answers: Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v ?? null])),
        readDetails: shot.read.questions.map((q) => ({ n: order?.[q.number - 1] ?? q.number, printed: q.number, version: shot.version, fills: q.fills, conf: q.confidence })),
        imagePath: path,
      });
      if (!res.ok) throw new Error(res.error);
      setCorrected((c) => ({ ...c, [student.id]: res.score }));
      return res.score;
    },
    [props.assessmentId, orders],
  );

  /**
   * Leitura segura (aluno identificado, nenhuma dúvida, ainda não corrigido)
   * → salva sozinho e a câmera continua pronta para o próximo.
   * Qualquer dúvida → tela de confirmação.
   */
  const handleShot = useCallback(
    async (shot: Shot) => {
      setSaveError("");
      const ident = identify(shot.read);
      const answers = { ...shot.read.answers };
      const grade = gradeOf(answers, shot.version);
      const student = students.find((s) => s.id === ident.id);
      // prova com versões e o aluno não pintou (ou pintou duas) a VERSÃO DA PROVA: o professor confirma
      const versionDoubt = !!orders && shot.versionFrom !== "marked";
      if (!student || grade.needsReview || ident.source === "other-assessment" || versionDoubt) {
        setBanner(null);
        setReview(shot);
        setMode("review");
        return;
      }
      const before = correctedRef.current[student.id];
      if (before !== undefined) {
        setBanner({ k: "already", name: student.name, score: before, shot });
        return;
      }
      setBanner({ k: "saving", name: student.name });
      try {
        const proof = proofOf(shot, answers, grade, student.name);
        const score = await persist(shot, student, answers, proof);
        signal();
        setBanner({ k: "saved", name: student.name, score, proof, shot });
      } catch (e) {
        setBanner(null);
        setSaveError(e instanceof Error ? e.message : "Não foi possível salvar.");
        setReview(shot);
        setMode("review");
      }
    },
    [identify, gradeOf, students, proofOf, persist],
  );

  // ---------- câmera ----------
  useEffect(() => {
    if (mode !== "camera") return;
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (stop) return stream.getTracks().forEach((t) => t.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => {});
        }
        setCameraError("");
      } catch {
        setCameraError("Não foi possível abrir a câmera. Libere o acesso à câmera para este site ou use “Escolher foto”.");
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [mode]);

  const capture = useCallback(
    (source: HTMLVideoElement | HTMLImageElement): Shot | null => {
      const photo = toCanvas(source, PHOTO_SIDE);
      const read = readCanvas(photo, specs, orders?.length ?? 1);
      if (!read.ok || !read.homography) return null;
      if (read.sheetNumber !== null) recent.current.set(read.sheetNumber, Date.now());
      const v = versionOfRead(read);
      return { photo, read, version: v.version, versionFrom: v.from };
    },
    [specs, versionOfRead, orders],
  );

  // leitura automática contínua
  useEffect(() => {
    if (mode !== "camera") return;
    let hits = 0;
    const timer = setInterval(async () => {
      const v = video.current;
      if (busyRef.current || !v || v.readyState < 2 || !v.videoWidth) return;
      work.current = toCanvas(v, DETECT_SIDE, work.current ?? undefined);
      const r = readCanvas(work.current, specs);
      setFound(r.ok);
      if (!r.ok) {
        hits = 0;
        setHint("Procurando o cartão… enquadre os 4 quadrados pretos dos cantos.");
        return;
      }
      if (r.sheetNumber === null && r.rollNumber === null) {
        hits = 0;
        setHint("Cartão encontrado. Aproxime um pouco para ler o código do topo.");
        return;
      }
      if (r.sheetNumber !== null) {
        const last = recent.current.get(r.sheetNumber);
        if (last && Date.now() - last < SAME_CARD_MS) {
          // o cartão que acabou de ser lido continua na frente: não lê de novo
          recent.current.set(r.sheetNumber, Date.now());
          hits = 0;
          setHint("Cartão já lido. Tire-o e coloque o próximo.");
          return;
        }
      }
      hits++;
      setHint("Cartão encontrado! Segure firme…");
      if (hits < 2) return;
      hits = 0;
      busyRef.current = true;
      try {
        const shot = capture(v);
        if (shot) await handleShot(shot);
      } finally {
        busyRef.current = false;
      }
    }, SCAN_EVERY_MS);
    return () => clearInterval(timer);
  }, [mode, specs, capture, handleShot]);

  async function manualShot(source: HTMLVideoElement | HTMLImageElement) {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const shot = capture(source);
      if (!shot) {
        setHint("Não encontrei os 4 quadrados pretos. Enquadre o cartão inteiro, com boa luz.");
        return;
      }
      await handleShot(shot);
    } finally {
      busyRef.current = false;
    }
  }

  async function fromGallery(file: File | undefined) {
    if (!file) return;
    try {
      await manualShot(await loadImage(file));
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Foto inválida.");
    }
  }

  // ---------- confirmação (só quando há dúvida) ----------
  const ident = useMemo(() => (review ? identify(review.read) : { id: "", source: "" as const }), [review, identify]);
  const [studentId, setStudentId] = useState("");
  const [answers, setAnswers] = useState<Record<number, GivenAnswer>>({});
  // só quando chega uma foto nova (trocar a versão não apaga o aluno escolhido)
  const reviewRead = review?.read;
  useEffect(() => {
    if (!reviewRead) return;
    setStudentId(ident.id);
    setAnswers({ ...reviewRead.answers });
  }, [reviewRead, ident.id]);
  const grade = useMemo(() => gradeOf(answers, review?.version ?? 0), [gradeOf, answers, review]);
  const student = students.find((s) => s.id === studentId);
  const proofUrl = useMemo(
    () => (review?.read.homography ? proofOf(review, answers, grade, student?.name ?? "") : ""),
    [review, answers, grade, student, proofOf],
  );
  const uncertain = grade.questions.filter((q) => q.status === "uncertain");

  async function saveReview() {
    if (!review || !student) return;
    setBusy(true);
    setSaveError("");
    try {
      const score = await persist(review, student, answers, proofUrl);
      signal();
      setBanner({ k: "saved", name: student.name, score, proof: proofUrl, shot: review });
      setReview(null);
      setMode("camera");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  function openReview(shot: Shot) {
    setBanner(null);
    setSaveError("");
    setReview(shot);
    setMode("review");
  }

  const done = Object.keys(corrected).length;

  if (mode === "review" && review) {
    const r = review.read;
    const already = studentId && corrected[studentId] !== undefined;
    return (
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          {proofUrl ? <img src={proofUrl} alt="Cartão corrigido" className="block w-full" /> : <p className="p-6 text-sm text-muted">Montando a correção…</p>}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl bg-brand-900 p-5 text-white">
            <p className="text-[12px] font-bold uppercase tracking-wider text-lime">Nota</p>
            <p className="text-5xl font-extrabold tabular-nums">
              {formatScore(grade.score)} <span className="text-lg font-semibold text-brand-100/70">/ {formatScore(grade.maxScore)}</span>
            </p>
            <p className="mt-1 text-[13px] text-brand-100/85">
              <span className="font-bold text-green-300">{grade.correctCount} certas</span> · <span className="font-bold text-red-300">{grade.wrongCount} erradas</span> ·{" "}
              {grade.blankCount} em branco
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4">
            <label className="label">Aluno</label>
            <select className="field" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Selecione o aluno…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.roll_number ? `${s.roll_number}. ` : ""}
                  {s.name}
                  {corrected[s.id] !== undefined ? " ✓" : ""}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[12px] text-muted">
              {ident.source === "code" && "Identificado pelo código do cartão."}
              {ident.source === "roll" && `Identificado pelo nº de chamada (${r.rollNumber}).`}
              {ident.source === "other-assessment" && <span className="font-semibold text-red-700">Atenção: este cartão é de outra avaliação.</span>}
              {ident.source === "" && "Não foi possível identificar o aluno pelo cartão. Escolha na lista."}
            </p>
            {already && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                Este aluno já tem correção (nota {formatScore(corrected[studentId])}). Salvar vai substituir.
              </p>
            )}
          </div>

          {uncertain.length > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-[13px] font-bold text-amber-900">Confirme {uncertain.length === 1 ? "a questão" : "as questões"} abaixo:</p>
              {uncertain.map((q) => {
                const spec = specs.find((s) => s.number === q.number);
                return (
                  <div key={q.number} className="mt-3">
                    <p className="text-[13px] text-amber-900">Não foi possível identificar com segurança a questão {q.number}.</p>
                    {spec?.numeric ? (
                      <NumericFix onSet={(v) => setAnswers((a) => ({ ...a, [q.number]: v }))} />
                    ) : (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {[...(spec?.labels ?? []), "Em branco"].map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setAnswers((a) => ({ ...a, [q.number]: l === "Em branco" ? null : l }))}
                          className="min-w-11 rounded-lg border border-amber-300 bg-white px-3 py-2 text-[14px] font-bold text-amber-900 active:scale-95"
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {orders && review && (
            <div className={`rounded-2xl p-4 ${review.versionFrom === "marked" ? "bg-brand-50" : "border border-amber-300 bg-amber-50"}`}>
              <p className={`text-[13px] font-bold ${review.versionFrom === "marked" ? "text-brand-900" : "text-amber-900"}`}>
                {review.versionFrom === "marked"
                  ? `Versão da prova: ${versionLabel(review.version)} (pintada pelo aluno)`
                  : review.read.versionMark === "multiple"
                    ? "O aluno pintou mais de uma VERSÃO DA PROVA. Qual ele fez?"
                    : "O aluno não pintou a VERSÃO DA PROVA. Confira na capa da prova dele:"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {orders.map((_, v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setReview({ ...review, version: v, versionFrom: "marked" })}
                    className={`h-10 w-10 rounded-full text-[15px] font-extrabold ${review.version === v ? "bg-brand-900 text-white" : "border border-line bg-white text-brand-900"}`}
                  >
                    {versionLabel(v)}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-muted">As respostas abaixo seguem a numeração dessa versão.</p>
            </div>
          )}
          <QuestionGrid grade={grade} specs={specs} answerKey={keyOf(review?.version ?? 0)} />

          {r.problems
            .filter((p) => !p.startsWith("Não foi possível identificar com segurança"))
            .map((p) => (
              <p key={p} className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                {p}
              </p>
            ))}
          {saveError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{saveError}</p>}

          <button
            onClick={saveReview}
            disabled={busy || !student || uncertain.length > 0 || ident.source === "other-assessment"}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-900 px-4 py-3.5 text-[15px] font-bold text-white disabled:opacity-50 active:scale-[0.98]"
          >
            {busy ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {busy ? "Salvando…" : !student ? "Escolha o aluno para salvar" : uncertain.length ? "Confirme as questões em amarelo" : "Salvar correção"}
          </button>
          <button
            onClick={() => {
              setReview(null);
              setSaveError("");
              setMode("camera");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-[14px] font-semibold text-brand-900"
          >
            <RotateCcw size={18} /> Voltar para a câmera
          </button>
        </aside>
      </div>
    );
  }

  // câmera
  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative overflow-hidden rounded-3xl bg-black">
        <video ref={video} playsInline muted autoPlay className="block aspect-[3/4] w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={`relative aspect-[210/297] h-[88%] rounded-xl border-2 ${found ? "border-green-400" : "border-white/70"} transition-colors`}>
            {["left-1 top-1", "right-1 top-1", "left-1 bottom-1", "right-1 bottom-1"].map((pos) => (
              <span key={pos} className={`absolute ${pos} h-5 w-5 rounded-sm ${found ? "bg-green-400" : "bg-white/80"}`} />
            ))}
          </div>
        </div>

        {banner && (
          <div
            className={`absolute inset-x-3 top-3 rounded-2xl px-4 py-3 shadow-lg ${
              banner.k === "saved" ? "bg-green-600 text-white" : banner.k === "already" ? "bg-amber-500 text-white" : "bg-white/95 text-brand-900"
            }`}
          >
            {banner.k === "saving" && (
              <p className="flex items-center gap-2 text-[15px] font-bold">
                <Loader2 size={20} className="animate-spin" /> Corrigindo e salvando — {banner.name}…
              </p>
            )}
            {banner.k === "saved" && (
              <div className="flex items-center gap-3">
                <img src={banner.proof} alt="" className="h-16 w-12 shrink-0 rounded-md bg-white object-cover object-top" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold opacity-90">
                    <CheckCircle2 size={16} /> Gabarito corrigido e salvo
                  </p>
                  <p className="truncate text-[17px] font-extrabold">{banner.name}</p>
                  <p className="text-[13px] font-semibold">Pode ler o próximo cartão</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase opacity-80">Nota</p>
                  <p className="text-3xl font-extrabold tabular-nums">{formatScore(banner.score)}</p>
                </div>
              </div>
            )}
            {banner.k === "already" && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-extrabold">{banner.name} já foi corrigido(a)</p>
                  <p className="text-[13px] font-semibold">Nota {formatScore(banner.score)} · pode ler o próximo</p>
                </div>
                <button type="button" onClick={() => openReview(banner.shot)} className="shrink-0 rounded-lg bg-white px-3 py-2 text-[13px] font-bold text-amber-700">
                  Corrigir de novo
                </button>
              </div>
            )}
          </div>
        )}

        <p className="absolute inset-x-3 bottom-3 rounded-xl bg-black/60 px-3 py-2 text-center text-[13px] font-semibold text-white backdrop-blur">{hint}</p>
      </div>
      {cameraError && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{cameraError}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => video.current && manualShot(video.current)}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand-900 px-4 py-3.5 text-[15px] font-bold text-white active:scale-[0.98]"
        >
          <Camera size={20} /> Fotografar agora
        </button>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-3.5 text-[15px] font-semibold text-brand-900 active:scale-[0.98]">
          <ImageUp size={20} /> Escolher foto
          <input type="file" accept="image/*" className="hidden" onChange={(e) => fromGallery(e.target.files?.[0])} />
        </label>
      </div>
      {banner?.k === "saved" && (
        <button type="button" onClick={() => openReview(banner.shot)} className="mt-3 w-full text-center text-[13px] font-semibold text-brand-700 underline">
          Algo errado na última correção? Revisar
        </button>
      )}
      <p className="mt-3 text-center text-[13px] text-muted">
        Quando a leitura é segura, o app corrige e salva sozinho. Se houver dúvida, ele pede sua confirmação. ·{" "}
        <strong>
          {done} de {students.length} corrigidos
        </strong>
      </p>
    </div>
  );
}

function QuestionGrid({ grade, specs, answerKey }: { grade: GradeResult; specs: SheetQuestionSpec[]; answerKey: AnswerKeyItem[] }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="mb-2 text-[13px] font-bold text-brand-900">Questão por questão</p>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6 lg:grid-cols-5">
        {grade.questions
          .filter((q) => specs.some((s) => s.number === q.number))
          .map((q) => {
            const cls =
              q.status === "correct"
                ? "bg-green-100 text-green-800 border-green-300"
                : q.status === "uncertain"
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : q.status === "annulled"
                    ? "bg-gray-100 text-gray-500 border-gray-200"
                    : "bg-red-100 text-red-800 border-red-300";
            const k = answerKey.find((x) => x.number === q.number);
            const given = q.given === null || q.given === undefined ? "–" : q.given === UNCERTAIN ? "?" : q.given === "*" ? "2+" : q.given;
            return (
              <div key={q.number} className={`rounded-lg border px-1 py-1 text-center ${cls}`} title={`Gabarito: ${k?.accepted.join("/") || "—"}`}>
                <p className="text-[10px] font-semibold opacity-70">{String(q.number).padStart(2, "0")}</p>
                <p className="text-[14px] font-extrabold">{given}</p>
              </div>
            );
          })}
      </div>
      <p className="mt-2 text-[11px] text-muted">Verde: certa · Vermelho: errada ou em branco (na foto, o contorno tracejado verde mostra a resposta certa).</p>
    </div>
  );
}

/** Tipo B com leitura duvidosa: o professor digita o número que o aluno marcou. */
function NumericFix({ onSet }: { onSet: (v: string | null) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <input
        inputMode="numeric"
        maxLength={3}
        value={v}
        onChange={(e) => setV(e.target.value.replace(/\D/g, ""))}
        placeholder="Ex.: 042"
        className="w-24 rounded-lg border border-amber-300 bg-white px-3 py-2 text-[16px] font-bold text-amber-900"
      />
      <button
        type="button"
        disabled={!v}
        onClick={() => onSet(v.padStart(3, "0"))}
        className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-[14px] font-bold text-amber-900 disabled:opacity-50"
      >
        Confirmar
      </button>
      <button type="button" onClick={() => onSet(null)} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-[14px] font-bold text-amber-900">
        Em branco
      </button>
    </div>
  );
}
