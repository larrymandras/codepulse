/**
 * bifrostUrl.ts — the canonical identity of a Bifröst link URL.
 *
 * Dependency-free (no `convex/values`, no `./_generated/*`, no React), matching
 * the `convex/galdrSlug.ts` / `convex/galdrVariables.ts` shape, so both the
 * Convex server bundle and a vitest run can import it with zero setup.
 *
 * THIS IS THE AUTHORITY. `hooks/bifrostScan.mjs` carries its own copy of this
 * logic because it runs under plain node and cannot import TypeScript — an
 * unavoidable duplication, made safe two ways:
 *
 *   1. The mutation, not the scanner, decides whether a link already exists.
 *      The scanner's local check is only a fast path that avoids a pointless
 *      round-trip; if the two ever disagree, the mutation wins and the worst
 *      outcome is one wasted call, never a duplicate row.
 *   2. `hooks/bifrostScan.test.mjs` imports BOTH implementations and asserts
 *      they agree on a shared table of cases, so a drift fails a test rather
 *      than silently splitting link identity in half.
 *
 * Two rules the string-chopping version this replaces got wrong, both found by
 * measuring rather than reading:
 *
 *   - A trailing slash must not change the key. Stripping `:80` before the
 *     trailing slash meant `http://x:80` and `http://x:80/` produced different
 *     keys — one URL, two identities, a guaranteed duplicate.
 *   - A default port is default only for ITS OWN scheme. `http://x:443` is a
 *     real, non-default endpoint and must not collapse to a bare host.
 *
 * The WHATWG `URL` parser gets both right without special-casing, which is why
 * this parses instead of chaining replacements.
 */

/**
 * The SCHEME is deliberately absent from the returned key.
 *
 * `http://host:9000` and `https://host:9000` are treated as the same link,
 * because a hub entry hand-typed with one scheme and a scan proposing the other
 * are the same destination, and splitting them would duplicate it. Where the
 * difference actually matters — a stale `http://` entry for a port that only
 * speaks TLS — it is REPORTED by the scanner rather than encoded here.
 */
export function normalizeLinkUrl(url: string): string {
  const raw = String(url ?? "").trim();
  if (!raw) return "";

  let u: URL;
  try {
    u = new URL(raw.includes("://") ? raw : `http://${raw}`);
  } catch {
    // An unparseable string is still an identity, just a degenerate one.
    // Returning it lowercased keeps dedupe working rather than throwing on a
    // hand-typed hub entry that was never a valid URL.
    return raw.toLowerCase();
  }

  let host = u.hostname.toLowerCase();
  if (host === "localhost" || host === "[::1]" || host === "::1") {
    host = "127.0.0.1";
  }

  const port = u.port ? `:${u.port}` : "";
  const path = u.pathname.replace(/\/+$/, "");
  return `${host}${port}${path}${u.search}`;
}
