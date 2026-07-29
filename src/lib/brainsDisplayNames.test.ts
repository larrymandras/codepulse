/**
 * brainsDisplayNames.test.ts — UAT cosmetic follow-up (2026-07-29).
 *
 * Raw model ids were leaking into operator-facing copy in four places while a real display name was
 * available. The fixtures here are the EXACT live values observed during the UAT run, including the
 * vendor-prefix mismatch that made the previous exact-id lookup impossible to hit:
 *   - `profileConfigs.modelPreferences.primary` = "anthropic/claude-sonnet-5"  (vendor-prefixed)
 *   - live `swap.catalogue` id                  = "claude-sonnet-5"           (bare)
 */

import { describe, it, expect } from "vitest";
import {
  buildModelNameMap,
  resolveModelDisplayName,
  type CatalogueEntry,
} from "./brainsApi";

function entry(id: string, name: string, vendor = "anthropic"): CatalogueEntry {
  return { id, name, vendor, group: "api", billing: "api", costTier: "normal" };
}

/** The shape the live catalogue actually returned during the UAT. */
const LIVE: CatalogueEntry[] = [
  entry("claude-sonnet-5", "Claude Sonnet 5"),
  entry("claude-haiku-4-5-20251001", "Claude Haiku 4.5"),
  entry("codex-cli", "Codex CLI", "codex"),
];

describe("resolveModelDisplayName", () => {
  it("resolves an exact catalogue id", () => {
    expect(resolveModelDisplayName("claude-sonnet-5", LIVE)).toBe("Claude Sonnet 5");
  });

  it("resolves the vendor-prefixed CONFIG id against a bare catalogue id (the OBS 8 warning case)", () => {
    // This is the one that mattered: the confirm modal's shadowing warning read
    // "3 profiles have a pinned default (anthropic/claude-sonnet-5)".
    expect(resolveModelDisplayName("anthropic/claude-sonnet-5", LIVE)).toBe("Claude Sonnet 5");
  });

  it("resolves the date-stamped id that the revert result leaked", () => {
    // "Reverted to claude-haiku-4-5-20251001." should read "Reverted to Claude Haiku 4.5."
    expect(resolveModelDisplayName("claude-haiku-4-5-20251001", LIVE)).toBe("Claude Haiku 4.5");
  });

  it("returns the id UNCHANGED when the catalogue has no match — never a fabricated name", () => {
    expect(resolveModelDisplayName("some/unknown-model-v9", LIVE)).toBe("some/unknown-model-v9");
    // Specifically: it must not prettify. "claude-haiku-4-5-20251001" title-cased would read
    // "Claude Haiku 4 5 20251001", which is worse than the id and is invented product naming.
    expect(resolveModelDisplayName("mystery-engine-7-20260101", LIVE)).toBe(
      "mystery-engine-7-20260101"
    );
  });

  it("survives an empty, null, or undefined catalogue by returning the id", () => {
    expect(resolveModelDisplayName("claude-sonnet-5", [])).toBe("claude-sonnet-5");
    expect(resolveModelDisplayName("claude-sonnet-5", null)).toBe("claude-sonnet-5");
    expect(resolveModelDisplayName("claude-sonnet-5", undefined)).toBe("claude-sonnet-5");
  });

  it("prefers an exact match over a vendor-stripped one when both exist", () => {
    const ambiguous: CatalogueEntry[] = [
      entry("vendor-a/shared-id", "From Vendor A"),
      entry("shared-id", "Bare Entry"),
    ];
    expect(resolveModelDisplayName("shared-id", ambiguous)).toBe("Bare Entry");
    expect(resolveModelDisplayName("vendor-a/shared-id", ambiguous)).toBe("From Vendor A");
  });
});

describe("buildModelNameMap", () => {
  it("keys every entry by both its raw id and its vendor-stripped id", () => {
    const map = buildModelNameMap([entry("anthropic/claude-opus-5", "Claude Opus 5")]);
    expect(map["anthropic/claude-opus-5"]).toBe("Claude Opus 5");
    expect(map["claude-opus-5"]).toBe("Claude Opus 5");
  });

  it("lets an exact bare id win over another entry's stripped alias", () => {
    const map = buildModelNameMap([
      entry("shared-id", "Bare Entry"),
      entry("vendor-a/shared-id", "From Vendor A"),
    ]);
    expect(map["shared-id"]).toBe("Bare Entry");
  });

  it("returns an empty map for an empty or missing catalogue", () => {
    expect(buildModelNameMap([])).toEqual({});
    expect(buildModelNameMap(null)).toEqual({});
    expect(buildModelNameMap(undefined)).toEqual({});
  });

  it("covers every live id the UAT observed", () => {
    const map = buildModelNameMap(LIVE);
    expect(map["claude-sonnet-5"]).toBe("Claude Sonnet 5");
    expect(map["claude-haiku-4-5-20251001"]).toBe("Claude Haiku 4.5");
    expect(map["codex-cli"]).toBe("Codex CLI");
  });
});
