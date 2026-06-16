/**
 * Shared authentication and CORS configuration for all ingest HTTP endpoints.
 * CPHLTH-02: All ingest handlers must call validateIngestAuth() before processing.
 *
 * Convex httpActions run in a Node.js-compatible runtime. The Convex tsconfig does
 * not include @types/node, so process.env is accessed via globalThis to avoid TS errors.
 */

// Convex does not include @types/node — access process.env via globalThis cast.
const _env: Record<string, string | undefined> = (globalThis as any).process?.env ?? {};

/**
 * Parse CODEPULSE_ALLOWED_ORIGIN into a Set of allowed origins.
 * Accepts a comma-separated string, trims whitespace from each entry.
 * Returns null when input is falsy or results in an empty set — signals dev fallback.
 */
export function parseAllowlist(raw: string | undefined): Set<string> | null {
  if (!raw) return null;
  const origins = raw.split(",").map((o) => o.trim()).filter(Boolean);
  return origins.length > 0 ? new Set(origins) : null;
}

// Computed once at module init from the env var.
const _allowlist = parseAllowlist(_env.CODEPULSE_ALLOWED_ORIGIN);

/**
 * Return CORS headers for the given request, using the provided allowlist.
 * This is the pure, testable form — usable in unit tests without module-cache concerns.
 *
 * Behavior:
 *   - allowlist null (env var unset): dev fallback — ACAO = "*"
 *   - origin in allowlist: ACAO echoes the exact origin (fail-closed match)
 *   - origin not in allowlist: ACAO key omitted entirely (browsers block cross-origin reads)
 */
export function getCorsHeadersWithAllowlist(
  request: Request,
  allowlist: Set<string> | null
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (allowlist === null) {
    // Dev fallback: env var unset — permissive (not reached in prod if checklist followed)
    headers["Access-Control-Allow-Origin"] = "*";
  } else {
    const origin = request.headers.get("Origin") ?? "";
    if (origin && allowlist.has(origin)) {
      // Matched — echo the specific origin back
      headers["Access-Control-Allow-Origin"] = origin;
    }
    // Else: not in allowlist — omit ACAO entirely (fail-closed)
  }

  return headers;
}

/**
 * Return CORS headers for the given request, using the module-level allowlist.
 * Thin wrapper around getCorsHeadersWithAllowlist — use in production httpAction handlers.
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  return getCorsHeadersWithAllowlist(request, _allowlist);
}

/**
 * Validate the Bearer token on an ingest request.
 * Returns true if auth passes (or if no key is configured — dev mode).
 * Returns false if a key is configured but the request does not provide it.
 */
export function validateIngestAuth(request: Request): boolean {
  const expectedKey = _env.ASTRIDR_INGEST_API_KEY;
  if (!expectedKey) return true; // Skip auth in dev when no key configured
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader === `Bearer ${expectedKey}`;
}

/**
 * Validate the Bearer token on a Forge ingest request.
 * Checks FORGE_INGEST_API_KEY. Unlike validateIngestAuth(), /forge-ingest
 * accepts external writes, so it FAILS CLOSED: a missing key does not silently
 * allow anonymous ingest. To run the unauthenticated dev path, set
 * FORGE_INGEST_ALLOW_ANON=true explicitly.
 * Returns true only if a configured key matches the request's Bearer token, or
 * if no key is set AND FORGE_INGEST_ALLOW_ANON is explicitly "true".
 */
export function validateForgeIngestAuth(request: Request): boolean {
  const expectedKey = _env.FORGE_INGEST_API_KEY;
  if (!expectedKey) {
    // Fail closed: a missing key must not silently open /forge-ingest to the
    // public internet. Require an explicit opt-in for the dev/anon path.
    return _env.FORGE_INGEST_ALLOW_ANON === "true";
  }
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader === `Bearer ${expectedKey}`;
}

/**
 * Return a 401 Unauthorized response.
 * Uses minimal fixed headers only — a 401 rejection does not negotiate CORS.
 */
export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}
