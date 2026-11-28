import { Fragment } from "react";
import { parseMath, type MathNode } from "@/lib/math/parse";
import { splitInline } from "@/lib/assessment/inline-images";

function Nodes({ nodes }: { nodes: MathNode[] }) {
  return (
    <>
      {nodes.map((n, i) => (
        <Fragment key={i}>
          <Node n={n} />
        </Fragment>
      ))}
    </>
  );
}

function Node({ n }: { n: MathNode }) {
  switch (n.t) {
    case "text":
      return <span className="whitespace-pre-wrap">{n.s}</span>;
    case "sup":
      return (
        <span>
          <Nodes nodes={n.base} />
          <sup className="text-[0.7em]">
            <Nodes nodes={n.exp} />
          </sup>
        </span>
      );
    case "sub":
      return (
        <span>
          <Nodes nodes={n.base} />
          <sub className="text-[0.7em]">
            <Nodes nodes={n.idx} />
          </sub>
        </span>
      );
    case "frac":
      return (
        <span className="mx-0.5 inline-flex flex-col items-center align-middle text-[0.88em] leading-[1.15]">
          <span className="border-b border-current px-1">
            <Nodes nodes={n.num} />
          </span>
          <span className="px-1">
            <Nodes nodes={n.den} />
          </span>
        </span>
      );
    case "sqrt":
      return (
        <span className="inline-flex items-start">
          {n.index && (
            <sup className="-mr-1 text-[0.6em]">
              <Nodes nodes={n.index} />
            </sup>
          )}
          <span className="text-[1.05em] leading-none">√</span>
          <span className="border-t border-current px-0.5 leading-snug">
            <Nodes nodes={n.body} />
          </span>
        </span>
      );
  }
}

/** Mostra o texto com as fórmulas como vão sair na prova. */
export function MathPreview({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <div className={className}>
      {lines.map((l, i) => {
        const segs = splitInline(l);
        // figura do banco de questões ([[img:...]]): no lugar dela, no tamanho original (até a largura da tela)
        if (segs.some((s) => s.t === "img")) {
          return (
            <div key={i} className="my-1.5">
              {segs.map((s, j) =>
                s.t === "img" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={j} src={s.src} alt="" loading="lazy" className="mx-auto block h-auto max-w-full" style={s.wmm ? { width: `${s.wmm}mm` } : undefined} />
                ) : s.s.trim() ? (
                  <p key={j} className="text-justify">
                    <Nodes nodes={parseMath(s.s)} />
                  </p>
                ) : null,
              )}
            </div>
          );
        }
        return (
          <p key={i} className="min-h-[1.2em] text-justify">
            <Nodes nodes={parseMath(l)} />
          </p>
        );
      })}
    </div>
  );
}
