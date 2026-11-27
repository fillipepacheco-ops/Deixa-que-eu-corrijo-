"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileUp, ImageIcon, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseExam, type ImportedQuestion } from "@/lib/import/parse-questions";
import { QUESTION_TYPE_NAMES } from "@/lib/assessment/question-form";
import { loadPdfJs } from "@/components/viewer/render-pdf";
import { toJpeg } from "@/components/upload/resize";
import { MathPreview } from "@/components/math/MathPreview";
import { appendImportedQuestions } from "@/services/assessments";

interface Item extends ImportedQuestion {
  image_path: string | null;
  preview: string | null;
}

type Status = { s: "idle" } | { s: "busy"; msg: string } | { s: "done" } | { s: "error"; msg: string };

/**
 * Importar a prova de um PDF ou Word: lê o arquivo no próprio aparelho,
 * mostra as questões encontradas e, depois de conferir, salva.
 *  mode "new"    → fica dentro do formulário de nova avaliação (campo oculto "imported")
 *  mode "append" → botão para acrescentar numa avaliação existente
 */
export function ImportExam({
  mode,
  assessmentId,
  imageFolder,
  appendAction,
  doneHref,
}: {
  mode: "new" | "append";
  assessmentId?: string;
  /** Subpasta das imagens no Storage (ex.: Prova Multi). */
  imageFolder?: string;
  /** Outra ação para gravar as questões (ex.: Prova Multi). */
  appendAction?: (imported: unknown) => Promise<{ error?: string; ok?: boolean }>;
  doneHref?: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<Status>({ s: "idle" });
  const [saveError, setSaveError] = useState("");
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function read(file: File) {
    setStatus({ s: "busy", msg: "Lendo o arquivo…" });
    setItems([]);
    setWarnings([]);
    setSaveError("");
    setFileName(file.name);
    try {
      const name = file.name.toLowerCase();
      const data = await file.arrayBuffer();
      const notes: string[] = [];
      let images = new Map<string, Blob>();
      let blocks;
      if (name.endsWith(".pdf") || file.type === "application/pdf") {
        const pdfjs = await loadPdfJs(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString());
        const { extractPdf } = await import("@/lib/import/pdf-extract");
        blocks = await extractPdf(pdfjs, data);
        if (!blocks.length) throw new Error("Este PDF parece ser uma foto/digitalização: não tem texto para ler. Se tiver o arquivo em Word, use ele.");
        notes.push("Do PDF vem só o texto: imagens, gráficos e frações empilhadas precisam ser conferidos e adicionados no editor. Se tiver a prova em Word, a importação fica mais completa.");
      } else if (name.endsWith(".docx")) {
        const { extractDocx } = await import("@/lib/import/docx-extract");
        const r = await extractDocx(data);
        blocks = r.blocks;
        images = r.images;
      } else if (name.endsWith(".doc")) {
        throw new Error("Arquivo .doc (Word antigo): abra no Word e use “Salvar como” → .docx. Depois importe de novo.");
      } else {
        throw new Error("Escolha um arquivo PDF ou Word (.docx).");
      }

      const parsed = parseExam(blocks);
      if (!parsed.questions.length) throw new Error(parsed.warnings[0] ?? "Não encontrei questões no arquivo.");

      // imagens do Word: a primeira de cada questão vai junto
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const list: Item[] = [];
      let n = 0;
      const withImage = parsed.questions.filter((q) => q.images.some((i) => images.has(i))).length;
      for (const q of parsed.questions) {
        const item: Item = { ...q, image_path: null, preview: null };
        const imgs = q.images.filter((i) => images.has(i));
        if (imgs.length && user) {
          n++;
          setStatus({ s: "busy", msg: `Enviando imagens… ${n} de ${withImage}` });
          try {
            const jpeg = await toJpeg(images.get(imgs[0])!, 1600, 0.9);
            const path = `${user.id}/${imageFolder ? `${imageFolder}/` : ""}importada-${Date.now()}-${q.number}.jpg`;
            const { error } = await supabase.storage.from("question-images").upload(path, jpeg, { contentType: "image/jpeg" });
            if (error) throw error;
            item.image_path = path;
            item.preview = URL.createObjectURL(jpeg);
          } catch {
            notes.push(`Questão ${q.number}: não consegui trazer a imagem — adicione pelo editor.`);
          }
          if (imgs.length > 1) notes.push(`Questão ${q.number}: tinha ${imgs.length} imagens; veio só a primeira.`);
        }
        list.push(item);
      }
      setItems(list);
      setWarnings([...parsed.warnings, ...notes]);
      setStatus({ s: "done" });

      if (mode === "new") {
        const title = document.getElementById("title") as HTMLInputElement | null;
        if (title && !title.value.trim()) title.value = file.name.replace(/\.(pdf|docx?)$/i, "").replace(/[_-]+/g, " ").trim();
      }
    } catch (e) {
      setStatus({ s: "error", msg: e instanceof Error ? e.message : "Não foi possível ler o arquivo." });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  const payload = JSON.stringify(
    items.map((q) => ({ type: q.type, statement: q.statement, options: q.options, correct_answers: q.correct_answers, image_path: q.image_path })),
  );
  const objective = items.filter((q) => q.type === "multiple_choice" || q.type === "true_false");
  const withAnswer = objective.filter((q) => q.correct_answers.length).length;

  function append() {
    setSaveError("");
    start(async () => {
      const r = appendAction ? await appendAction(JSON.parse(payload)) : await appendImportedQuestions(assessmentId!, JSON.parse(payload));
      if (r.error) setSaveError(r.error);
      else if (appendAction) {
        setItems([]);
        setStatus({ s: "idle" });
        if (doneHref) router.push(doneHref);
        router.refresh();
      } else router.push(`/avaliacoes/${assessmentId}`);
    });
  }

  return (
    <div className="space-y-4">
      {mode === "new" && <input type="hidden" name="imported" value={payload} />}

      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={status.s === "busy"}
        className="flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/60 p-5 text-left transition hover:border-brand-500 active:scale-[0.99] disabled:opacity-70"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-brand-700 to-brand-900 text-white">
          {status.s === "busy" ? <Loader2 size={26} className="animate-spin" /> : <FileUp size={26} />}
        </span>
        <span className="min-w-0">
          <span className="block text-[16px] font-extrabold text-brand-900">
            {status.s === "busy" ? status.msg : fileName ? "Escolher outro arquivo" : "Escolher a prova (PDF ou Word)"}
          </span>
          <span className="block truncate text-[13px] text-muted">
            {fileName && status.s !== "busy" ? fileName : "O app separa as questões, as alternativas e o gabarito (se estiver no arquivo)."}
          </span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && read(e.target.files[0])}
      />

      {status.s === "error" && <p className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-800">{status.msg}</p>}

      {items.length > 0 && (
        <>
          <div className="rounded-2xl bg-brand-900 p-4 text-white">
            <p className="flex items-center gap-2 text-[16px] font-extrabold">
              <CheckCircle2 size={20} className="text-lime" /> {items.length} {items.length === 1 ? "questão encontrada" : "questões encontradas"}
            </p>
            <p className="mt-0.5 text-[13px] text-brand-100/85">
              {objective.length} {objective.length === 1 ? "objetiva" : "objetivas"} · {items.length - objective.length}{" "}
              {items.length - objective.length === 1 ? "discursiva" : "discursivas"} ·{" "}
              {objective.length ? `gabarito em ${withAnswer} de ${objective.length}` : "sem objetivas"}
              {items.some((q) => q.image_path) ? ` · ${items.filter((q) => q.image_path).length} com imagem` : ""}
            </p>
            <p className="mt-2 text-[12px] text-brand-100/75">
              Confira abaixo. Questão que não for da prova: toque na lixeira. Depois você ajusta tudo no editor
              {objective.length > withAnswer ? " e marca as respostas certas que faltarem" : ""}.
            </p>
          </div>

          {warnings.length > 0 && (
            <div className="space-y-1.5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
              {warnings.map((w) => (
                <p key={w} className="flex gap-2 text-[13px] text-amber-900">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {w}
                </p>
              ))}
            </div>
          )}

          <ol className="space-y-2.5">
            {items.map((q, i) => (
              <li key={`${q.number}-${i}`} className="rounded-2xl border border-line bg-white p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-lg bg-brand-900 px-2 py-0.5 text-[12px] font-extrabold text-white">QUESTÃO {String(i + 1).padStart(2, "0")}</span>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[12px] font-semibold text-brand-800">{QUESTION_TYPE_NAMES[q.type]}</span>
                  {q.image_path && <ImageIcon size={16} className="text-brand-700" />}
                  <button
                    type="button"
                    title="Tirar esta questão"
                    onClick={() => setItems((list) => list.filter((_, k) => k !== i))}
                    className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                {q.statement ? <MathPreview text={q.statement} className="text-[14px] leading-relaxed text-ink" /> : <p className="text-[13px] italic text-muted">(sem enunciado)</p>}
                {q.preview && <img src={q.preview} alt="" className="mt-2 max-h-48 rounded-lg border border-line" />}
                {q.options.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {q.options.map((o) => {
                      const right = q.correct_answers.includes(o.label);
                      return (
                        <li key={o.label} className={`flex gap-2 rounded-lg px-2 py-1 text-[14px] ${right ? "bg-brand-50 font-semibold text-brand-900" : ""}`}>
                          <span className="font-bold text-brand-700">({o.label})</span>
                          <MathPreview text={o.text} className="min-w-0 flex-1" />
                          {right && <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-500" />}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {q.type === "true_false" && (
                  <p className="mt-2 text-[13px] text-muted">
                    ( ) Certo ( ) Errado
                    {q.correct_answers[0] && <strong className="ml-2 text-brand-800">Gabarito: {q.correct_answers[0] === "C" ? "Certo" : "Errado"}</strong>}
                  </p>
                )}
              </li>
            ))}
          </ol>

          {mode === "append" && (
            <>
              {saveError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{saveError}</p>}
              <button
                type="button"
                onClick={append}
                disabled={pending || items.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-900 px-4 py-3.5 text-[15px] font-bold text-white disabled:opacity-50 active:scale-[0.98]"
              >
                {pending && <Loader2 size={18} className="animate-spin" />} Adicionar {items.length} {items.length === 1 ? "questão" : "questões"} à avaliação
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
