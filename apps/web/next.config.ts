import type { NextConfig } from "next";

/**
 * Whether search engines may keep this deployment.
 *
 * The same switch the root layout reads for its `robots` meta tag, so the
 * header and the tag can never disagree. Only the literal string "true"
 * enables indexing; anything else -- local development, previews, branch
 * builds, an unset variable -- is noindex.
 *
 * Read as a whole expression rather than through a computed lookup: Next
 * inlines `NEXT_PUBLIC_*` by matching literal text at build time.
 */
const indexable = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

/**
 * Security headers, set by the framework rather than by the host.
 *
 * These lived in `netlify.toml` and were silently doing nothing: responses
 * came back without any of them, on server-rendered pages and static assets
 * alike. A header that a config file claims and the server does not send is
 * worse than no header, because the documentation says you are protected.
 *
 * Next emits these itself, so they hold on Netlify, on any other host, and in
 * `next start` locally -- which also means they can be checked before a deploy
 * instead of after one. Given this project has already changed its mind about
 * where it deploys, host-independent is the correct place for them.
 *
 * `X-Robots-Tag` is the one that matters most today, and it is derived from
 * the same variable as the meta tag on purpose. Two independent locks sounded
 * safer when they were written down, but they had to be opened together on
 * launch day and the likely failure was opening one and believing the job
 * done. One switch cannot be half-thrown.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No page here is ever legitimately framed, and a payment handback least of
  // all -- clickjacking a checkout is the textbook case.
  { key: "X-Frame-Options", value: "DENY" },
  ...(indexable
    ? []
    : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
