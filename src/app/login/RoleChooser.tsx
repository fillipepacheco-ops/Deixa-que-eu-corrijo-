"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Presentation } from "lucide-react";

/**
 * Tela inicial: o professor entra com e-mail e senha; o aluno só digita o PIN
 * que aparece no telão da sala (sem cadastro).
 */
export function RoleChooser({ initial = "professor", children }: { initial?: "professor" | "aluno"; children: ReactNode }) {
  const [role, setRole] = useState(initial);
  const [pin, setPin] = useState("");
  const router = useRouter();

  const tab = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 px-3 py-3.5 text-[15px] font-extrabold transition active:scale-[0.98] ${
      active ? "border-brand-700 bg-brand-50 text-brand-900" : "border-line bg-white text-muted hover:border-brand-200"
    }`;

  return (
    <div>
      <p className="mb-2 text-center text-[13px] font-bold uppercase tracking-wider text-muted">Quem é você?</p>
      <div className="mb-6 flex gap-3">
        <button type="button" onClick={() => setRole("professor")} className={tab(role === "professor")}>
          <Presentation size={26} />
          Professor(a)
        </button>
        <button type="button" onClick={() => setRole("aluno")} className={tab(role === "aluno")}>
          <GraduationCap size={26} />
          Aluno(a)
        </button>
      </div>

      {role === "professor" ? (
        children
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pin.length === 6) router.push(`/jogar?pin=${pin}`);
          }}
          className="space-y-4"
        >
          <div>
            <h2 className="text-[22px] font-extrabold text-brand-900">Entrar na sala</h2>
            <p className="mt-1 text-[14px] text-muted">Digite o PIN que o professor mostrou no telão. Não precisa de cadastro.</p>
          </div>
          <input
            className="field text-center font-mono text-[30px]! font-black tracking-[0.3em]"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
          <button
            type="submit"
            disabled={pin.length !== 6}
            className="w-full rounded-xl bg-brand-900 px-4 py-3.5 text-[16px] font-bold text-white disabled:opacity-50 active:scale-[0.98]"
          >
            Entrar no jogo
          </button>
        </form>
      )}
    </div>
  );
}
