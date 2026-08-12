// Shared POST-with-bearer helper for host-side scanners.
//
// Extracted from hooks/scanner.mjs:220-241 in Phase 115 (D-04). scanner.mjs's runScan is on
// the awaited SessionStart path (hooks/codepulse-hook.mjs:142-145 does
// `await runScan(...)` inline), so this module's #1 contract is: postSnapshot must NEVER
// throw. Every failure path (network error, timeout, non-2xx response) is caught and logged;
// callers get a return value, not an exception.
//
// No shebang here (same reason as hooks/scanner.mjs:5-10): Vite/Rolldown's SSR module
// transform used by hooks/__tests__/*.test.mjs hoists import statements above line 1, and a
// shebang there breaks parsing with "Invalid Character `!`". This module is imported by tests
// the same way scanner.mjs is.

/**
 * POST a JSON body to `endpointUrl` with an optional bearer token, never throwing.
 *
 * @param {string} endpointUrl - The FULL URL including path (e.g. `http://host/scan`). The
 *   caller owns the route — this helper does not append or assume any path segment, so it can
 *   be reused for `/scan`, `/workspace-ingest`, or any future ingest route unchanged.
 * @param {string} ingestKey - Bearer token. If falsy, the request is still sent, unauthenticated,
 *   with a warning logged (matches the pre-extraction scanner.mjs behavior exactly).
 * @param {object} body - The JSON-serializable payload to send as the request body.
 * @param {object} [deps] - Injectable overrides for testability only, following the pattern at
 *   hooks/scanner.mjs:33-38. Every real call site omits this param and gets the same
 *   3000ms/"codepulse-scanner"/global-fetch behavior as before this parameter existed.
 * @param {number} [deps.timeoutMs=3000] - Abort timeout in milliseconds.
 * @param {string} [deps.logPrefix="codepulse-scanner"] - Prefix used in all console output.
 * @param {typeof fetch} [deps.fetchImpl=fetch] - Injectable fetch implementation.
 * @returns {Promise<{ok: boolean, status: number|null}>} Never rejects.
 */
export async function postSnapshot(endpointUrl, ingestKey, body, deps = {}) {
  const {
    timeoutMs = 3000,
    logPrefix = "codepulse-scanner",
    fetchImpl = fetch,
  } = deps;

  let pathname = endpointUrl;
  try {
    pathname = new URL(endpointUrl).pathname;
  } catch {
    // Malformed URL — fall back to the raw string rather than throwing. The fetch call
    // below will fail on its own and get logged through the same catch path.
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = { "Content-Type": "application/json" };
    if (ingestKey) headers["Authorization"] = `Bearer ${ingestKey}`;
    else console.warn(`[${logPrefix}] no ASTRIDR_INGEST_API_KEY set — posting unauthenticated (server may reject)`);

    const resp = await fetchImpl(endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      console.error(`[${logPrefix}] ${pathname} responded ${resp.status}: ${await resp.text()}`);
      return { ok: false, status: resp.status };
    }

    return { ok: true, status: resp.status };
  } catch (err) {
    console.error(`[${logPrefix}] ${pathname} failed: ${err.message}`);
    return { ok: false, status: null };
  } finally {
    clearTimeout(timeout);
  }
}
