import type { MetadataRoute } from "next";

/**
 * The web app manifest (/manifest.webmanifest): BibleGet installs as an app that opens on its home page (which the
 * proxy sends to the reader's language). public/sw.js keeps the chapters read for offline reading.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "BibleGet",
    short_name: "BibleGet",
    description: "Read the Bible in many editions and languages.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
