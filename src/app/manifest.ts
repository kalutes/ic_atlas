import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "IC cards",
    short_name: "IC cards",
    description: "Japanese IC card collection.",
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#111315",
    theme_color: "#111315",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
