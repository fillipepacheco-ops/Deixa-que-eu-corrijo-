import {
  BarChart3,
  CalendarRange,
  ClipboardList,
  FileBarChart,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Library,
  ScanLine,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** false = ainda não implementado: aparece identificado como "em breve", sem link. */
  ready: boolean;
  mobile?: boolean; // aparece na barra inferior do celular
}

/** Menu principal (item 36 da especificação). */
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ready: true, mobile: true },
  { href: "/avaliacoes", label: "Avaliações", icon: FileText, ready: true, mobile: true },
  { href: "/banco-de-questoes", label: "Banco de Questões", icon: Library, ready: false },
  { href: "/turmas", label: "Turmas", icon: GraduationCap, ready: true, mobile: true },
  { href: "/alunos", label: "Alunos", icon: Users, ready: true },
  { href: "/correcao", label: "Correção", icon: ScanLine, ready: true, mobile: true },
  { href: "/resultados", label: "Resultados", icon: BarChart3, ready: true, mobile: true },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart, ready: false },
  { href: "/conselho", label: "Conselho de Classe", icon: ClipboardList, ready: false },
  { href: "/planejamento", label: "Planejamento", icon: CalendarRange, ready: false },
  { href: "/configuracoes", label: "Configurações", icon: Settings, ready: false },
];
