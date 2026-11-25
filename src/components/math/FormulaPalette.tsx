"use client";

import { insertAtCursor, type TextField } from "./math-field";

type Item = { label: React.ReactNode; title: string; insert: string; cursor?: number };

const STRUCTURES: Item[] = [
  { label: <>x<sup>2</sup></>, title: "Ao quadrado", insert: "^{2}" },
  { label: <>x<sup>3</sup></>, title: "Ao cubo", insert: "^{3}" },
  { label: <>x<sup>n</sup></>, title: "Expoente", insert: "^{}", cursor: 2 },
  { label: <>x<sub>n</sub></>, title: "Índice (subscrito)", insert: "_{}", cursor: 2 },
  {
    label: (
      <span className="inline-flex flex-col items-center text-[11px] leading-[1.1]">
        <span className="border-b border-current px-0.5">a</span>
        <span>b</span>
      </span>
    ),
    title: "Fração",
    insert: "\\frac{}{}",
    cursor: 6,
  },
  { label: <>√x</>, title: "Raiz quadrada", insert: "\\sqrt{}", cursor: 6 },
  { label: <><sup className="text-[9px]">3</sup>√x</>, title: "Raiz cúbica", insert: "\\sqrt[3]{}", cursor: 9 },
  { label: <><sup className="text-[9px]">n</sup>√x</>, title: "Raiz de índice n", insert: "\\sqrt[]{}", cursor: 6 },
  { label: <>( )</>, title: "Parênteses", insert: "()", cursor: 1 },
  { label: <>|x|</>, title: "Módulo", insert: "||", cursor: 1 },
];

const SYMBOLS = "π ≤ ≥ ≠ ≈ ± × ÷ · ° ∞ % Δ θ α β λ Σ ∈ ∉ ⊂ ∪ ∩ ∅ → ⇒ ⇔ ℝ ℕ ℤ ℚ ∠ ⊥ ∥".split(" ");
const FUNCS = ["sen", "cos", "tg", "log", "ln"];

const btn =
  "grid h-10 min-w-10 place-items-center rounded-lg border border-line bg-white px-2 text-[15px] text-brand-900 hover:border-brand-200 hover:bg-brand-50 active:scale-95";

/**
 * Teclado de fórmulas. Insere no último campo em que o professor tocou
 * (enunciado ou alternativa), na posição do cursor.
 */
export function FormulaPalette({ getTarget }: { getTarget: () => TextField | null }) {
  const add = (text: string, cursor?: number) => {
    const el = getTarget();
    if (el) insertAtCursor(el, text, cursor);
  };
  // onMouseDown + preventDefault: o campo não perde o foco nem o cursor
  const keep = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-3">
      <p className="mb-2 text-[12px] text-muted">Toque no campo (enunciado ou alternativa) e depois no botão.</p>
      <div className="flex flex-wrap gap-1.5">
        {STRUCTURES.map((it) => (
          <button key={it.title} type="button" title={it.title} aria-label={it.title} className={btn} onMouseDown={keep} onClick={() => add(it.insert, it.cursor)}>
            {it.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SYMBOLS.map((s) => (
          <button key={s} type="button" title={s} className={btn} onMouseDown={keep} onClick={() => add(s)}>
            {s}
          </button>
        ))}
        {FUNCS.map((f) => (
          <button key={f} type="button" className={`${btn} text-[13px]`} onMouseDown={keep} onClick={() => add(`${f} `)}>
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}
