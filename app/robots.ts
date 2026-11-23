import type { MetadataRoute } from "next";
import { canonicalOrigin } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  // Staging sets SITE_NOINDEX=1: keep every crawler out (proxy.ts sends X-Robots-Tag: noindex).
  if (process.env.SITE_NOINDEX === "1") return { rules: { userAgent: "*", disallow: "/" } };
  // The sitemap is named only where it is served: with the production origin set.
  const origin = canonicalOrigin();
  return origin ? { rules: { userAgent: "*", allow: "/" }, sitemap: `${origin}/sitemap.xml` } : { rules: { userAgent: "*", allow: "/" } };
}
