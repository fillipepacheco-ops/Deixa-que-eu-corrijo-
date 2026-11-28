"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Copy, Eye, Loader2, Moon, Pencil, Sun, Trash2 } from "lucide-react";

const ICONS = { edit: Pencil, delete: Trash2, moon: Moon, sun: Sun, view: Eye, copy: Copy } as const;
const TONES = {
  danger: "bg-red-600 text-white",
  neutral: "bg-gray-500 text-white",
  brand: "bg-brand-700 text-white",
} as const;

export interface SwipeAction {
  label: string;
  icon: keyof typeof ICONS;
  tone?: keyof typeof TONES;
  /** Abrir uma página. */
  href?: string;
  /** Ação (pode ser uma ação do servidor já com o id). */
  run?: () => void | Promise<unknown>;
  /** Pergunta antes de executar. */
  confirm?: string;
}

const OPEN_EVENT = "dqec:swipe-open";
const ACTION_W = 76;

/**
 * Linha que desliza para a esquerda (como no celular) e mostra Editar, Apagar e afins.
 * No computador, os mesmos botões continuam disponíveis dentro da página.
 */
export function SwipeRow({
  actions,
  children,
  className = "",
  contentClassName = "bg-white",
}: {
  actions: SwipeAction[];
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const id = useId();
  const width = actions.length * ACTION_W;
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; base: number; horizontal: boolean | null } | null>(null);
  const moved = useRef(false);
  const [pending, startTransition] = useTransition();

  // só uma linha aberta por vez
  useEffect(() => {
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) setDx(0);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [id]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, base: dx, horizontal: null };
    moved.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = start.current;
    if (!s) return;
    const t = e.touches[0];
    const mx = t.clientX - s.x;
    const my = t.clientY - s.y;
    if (s.horizontal === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) s.horizontal = Math.abs(mx) > Math.abs(my);
    if (!s.horizontal) return;
    moved.current = true;
    setDragging(true);
    setDx(Math.max(-width - 24, Math.min(0, s.base + mx)));
  };
  const onTouchEnd = () => {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (!s?.horizontal) return;
    const open = dx < -width / 2;
    setDx(open ? -width : 0);
    if (open) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
  };

  const act = (a: SwipeAction) => {
    if (a.confirm && !window.confirm(a.confirm)) return;
    setDx(0);
    if (a.run) startTransition(async () => void (await a.run!()));
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-y-0 right-0 flex" style={{ width }} aria-hidden={dx === 0}>
        {actions.map((a) => {
          const Icon = ICONS[a.icon];
          const cls = `flex h-full flex-col items-center justify-center gap-1 text-[12px] font-bold ${TONES[a.tone ?? "brand"]}`;
          const body = (
            <>
              {pending ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
              {a.label}
            </>
          );
          return a.href ? (
            <Link key={a.label} href={a.href} className={cls} style={{ width: ACTION_W }} tabIndex={dx === 0 ? -1 : 0}>
              {body}
            </Link>
          ) : (
            <button key={a.label} type="button" onClick={() => act(a)} className={cls} style={{ width: ACTION_W }} tabIndex={dx === 0 ? -1 : 0}>
              {body}
            </button>
          );
        })}
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClickCapture={(e) => {
          // depois de deslizar, o toque não abre a linha; com a linha aberta, um toque fecha
          if (moved.current || dx !== 0) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
            if (dx !== 0) setDx(0);
          }
        }}
        className={`relative ${contentClassName}`}
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? "none" : "transform 180ms ease-out", touchAction: "pan-y" }}
      >
        {children}
      </div>
    </div>
  );
}
