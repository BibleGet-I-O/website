// The release this build was made for: next.config.ts bakes BIBLEGET_RELEASE in at build time (the deploy
// sets it to its bundle tag; it is not a secret). Read once, when the module loads, so a process still
// running an older build keeps reporting that build even after the tree on disk is replaced. The deploy's
// smoke test waits for this to report the new release.
const RELEASE = process.env.BIBLEGET_RELEASE || "dev";

export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ release: RELEASE }, { headers: { "Cache-Control": "no-store" } });
}
