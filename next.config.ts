import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança em todas as páginas:
 *  - CSP: só carrega código do próprio app; conversa só com o Supabase;
 *    impede que o app seja aberto dentro de outro site (clickjacking).
 *  - HSTS: o navegador sempre usa HTTPS.
 *  - Câmera só para o próprio app (correção pelo celular); microfone e localização bloqueados.
 */
const csp = [
  "default-src 'self'",
  // Next.js precisa de scripts inline; 'wasm-unsafe-eval' para o leitor de PDF.
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // pdf-lib roda no servidor (rotas de PDF) e no navegador.
  serverExternalPackages: ["pdf-lib", "docx", "jszip"],
  // Lint roda à parte; o deploy não deve falhar por estilo de código.
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
