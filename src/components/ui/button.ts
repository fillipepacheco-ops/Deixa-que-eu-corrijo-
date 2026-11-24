export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-900 text-white hover:bg-brand-800",
  secondary: "border border-line bg-white text-brand-900 hover:border-brand-200 hover:bg-brand-50",
  ghost: "text-brand-700 hover:bg-brand-50",
  danger: "text-red-700 hover:bg-red-50",
};

export function buttonClass(variant: ButtonVariant = "primary") {
  return `${base} ${variants[variant]}`;
}
