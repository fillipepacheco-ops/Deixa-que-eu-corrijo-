import type { MetadataRoute } from "next";

/** Permite "Adicionar à Tela de Início" no celular/tablet com o ícone da marca. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Deixa que eu Corrijo",
    short_name: "Corrijo",
    description: "Menos burocracia. Mais tempo para ensinar.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7fbf4",
    theme_color: "#0b3a1e",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
