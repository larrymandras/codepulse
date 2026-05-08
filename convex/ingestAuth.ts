/**
 * Shared authentication, CORS, and ingest middleware for all HTTP endpoints.
 * CPHLTH-02: All ingest handlers must call validateIngestAuth() before processing.
 *
 * D-12: Allow only production CodePulse URL and localhost:5173 (Vite dev server).
 * D-13: No wildcard fallback — reject cross-origin if CODEPULSE_ALLOWED_ORIGIN unset.
 * D-08: Body size violations return HTTP 413.
 * D-11: Validation errors return structured JSON { error, details }.
 *
 * Convex httpActions run in a Node.js-compatible runtime. The Convex tsconfig does
 * not include @types/node, so process.env is accessed via globalThis to avoid TS errors.
 */

// Convex does not include @types/node — access process.env via globalThis cast.
const _env: Record<string, string | undefined> = (globalThis as any).process?.env ?? {};

const MAX_BODY_BYTES = 1_048_576; // 1 MB per D-08
const DEV_ORIGIN = "http://localhost:5173";

/**
 * Build CORS response headers based on the request Origin.
 *
 * - No Origin (server-to-server): returns base headers without Access-Control-Allow-Origin.
 * - Allowlisted Origin: reflects the origin back in Access-Control-Allow-Origin.
 * - Non-allowlisted Origin: returns "null" in Access-Control-Allow-Origin (D-13).
 * - Always includes Vary: Origin when an Origin header is present for correct caching.
 */
export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (!requestOrigin) return base;

  const prodOrigin = _env.CODEPULSE_ALLOWED_ORIGIN;
  const isAllowed =
    (!!prodOrigin && requestOrigin === prodOrigin) ||
    requestOrigin === DEV_ORIGIN;

  return {
    ...base,
    "Access-Control-Allow-Origin": isAllowed ? requestOrigin : "null",
    Vary: "Origin",
  };
}

/**
 * Backward-compatible static export — equivalent to server-to-server (no Origin).
 * Consumers that import `corsHeaders` directly (e.g., existing tests, otelMetrics.ts)
 * continue to work without changes.
 */
export const corsHeaders: Record<string, string> = getCorsHeaders();

/**
 * Validate the Bearer token on an ingest request.
 * Returns true if auth passes (or if no key is configured — dev mode per D-04).
 * Returns false if a key is configured but the request does not provide it.
 */
export function validateIngestAuth(request: Request): boolean {
  const expectedKey = _env.ASTRIDR_INGEST_API_KEY;
  if (!expectedKey) return false; // Fail-closed: deny all requests when key is not configured
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader === `Bearer ${expectedKey}`;
}

/**
 * Check whether the request body exceeds the maximum allowed size (1 MB).
 * Returns true if the body is within limits or Content-Length is absent.
 * Returns false if Content-Length exceeds MAX_BODY_BYTES.
 */
export function checkBodySize(request: Request): boolean {
  const cl = request.headers.get("Content-Length");
  if (!cl) return true; // Absent = can't check; allow through
  return parseInt(cl, 10) <= MAX_BODY_BYTES;
}

/**
 * Return a 401 Unauthorized response with CORS headers.
 * Accepts optional headers parameter for backward compatibility.
 */
export function unauthorizedResponse(headers?: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    {
      status: 401,
      headers: { "Content-Type": "application/json", ...(headers ?? corsHeaders) },
    }
  );
}

/**
 * Return a 413 Payload Too Large response.
 */
export function payloadTooLargeResponse(headers: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: "Payload too large", maxBytes: MAX_BODY_BYTES }),
    { status: 413, headers: { "Content-Type": "application/json", ...headers } }
  );
}

/**
 * Return a 429 Rate Limit Exceeded response.
 */
export function rateLimitResponse(
  headers: Record<string, string>,
  retryAfterMs?: number
): Response {
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded", retryAfterMs }),
    { status: 429, headers: { "Content-Type": "application/json", ...headers } }
  );
}

/**
 * Return a 400 Validation Error response with structured details per D-11.
 */
export function validationErrorResponse(
  details: Array<{ field: string; message: string }>,
  headers: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ error: "validation_error", details }),
    { status: 400, headers: { "Content-Type": "application/json", ...headers } }
  );
}
