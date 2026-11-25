/* eslint-disable @next/next/no-img-element */

/**
 * Logo oficial do Deixa que eu Corrijo (public/brand/logo.png).
 * Em fundos escuros, use onDark: a logo vai dentro de um cartão branco,
 * porque o texto "Deixa que eu" é verde-escuro.
 */
export function Logo({ height = 40, onDark = false }: { height?: number; onDark?: boolean }) {
  const img = (
    <img
      src="/brand/logo.png"
      alt="Deixa que eu Corrijo"
      style={{ height, width: "auto" }}
      className="block select-none"
      draggable={false}
    />
  );
  if (!onDark) return img;
  return <span className="inline-block rounded-xl bg-white px-3 py-2 shadow-sm">{img}</span>;
}

/** Só o símbolo (folha com check), para espaços pequenos. */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/brand/simbolo.png"
      alt=""
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`block select-none ${className}`}
      draggable={false}
    />
  );
}
