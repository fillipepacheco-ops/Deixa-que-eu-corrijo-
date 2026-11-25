import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Deixa que eu Corrijo", template: "%s · Deixa que eu Corrijo" },
  description: "Menos burocracia. Mais tempo para ensinar.",
  appleWebApp: { capable: true, title: "Corrijo", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0b3a1e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={jakarta.variable}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
