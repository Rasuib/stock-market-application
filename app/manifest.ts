import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tradia - Learn Stock Market Trading",
    short_name: "Tradia",
    description: "Educational stock market simulator with AI-powered coaching",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0d1a",
    theme_color: "#00ff88",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  }
}
