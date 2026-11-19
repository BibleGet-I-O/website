import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Not the route handlers (/api), Next's own files, or any file with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
