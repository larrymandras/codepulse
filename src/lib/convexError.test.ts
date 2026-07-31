/**
 * Tests for src/lib/convexError.ts.
 *
 * Guards the Convex redaction contract: only `ConvexError`'s `.data` survives
 * to the client, plain `Error` messages are replaced with the literal "Server
 * Error". A helper that returned that placeholder as if it were a reason would
 * be strictly worse than the caller's own fallback copy.
 */
import { describe, it, expect } from "vitest";
import { convexErrorMessage } from "./convexError";

const FALLBACK = "Could not be saved.";

describe("convexErrorMessage", () => {
  it("returns a ConvexError's string .data verbatim", () => {
    expect(convexErrorMessage({ data: "A rate for claude-opus-5 already exists." }, FALLBACK)).toBe(
      "A rate for claude-opus-5 already exists."
    );
  });

  it("reads .data.message when .data is an object", () => {
    expect(convexErrorMessage({ data: { message: "Limit must be at most 100." } }, FALLBACK)).toBe(
      "Limit must be at most 100."
    );
  });

  it("falls back to Error.message for a non-Convex error", () => {
    expect(convexErrorMessage(new Error("Network request failed"), FALLBACK)).toBe(
      "Network request failed"
    );
  });

  it("returns the caller's fallback for Convex's redacted placeholder, never 'Server Error'", () => {
    // The whole point: a plain `throw new Error(...)` server-side arrives as
    // this placeholder, which carries no information for the user.
    expect(convexErrorMessage(new Error("Server Error"), FALLBACK)).toBe(FALLBACK);
    expect(convexErrorMessage(new Error("server error."), FALLBACK)).toBe(FALLBACK);
  });

  it("strips Convex's bracketed request-id framing", () => {
    expect(
      convexErrorMessage({ data: "[Request ID: abc123] Scope key is required." }, FALLBACK)
    ).toBe("Scope key is required.");
  });

  it("keeps only the first line, dropping stack-ish tails", () => {
    expect(convexErrorMessage({ data: "Bad rate.\n    at handler (foo.ts:1)" }, FALLBACK)).toBe(
      "Bad rate."
    );
  });

  it("returns the fallback for null, undefined, and empty values", () => {
    expect(convexErrorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(convexErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(convexErrorMessage({ data: "   " }, FALLBACK)).toBe(FALLBACK);
    expect(convexErrorMessage("a bare string", FALLBACK)).toBe(FALLBACK);
  });
});
