"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { signOut } from "@/services/auth";
import { NAV, type NavItem } from "./nav";
import { SchoolSwitcher } from "./SchoolSwitcher";

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  if (!item.ready) {
    return (
      <span
        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-white/40"
        title="Funcionalidade futura — em desenvolvimento"
      >
        <Icon size={18} strokeWidth={1.8} />
        <span className="flex-1">{item.label}</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">em breve</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition ${
        active ? "bg-white/12 text-white" : "text-white/75 hover:bg-white/6 hover:text-white"
      }`}
    >
      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-lime" : ""} />
      {item.label}
    </Link>
  );
}

export function AppShell({
  teacherName,
  schools = [],
  currentSchool = "",
  extraNav = [],
  children,
}: {
  teacherName: string;
  schools?: { id: string; name: string }[];
  currentSchool?: string;
  extraNav?: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const sidebar = (
    <div className="flex h-full flex-col bg-brand-900 px-3 py-5">
      <div className="px-2 pb-4">
        <Logo onDark height={42} />
      </div>
      <div className="mb-4 px-1">
        <SchoolSwitcher schools={schools} current={currentSchool} dark />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {[...NAV, ...extraNav].map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} onClick={() => setOpen(false)} />
        ))}
      </nav>
      <div className="mt-4 border-t border-white/10 px-2 pt-4">
        <p className="truncate text-[13px] font-semibold text-white">{teacherName || "Professor(a)"}</p>
        <form action={signOut}>
          <button className="mt-2 flex items-center gap-2 text-[13px] text-white/60 hover:text-white">
            <LogOut size={15} /> Sair
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>

      {/* Celular/tablet: topo + gaveta */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo height={34} />
        <div className="ml-auto mr-2 max-w-[45%]">
          <SchoolSwitcher schools={schools} current={currentSchool} />
        </div>
        <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="rounded-lg p-2 text-brand-900 hover:bg-brand-50">
          <Menu size={22} />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/40" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%]">
            {sidebar}
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-3 top-5 rounded-lg p-1.5 text-white/70 hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>

      {/* Barra inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.filter((n) => n.mobile).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${active ? "text-brand-700" : "text-muted"}`}
            >
              <Icon size={21} strokeWidth={active ? 2.3 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
