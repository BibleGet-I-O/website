import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const config: NextConfig = {
  // Self-contained server.js plus a pruned node_modules, so the deployed bundle needs no `npm ci` on the host.
  output: "standalone",
  // Inlined at build time: the release id /api/version reports (the deploy's bundle tag; not a secret).
  env: { BIBLEGET_RELEASE: process.env.BIBLEGET_RELEASE || "dev" },
};

export default createNextIntlPlugin("./i18n/request.ts")(config);
