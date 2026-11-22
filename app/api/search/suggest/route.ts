import { ApiUnavailable, getEditions } from "@/lib/api";
import { clientIp, suggestLimiter } from "@/lib/rate-limit";
import { suggestWords } from "@/lib/search";

const PREFIX = /^\p{L}{2,40}$/u;

const bad = (title: string) => Response.json({ title }, { status: 400 });

/**
 * The search form's word suggestions: the edition's words that start with `prefix` (the last word typed), from the
 * endpoint's /search/suggest with the site's read key. Limited per visitor (60 a minute).
 */
export async function GET(req: Request): Promise<Response> {
  const limit = suggestLimiter.hit(clientIp(req.headers));
  if (!limit.ok) {
    return Response.json({ title: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }
  const params = new URL(req.url).searchParams;
  const prefix = (params.get("prefix") ?? "").trim();
  if (!PREFIX.test(prefix)) return bad("prefix must be 2 to 40 letters");
  const sigla = (params.get("edition") ?? "").toUpperCase();
  try {
    if (!(await getEditions()).some((e) => e.sigla === sigla)) return bad("unknown edition");
    const suggestions = await suggestWords(sigla, prefix);
    return Response.json({ suggestions }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    if (!(e instanceof ApiUnavailable)) throw e;
    // No suggestions is a quiet failure: the reader can still search.
    return Response.json({ suggestions: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
