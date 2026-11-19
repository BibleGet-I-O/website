import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

// Read per request (not at build time), so SITE_NOINDEX set only on the running app still applies.
export default function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);
  if (process.env.SITE_NOINDEX === "1") response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  // Not the route handlers (/api), Next's own files, or any file with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
