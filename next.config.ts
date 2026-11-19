import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const config: NextConfig = {
  // Self-contained server.js plus a pruned node_modules, so the deployed bundle needs no `npm ci` on the host.
  output: "standalone",
  async headers() {
    // Staging must never be indexed: robots.ts says so for crawlers that read it, this header for the rest.
    if (process.env.SITE_NOINDEX !== "1") return [];
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] }];
  },
};

export default createNextIntlPlugin("./i18n/request.ts")(config);
