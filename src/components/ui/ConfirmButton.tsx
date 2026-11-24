"use client";

import { useTransition } from "react";
import { buttonClass, type ButtonVariant } from "./button";

/** Botão que pede confirmação antes de executar uma ação destrutiva. */
export function ConfirmButton({
  action,
  message,
  children,
  variant = "danger",
  className = "",
  ariaLabel,
}: {
  action: () => Promise<void>;
  message: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
  ariaLabel?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={pending}
      className={`${buttonClass(variant)} ${className}`}
      onClick={() => {
        if (window.confirm(message)) start(() => action());
      }}
    >
      {children}
    </button>
  );
}
