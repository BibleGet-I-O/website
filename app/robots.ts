import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  // Staging sets SITE_NOINDEX=1: keep every crawler out (next.config.ts also sends X-Robots-Tag: noindex).
  if (process.env.SITE_NOINDEX === "1") return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/" } };
}
