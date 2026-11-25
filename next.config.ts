import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-lib roda no servidor (rotas de PDF) e no navegador.
  serverExternalPackages: ["pdf-lib", "docx", "jszip"],
  // Lint roda à parte; o deploy não deve falhar por estilo de código.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
