import { COMMIT, RELEASE } from "@/lib/release";

// The deploy's smoke test waits for this to report the new release (lib/release.ts reads it once).
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ release: RELEASE, commit: COMMIT || null }, { headers: { "Cache-Control": "no-store" } });
}
