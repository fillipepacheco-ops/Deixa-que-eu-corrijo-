/** Planos, preços e regras de vencimento (lógica pura, testável). */

export type PlanId = "professor" | "direcao";
export type SubStatus = "pending" | "active" | "suspended";

export const PLANS: Record<PlanId, { name: string; price: string; cents: number; link: string; tagline: string; features: string[] }> = {
  professor: {
    name: "Professor",
    price: "R$ 9,90",
    cents: 990,
    link: "https://invoice.infinitepay.io/plans/prof_fillipe/V9FglWYg88",
    tagline: "Tudo o que você precisa para as suas turmas.",
    features: [
      "Provas em PDF e Word com a logo da escola",
      "Cartão-resposta e correção pela câmera",
      "Notas organizadas por escola e bimestre",
      "Modo game ao vivo na sala",
      "Importar provas de PDF ou Word",
    ],
  },
  direcao: {
    name: "Direção / Coordenação",
    price: "R$ 29,90",
    cents: 2990,
    link: "https://invoice.infinitepay.io/plans/prof_fillipe/EJhRdObsKn",
    tagline: "Para a coordenação montar a prova da escola inteira.",
    features: [
      "Tudo do plano Professor",
      "Prova Multi: cada professor manda as suas questões",
      "Seções por disciplina numa prova só",
      "4 versões da prova com ordem diferente",
      "Professores convidados sem pagar à parte",
    ],
  },
};

export const PERIOD_DAYS = 30;
export const GRACE_DAYS = 14;
/** A partir de quantos dias antes do vencimento avisamos. */
export const WARN_DAYS = 5;

export interface Subscription {
  user_id: string;
  email: string | null;
  full_name: string | null;
  plan: PlanId;
  status: SubStatus;
  paid_until: string | null; // yyyy-mm-dd
  created_at?: string;
}

export type AccessState =
  | "em_dia" // pago e longe do vencimento
  | "vencendo" // vence em até WARN_DAYS dias
  | "atrasado" // venceu, mas ainda dentro da tolerância
  | "bloqueado" // passou da tolerância
  | "suspenso" // suspenso pelo gestor
  | "aguardando"; // conta nova, ainda sem pagamento

export const STATE_LABEL: Record<AccessState, string> = {
  em_dia: "Em dia",
  vencendo: "Vencendo",
  atrasado: "Atrasado",
  bloqueado: "Bloqueado",
  suspenso: "Suspenso",
  aguardando: "Aguardando pagamento",
};

/** Dias de `from` até `to` (datas yyyy-mm-dd). */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export function todayISO(now = new Date()): string {
  // data no fuso de Brasília
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export function accessState(sub: Pick<Subscription, "status" | "paid_until"> | null, today: string): AccessState {
  if (!sub || sub.status === "pending") return "aguardando";
  if (sub.status === "suspended") return "suspenso";
  if (!sub.paid_until) return "em_dia";
  const left = daysBetween(today, sub.paid_until);
  if (left > WARN_DAYS) return "em_dia";
  if (left >= 0) return "vencendo";
  if (-left <= GRACE_DAYS) return "atrasado";
  return "bloqueado";
}

export const canUseApp = (s: AccessState) => s === "em_dia" || s === "vencendo" || s === "atrasado";

/** Data em que o acesso será bloqueado (vencimento + tolerância). */
export function blockDate(paidUntil: string): string {
  const d = new Date(`${paidUntil}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + GRACE_DAYS);
  return d.toISOString().slice(0, 10);
}

export const brDate = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

export const isPlan = (v: unknown): v is PlanId => v === "professor" || v === "direcao";
