// ---------------------------------------------------------------------------
// Convex error message extraction.
//
// Convex REDACTS plain-`Error` messages to the literal string "Server Error"
// on the client, so a bare `catch { toast.error("generic") }` throws away every
// actionable reason a mutation gave (duplicate row, out-of-range rate, auth
// refusal). Only `ConvexError`'s `.data` survives redaction, and it must be
// checked BEFORE `.message`.
//
// Same contract as `lifecycleRefusalMessage` in src/hooks/useLifecycle.ts,
// generalized so any admin surface can surface a real reason.
// ---------------------------------------------------------------------------

/**
 * Pull a human-readable reason out of a rejected Convex mutation.
 *
 * @param err       the caught value (unknown by design — never assume Error)
 * @param fallback  shown when the error carries nothing usable, or when the
 *                  message is Convex's redacted placeholder
 */
export function convexErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: unknown } | null)?.data;
  const raw =
    typeof data === "string"
      ? data
      : data != null && typeof data === "object" && typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : err instanceof Error
          ? err.message
          : "";

  // Strip Convex's server-side framing (e.g. `[Request ID: …] Server Error`)
  // and keep only the first line — stack-ish tails are not user-facing copy.
  const message = raw.split("\n")[0].replace(/^\[[^\]]*\]\s*/, "").trim();

  // "Server Error" is the redaction placeholder, not a reason: a plain Error
  // reached us, so there is nothing to show and the caller's copy is better.
  if (!message || /^server error\.?$/i.test(message)) return fallback;
  return message;
}
