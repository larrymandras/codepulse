/**
 * Shared authentication and CORS configuration for all ingest HTTP endpoints.
 * CPHLTH-02: All ingest handlers must call validateIngestAuth() before processing.
 *
 * Convex httpActions run in a Node.js-compatible runtime. The Convex tsconfig does
 * not include @types/node, so process.env is accessed via globalThis to avoid TS errors.
 */

// Convex does not include @types/node — access process.env via globalThis cast.
const _env: Record<string, string | undefined> = (globalThis as any).process?.env ?? {};

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": _env.CODEPULSE_ALLOWED_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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
 * Return a 401 Unauthorized response with CORS headers.
 */
export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}
