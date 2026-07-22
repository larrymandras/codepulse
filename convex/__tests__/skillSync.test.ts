import { describe, it, expect } from "vitest";
import {
  normalizeOrigin,
  computeSkillPrunes,
  groupSkillRowsByName,
  maxDefined,
} from "../skillSync";

describe("maxDefined", () => {
  it("returns the larger value", () => {
    expect(maxDefined(3, 7)).toBe(7);
    expect(maxDefined(7, 3)).toBe(7);
  });
  it("returns the defined one when the other is missing", () => {
    expect(maxDefined(undefined, 5)).toBe(5);
    expect(maxDefined(5, undefined)).toBe(5);
  });
  it("is undefined only when both are", () => {
    expect(maxDefined(undefined, undefined)).toBeUndefined();
  });
  it("never lets a scan erase dashboard launches", () => {
    // scanner read 2 from the usage log; the UI has recorded 9 clicks
    expect(maxDefined(2, 9)).toBe(9);
  });
  it("treats 0 as a real value, not as missing", () => {
    expect(maxDefined(0, undefined)).toBe(0);
    expect(maxDefined(undefined, 0)).toBe(0);
  });
});

describe("normalizeOrigin", () => {
  it("passes through a non-empty origin", () => {
    expect(normalizeOrigin("claude-code")).toBe("claude-code");
  });
  it("maps missing/empty origin to 'unknown'", () => {
    expect(normalizeOrigin(undefined)).toBe("unknown");
    expect(normalizeOrigin(null)).toBe("unknown");
    expect(normalizeOrigin("   ")).toBe("unknown");
  });
});

describe("computeSkillPrunes", () => {
  const cc = { _id: "1", name: "deploy", origin: "claude-code" };
  const ccGone = { _id: "2", name: "old-cc", origin: "claude-code" };
  const native = { _id: "3", name: "asi-briefing", origin: "cc" };
  const proj = { _id: "4", name: "repo-skill", origin: "claude-code:project:abc" };

  it("prunes only same-origin rows absent from the snapshot", () => {
    const prunes = computeSkillPrunes(
      [cc, ccGone, native, proj],
      [{ name: "deploy", origin: "claude-code" }]
    );
    expect(prunes.map((p) => p._id)).toEqual(["2"]); // ccGone only
  });

  it("never prunes an origin absent from the snapshot", () => {
    const prunes = computeSkillPrunes(
      [cc, native],
      [{ name: "asi-briefing", origin: "cc" }] // only native origin present
    );
    expect(prunes.map((p) => p._id)).toEqual([]); // cc untouched
  });

  it("handles a multi-origin snapshot with per-origin name sets", () => {
    // 'deploy' exists under claude-code; a project row with the SAME name
    // must NOT be preserved by the global presence of 'deploy'.
    const projDeployGone = { _id: "5", name: "deploy", origin: "claude-code:project:abc" };
    const prunes = computeSkillPrunes(
      [cc, projDeployGone],
      [
        { name: "deploy", origin: "claude-code" },
        { name: "repo-skill", origin: "claude-code:project:abc" },
      ]
    );
    expect(prunes.map((p) => p._id)).toEqual(["5"]); // project 'deploy' pruned
  });

  it("treats missing origin as 'unknown' on both sides", () => {
    const legacy = { _id: "6", name: "legacy", origin: undefined };
    const prunes = computeSkillPrunes([legacy], [{ name: "other" }]);
    expect(prunes.map((p) => p._id)).toEqual(["6"]);
  });

  // ---------------------------------------------------------------------
  // scannedOrigins manifest (98-05 gap closure)
  // ---------------------------------------------------------------------

  it("REGRESSION: a declared-but-empty origin (in scannedOrigins, absent from incoming) prunes all its rows", () => {
    const prunes = computeSkillPrunes(
      [cc, proj],
      [{ name: "deploy", origin: "claude-code" }],
      ["claude-code", "claude-code:project:abc"]
    );
    expect(prunes.map((p) => p._id)).toEqual(["4"]); // proj pruned — declared-but-empty
  });

  it("REGRESSION: an undeclared origin (not in scannedOrigins, not in incoming) stays untouched", () => {
    const prunes = computeSkillPrunes(
      [cc, proj],
      [{ name: "deploy", origin: "claude-code" }],
      ["claude-code"] // proj's origin is NOT declared
    );
    expect(prunes.map((p) => p._id)).toEqual([]); // proj untouched — unscanned/unreachable
  });

  it("backward-compat: omitting scannedOrigins reproduces the legacy 'never prune an absent origin' result", () => {
    const prunes = computeSkillPrunes(
      [cc, proj],
      [{ name: "deploy", origin: "claude-code" }]
      // no third arg
    );
    expect(prunes.map((p) => p._id)).toEqual([]); // proj untouched, same as today
  });

  it("a declared origin present in incoming still prunes only its own missing names (no over-pruning)", () => {
    const projDeployGone = { _id: "5", name: "deploy", origin: "claude-code:project:abc" };
    const prunes = computeSkillPrunes(
      [cc, projDeployGone],
      [
        { name: "deploy", origin: "claude-code" },
        { name: "repo-skill", origin: "claude-code:project:abc" },
      ],
      ["claude-code", "claude-code:project:abc"]
    );
    expect(prunes.map((p) => p._id)).toEqual(["5"]); // only the stale project 'deploy' pruned
  });
});

describe("groupSkillRowsByName", () => {
  it("collapses (name, origin) rows into one entry with sorted origins", () => {
    const grouped = groupSkillRowsByName([
      { name: "deploy", origin: "cc", discoveredAt: 10, useCount: 2 },
      { name: "deploy", origin: "claude-code", discoveredAt: 5, description: "Deploy it", useCount: 3, lastUsedAt: 99 },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].origins).toEqual(["cc", "claude-code"]);
    expect(grouped[0].description).toBe("Deploy it");
    expect(grouped[0].discoveredAt).toBe(5);
    expect(grouped[0].useCount).toBe(5);
    expect(grouped[0].lastUsedAt).toBe(99);
  });

  it("returns [] for empty input", () => {
    expect(groupSkillRowsByName([])).toEqual([]);
  });
});
