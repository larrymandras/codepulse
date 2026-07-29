/**
 * activeEngineFilters.test.ts — the sentinel guard closing 103-UAT.md test 2.
 *
 * The fixture at the heart of this file is the EXACT row that was live in production on
 * 2026-07-29 (read off the self-hosted instance with `npx convex run activeEngine:latestByProfile`):
 *   { profileId: "unknown", model: "unknown", mode: "inherited", selectionPath: "default" }
 * That single row made the dashboard-wide badge render "unknown" as a confirmed-live engine.
 */

import { describe, it, expect } from "vitest";
import { isUnresolvedRouting, UNRESOLVED_SENTINEL } from "./activeEngineFilters";

describe("isUnresolvedRouting", () => {
  it("rejects the exact sentinel row that was live in production on 2026-07-29", () => {
    expect(
      isUnresolvedRouting({ profileId: "unknown", model: "unknown" })
    ).toBe(true);
  });

  it("rejects a row with a real profile but an unresolved model", () => {
    expect(isUnresolvedRouting({ profileId: "consulting", model: "unknown" })).toBe(true);
  });

  it("rejects a row with a real model but an unresolved profile", () => {
    expect(
      isUnresolvedRouting({ profileId: "unknown", model: "anthropic/claude-sonnet-5" })
    ).toBe(true);
  });

  it("rejects missing, empty, and whitespace-only fields", () => {
    expect(isUnresolvedRouting({})).toBe(true);
    expect(isUnresolvedRouting({ profileId: "", model: "" })).toBe(true);
    expect(isUnresolvedRouting({ profileId: "   ", model: "gpt-5" })).toBe(true);
    expect(isUnresolvedRouting({ profileId: "personal", model: "   " })).toBe(true);
    expect(isUnresolvedRouting({ profileId: null, model: null })).toBe(true);
  });

  it("ACCEPTS a genuine reading — the guard must not swallow real telemetry", () => {
    expect(
      isUnresolvedRouting({ profileId: "consulting", model: "anthropic/claude-sonnet-5" })
    ).toBe(false);
    expect(isUnresolvedRouting({ profileId: "personal", model: "codex-cli" })).toBe(false);
  });

  it("does not treat a model whose name merely CONTAINS the sentinel as unresolved", () => {
    // Guarding by substring instead of equality would silently drop real engines.
    expect(
      isUnresolvedRouting({ profileId: "business", model: "vendor/unknown-model-v2" })
    ).toBe(false);
    expect(isUnresolvedRouting({ profileId: "unknown-team", model: "gpt-5" })).toBe(false);
  });

  it("exports the sentinel it guards against", () => {
    expect(UNRESOLVED_SENTINEL).toBe("unknown");
  });
});
