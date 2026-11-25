"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, ImageUp, Loader2, RotateCcw, Save, ScanLine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { gradeSubmission, formatScore, UNCERTAIN, type AnswerKeyItem, type GivenAnswer } from "@/lib/grading/grading";
import type { SheetQuestionSpec } from "@/lib/answer-sheet/layout";
import type { AnnulPolicy } from "@/lib/models/types";
import type { ReadResult } from "@/lib/omr/reader";
import { MARKED_MIN } from "@/lib/omr/reader";
import { buildProof } from "@/lib/correction/proof";
import { loadImage, readCanvas, toCanvas } from "@/lib/correction/capture";
import { saveCorrection } from "@/services/corrections";

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
  sheets: { sheet_number: number; student_id: string | null }[];
  students: StationStudent[];
  corrected: Record<string, number>; // aluno → nota já salva
}

type Phase =
  | { k: "camera" }
  | { k: "result"; photo: HTMLCanvasElement; read: ReadResult }
  | { k: "saved"; name: string; score: number };

const SCAN_EVERY_MS = 450;
const DETECT_SIDE = 900; // leitura rápida durante a busca
const PHOTO_SIDE = 1600; // foto guardada / leitura final

export function CorrectionStation(props: Props) {
  const { answerKey, specs, students } = props;
  const video = useRef<HTMLVideoElement>(null);
  const work = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<Phase>({ k: "camera" });
  const [cameraError, setCameraError] = useState("");
  const [hint, setHint] = useState("Aponte a câmera para o cartão-resposta inteiro, com os 4 quadrados pretos aparecendo.");
  const [found, setFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [corrected, setCorrected] = useState<Record<string, number>>(props.corrected);

  // ---------- câmera ----------
  useEffect(() => {
    if (phase.k !== "camera") return;
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
  }, [phase.k]);

  const handleShot = useCallback(
    (source: HTMLVideoElement | HTMLImageElement) => {
      const photo = toCanvas(source, PHOTO_SIDE);
      const read = readCanvas(photo, specs);
      if (!read.ok) {
        setHint(read.error ?? "Não encontrei o cartão. Tente de novo.");
        return false;
      }
      setSaveError("");
      setPhase({ k: "result", photo, read });
      return true;
    },
    [specs],
  );

  // leitura automática: quando o cartão é encontrado em 2 quadros seguidos, fotografa
  useEffect(() => {
    if (phase.k !== "camera") return;
    let hits = 0;
    const timer = setInterval(() => {
      const v = video.current;
      if (!v || v.readyState < 2 || !v.videoWidth) return;
      work.current = toCanvas(v, DETECT_SIDE, work.current ?? undefined);
      const r = readCanvas(work.current, specs);
      const good = r.ok && (r.sheetNumber !== null || r.rollNumber !== null);
      setFound(r.ok);
      if (!r.ok) {
        hits = 0;
        setHint("Procurando o cartão… enquadre os 4 quadrados pretos dos cantos.");
        return;
      }
      if (!good) {
        hits = 0;
        setHint("Cartão encontrado. Aproxime um pouco para ler o código do topo.");
        return;
      }
      hits++;
      setHint("Cartão encontrado! Segure firme…");
      if (hits >= 2) handleShot(v);
    }, SCAN_EVERY_MS);
    return () => clearInterval(timer);
  }, [phase.k, specs, handleShot]);

  async function fromGallery(file: File | undefined) {
    if (!file) return;
    try {
      const img = await loadImage(file);
      if (!handleShot(img)) setHint("Não encontrei os 4 quadrados pretos nessa foto. Tire outra com o cartão inteiro.");
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Foto inválida.");
    }
  }

  // ---------- resultado ----------
  const result = phase.k === "result" ? phase : null;
  const sheetStudent = useMemo(() => {
    if (!result) return { id: "", source: "" };
    const r = result.read;
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
  }, [result, props.sheets, students]);

  const [studentId, setStudentId] = useState("");
  const [answers, setAnswers] = useState<Record<number, GivenAnswer>>({});
  useEffect(() => {
    if (!result) return;
    setStudentId(sheetStudent.id);
    setAnswers({ ...result.read.answers });
  }, [result, sheetStudent.id]);

  const grade = useMemo(
    () => gradeSubmission(answerKey, answers, { maxScore: props.maxScore, annulPolicy: props.annulPolicy }),
    [answerKey, answers, props.maxScore, props.annulPolicy],
  );

  const marked = useMemo(() => {
    const m: Record<number, string[]> = {};
    for (const q of result?.read.questions ?? []) m[q.number] = Object.entries(q.fills).filter(([, f]) => f >= MARKED_MIN).map(([l]) => l);
    return m;
  }, [result]);

  const student = students.find((s) => s.id === studentId);
  const proofUrl = useMemo(() => {
    if (!result?.read.homography) return "";
    const c = buildProof({
      photo: result.photo,
      homography: result.read.homography,
      specs,
      key: answerKey,
      answers,
      marked,
      grade,
      studentName: student?.name ?? "",
      assessmentTitle: props.assessmentTitle,
      when: new Date(),
    });
    return c.toDataURL("image/jpeg", 0.85);
  }, [result, answers, grade, marked, student, specs, answerKey, props.assessmentTitle]);

  const uncertain = grade.questions.filter((q) => q.status === "uncertain");

  async function save() {
    if (!result || !student) return;
    setBusy(true);
    setSaveError("");
    try {
      const blob = await (await fetch(proofUrl)).blob();
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada. Entre de novo.");
      const path = `${user.id}/${props.assessmentId}/${student.id}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("answer-sheet-photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw new Error(error.message);
      const res = await saveCorrection(props.assessmentId, {
        studentId: student.id,
        sheetNumber: result.read.sheetNumber,
        answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v ?? null])),
        readDetails: result.read.questions.map((q) => ({ n: q.number, fills: q.fills, conf: q.confidence })),
        imagePath: path,
      });
      if (!res.ok) throw new Error(res.error);
      setCorrected((c) => ({ ...c, [student.id]: res.score }));
      setPhase({ k: "saved", name: student.name, score: res.score });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  const done = Object.keys(corrected).length;

  // ---------- telas ----------
  if (phase.k === "saved") {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-line bg-white p-8 text-center">
        <CheckCircle2 size={56} className="mx-auto text-brand-500" />
        <p className="mt-3 text-[15px] font-semibold text-muted">Correção salva com comprovante</p>
        <p className="mt-1 text-2xl font-extrabold text-brand-900">{phase.name}</p>
        <p className="mt-3 text-5xl font-extrabold tabular-nums text-brand-900">{formatScore(phase.score)}</p>
        <p className="mt-4 text-[13px] text-muted">
          {done} de {students.length} alunos corrigidos
        </p>
        <button onClick={() => setPhase({ k: "camera" })} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-900 px-4 py-3.5 text-[15px] font-bold text-white active:scale-[0.98]">
          <ScanLine size={20} /> Próximo cartão
        </button>
      </div>
    );
  }

  if (result) {
    const r = result.read;
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
              {sheetStudent.source === "code" && "Identificado pelo código do cartão."}
              {sheetStudent.source === "roll" && `Identificado pelo nº de chamada (${r.rollNumber}).`}
              {sheetStudent.source === "other-assessment" && <span className="font-semibold text-red-700">Atenção: este cartão é de outra avaliação.</span>}
              {sheetStudent.source === "" && "Não foi possível identificar o aluno pelo cartão. Escolha na lista."}
            </p>
            {already && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">Este aluno já tem correção (nota {formatScore(corrected[studentId])}). Salvar vai substituir.</p>}
          </div>

          {uncertain.length > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-[13px] font-bold text-amber-900">Confirme {uncertain.length === 1 ? "a questão" : "as questões"} abaixo:</p>
              {uncertain.map((q) => {
                const spec = specs.find((s) => s.number === q.number);
                return (
                  <div key={q.number} className="mt-3">
                    <p className="text-[13px] text-amber-900">Não foi possível identificar com segurança a questão {q.number}.</p>
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
                  </div>
                );
              })}
            </div>
          )}

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

          {r.problems.filter((p) => !p.startsWith("Não foi possível identificar com segurança")).map((p) => (
            <p key={p} className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">{p}</p>
          ))}
          {saveError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{saveError}</p>}

          <button
            onClick={save}
            disabled={busy || !student || uncertain.length > 0 || sheetStudent.source === "other-assessment"}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-900 px-4 py-3.5 text-[15px] font-bold text-white disabled:opacity-50 active:scale-[0.98]"
          >
            {busy ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {busy ? "Salvando…" : !student ? "Escolha o aluno para salvar" : uncertain.length ? "Confirme as questões em amarelo" : "Salvar correção"}
          </button>
          <button
            onClick={() => setPhase({ k: "camera" })}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-[14px] font-semibold text-brand-900"
          >
            <RotateCcw size={18} /> Fotografar de novo
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
        {/* guia de enquadramento */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={`relative aspect-[210/297] h-[88%] rounded-xl border-2 ${found ? "border-green-400" : "border-white/70"} transition-colors`}>
            {["left-1 top-1", "right-1 top-1", "left-1 bottom-1", "right-1 bottom-1"].map((pos) => (
              <span key={pos} className={`absolute ${pos} h-5 w-5 rounded-sm ${found ? "bg-green-400" : "bg-white/80"}`} />
            ))}
          </div>
        </div>
        <p className="absolute inset-x-3 bottom-3 rounded-xl bg-black/60 px-3 py-2 text-center text-[13px] font-semibold text-white backdrop-blur">{hint}</p>
      </div>
      {cameraError && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{cameraError}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => video.current && !handleShot(video.current) && setHint("Não encontrei os 4 quadrados pretos. Enquadre o cartão inteiro.")}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand-900 px-4 py-3.5 text-[15px] font-bold text-white active:scale-[0.98]"
        >
          <Camera size={20} /> Fotografar agora
        </button>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-3.5 text-[15px] font-semibold text-brand-900 active:scale-[0.98]">
          <ImageUp size={20} /> Escolher foto
          <input type="file" accept="image/*" className="hidden" onChange={(e) => fromGallery(e.target.files?.[0])} />
        </label>
      </div>
      <p className="mt-3 text-center text-[13px] text-muted">
        A leitura é automática: quando o cartão aparece inteiro, o app fotografa sozinho. · {done} de {students.length} corrigidos
      </p>
    </div>
  );
}
