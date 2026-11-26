import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import createNextIntlPlugin from "next-intl/plugin";

const config: NextConfig = {
  // Self-contained server.js plus a pruned node_modules, so the deployed bundle needs no `npm ci` on the host.
  output: "standalone",
  // Inlined at build time: the release id /api/version reports (the deploy's bundle tag; not a secret).
  env: {
    BIBLEGET_RELEASE: process.env.BIBLEGET_RELEASE || "dev",
    // The commit the build is from (the deploy's GITHUB_SHA; not a secret), linked in the footer.
    BIBLEGET_COMMIT: process.env.BIBLEGET_COMMIT || "",
  },
};

// MDX for the documentation section (content/docs), compiled at build time: nothing is read from disk at runtime.
// remark-gfm for tables, named by string since Turbopack cannot take plugin functions.
const withMDX = createMDX({ options: { remarkPlugins: ["remark-gfm"] } });

export default createNextIntlPlugin("./i18n/request.ts")(withMDX(config));
