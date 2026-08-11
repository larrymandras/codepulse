import { describe, it, expect } from "vitest";
import {
  normalizeOrigin,
  computeSkillPrunes,
  computePruneRefusals,
  groupSkillRowsByName,
  maxDefined,
  sanitizeScannedOrigins,
  sanitizeScannedOriginsComplete,
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

describe("sanitizeScannedOrigins (GC-03)", () => {
  const cc = { _id: "1", name: "deploy", origin: "claude-code" };
  const proj = { _id: "4", name: "repo-skill", origin: "claude-code:project:abc" };

  it("passes a real array through unchanged", () => {
    const manifest = ["claude-code", "claude-code:available"];
    expect(sanitizeScannedOrigins(manifest)).toBe(manifest);
    expect(sanitizeScannedOrigins([])).toEqual([]);
  });

  it("maps every non-array shape to undefined (object, number, string, null, undefined)", () => {
    expect(sanitizeScannedOrigins({})).toBeUndefined();
    expect(sanitizeScannedOrigins(42)).toBeUndefined();
    // A string is iterable — passing it through would pollute prunableOrigins
    // with one-character origins; it must be rejected too.
    expect(sanitizeScannedOrigins("claude-code")).toBeUndefined();
    expect(sanitizeScannedOrigins(null)).toBeUndefined();
    expect(sanitizeScannedOrigins(undefined)).toBeUndefined();
  });

  it("REGRESSION: a malformed manifest degrades to legacy prune behavior instead of throwing mid-sync", () => {
    // Pre-fix, snap.skills.length > 0 passed the guard and the raw `{}` reached
    // computeSkillPrunes' for..of → TypeError → whole sync rolled back.
    const prunes = computeSkillPrunes(
      [cc, proj],
      [{ name: "deploy", origin: "claude-code" }],
      sanitizeScannedOrigins({})
    );
    expect(prunes.map((p) => p._id)).toEqual([]); // proj untouched — legacy path
  });
});

describe("computeSkillPrunes — exhaustive-coverage guard (DEBT-05, D-03)", () => {
  // Fixture: a `claude-code` personal skill plus 3 `claude-code:plugin` skills.
  // "incoming carrying only the claude-code rows" (the plan's shorthand) is
  // realized here as a PARTIAL plugin read — the real DEBT-05/D-03 shape per
  // the plan's own <behavior> section ("An origin present in `incoming` but
  // NOT declared is not prunable — this is the plugin case and the whole
  // point of the guard"): 1 of 3 plugin skills came through before the read
  // stopped, and scannedOrigins honestly does NOT declare claude-code:plugin
  // covered (the read was not exhaustive). A fixture where incoming carries
  // literally zero plugin-origin rows can never distinguish strict from
  // additive mode — both already leave an origin absent from BOTH incoming
  // and scannedOrigins untouched (see the pre-existing GC-03 "undeclared
  // origin" test above) — so it would make the control below non-load-bearing.
  const ccDeploy = { _id: "20", name: "deploy", origin: "claude-code" };
  const pluginA = { _id: "21", name: "plugin-a", origin: "claude-code:plugin" };
  const pluginB = { _id: "22", name: "plugin-b", origin: "claude-code:plugin" };
  const pluginC = { _id: "23", name: "plugin-c", origin: "claude-code:plugin" };

  it("REGRESSION: an exhaustive declaration that omits claude-code:plugin protects it, even though incoming carries a partial plugin read", () => {
    const prunes = computeSkillPrunes(
      [ccDeploy, pluginA, pluginB, pluginC],
      [
        { name: "deploy", origin: "claude-code" },
        { name: "plugin-a", origin: "claude-code:plugin" },
      ],
      ["claude-code"], // scannedOrigins does NOT declare claude-code:plugin
      true // scannedOriginsComplete
    );
    expect(prunes.map((p) => p._id)).toEqual([]); // none of the plugin rows pruned
  });

  it("CONTROL: the identical existing/incoming/scannedOrigins inputs with scannedOriginsComplete omitted DO prune the undeclared-but-missing claude-code:plugin rows — proving the guard above is load-bearing", () => {
    const prunes = computeSkillPrunes(
      [ccDeploy, pluginA, pluginB, pluginC],
      [
        { name: "deploy", origin: "claude-code" },
        { name: "plugin-a", origin: "claude-code:plugin" },
      ],
      ["claude-code"]
      // scannedOriginsComplete omitted -> additive/legacy path
    );
    expect(prunes.map((p) => p._id).sort()).toEqual(["22", "23"]); // pluginB, pluginC wrongly pruned without the guard
  });

  it("backward-compat: a native/bridge-shaped snapshot with no manifest at all prunes exactly the legacy rows (the 410 astridr rows stay prunable by their own producers)", () => {
    const nativeStale = { _id: "30", name: "old-skill", origin: "native" };
    const nativeCurrent = { _id: "31", name: "current-skill", origin: "native" };
    const prunes = computeSkillPrunes(
      [nativeStale, nativeCurrent],
      [{ name: "current-skill", origin: "native" }]
      // no scannedOrigins, no scannedOriginsComplete -- exactly today's native/bridge shape
    );
    expect(prunes.map((p) => p._id)).toEqual(["30"]);
  });

  it("a declared origin with zero incoming rows still prunes all of them under the strict/exhaustive path (98-05 emptied-project case survives)", () => {
    const projSkillA = { _id: "40", name: "old-a", origin: "claude-code:project:xyz" };
    const projSkillB = { _id: "41", name: "old-b", origin: "claude-code:project:xyz" };
    const prunes = computeSkillPrunes(
      [ccDeploy, projSkillA, projSkillB],
      [{ name: "deploy", origin: "claude-code" }], // zero incoming for the project origin
      ["claude-code", "claude-code:project:xyz"],
      true
    );
    expect(prunes.map((p) => p._id).sort()).toEqual(["40", "41"]);
  });

  it("REGRESSION: each malformed scannedOriginsComplete shape, composed through sanitizeScannedOriginsComplete, degrades to the additive/legacy path instead of engaging strict mode", () => {
    for (const malformed of ["true", 1, {}, null]) {
      const prunes = computeSkillPrunes(
        [ccDeploy, pluginA, pluginB, pluginC],
        [
          { name: "deploy", origin: "claude-code" },
          { name: "plugin-a", origin: "claude-code:plugin" },
        ],
        ["claude-code"],
        sanitizeScannedOriginsComplete(malformed)
      );
      // Same result as the CONTROL above: additive/legacy path prunes the
      // undeclared-but-missing plugin rows.
      expect(prunes.map((p) => p._id).sort()).toEqual(["22", "23"]);
    }
  });
});

describe("sanitizeScannedOriginsComplete (DEBT-05, D-03)", () => {
  it("accepts only a literal boolean true", () => {
    expect(sanitizeScannedOriginsComplete(true)).toBe(true);
  });

  it("REGRESSION: rejects everything else — a truthy string/number/object/null must not engage the strict path", () => {
    expect(sanitizeScannedOriginsComplete("true")).toBe(false);
    expect(sanitizeScannedOriginsComplete(1)).toBe(false);
    expect(sanitizeScannedOriginsComplete({})).toBe(false);
    expect(sanitizeScannedOriginsComplete(null)).toBe(false);
    expect(sanitizeScannedOriginsComplete(undefined)).toBe(false);
    expect(sanitizeScannedOriginsComplete(false)).toBe(false);
  });
});

describe("computePruneRefusals (DEBT-05, D-05)", () => {
  it("names a 7-row protected origin with sampleNames capped at 5", () => {
    const ccDeploy = { _id: "20", name: "deploy", origin: "claude-code" };
    const pluginRows = Array.from({ length: 7 }, (_, i) => ({
      _id: `p${i}`,
      name: `plugin-${i}`,
      origin: "claude-code:plugin",
    }));
    const incoming = [
      { name: "deploy", origin: "claude-code" },
      // Decoy entry: puts claude-code:plugin into the incoming-origins set
      // (so the additive/legacy verdict actually prunes something to diff
      // against) without matching any of the 7 existing rows by name.
      { name: "plugin-decoy", origin: "claude-code:plugin" },
    ];
    const refusals = computePruneRefusals(
      [ccDeploy, ...pluginRows],
      incoming,
      ["claude-code"], // claude-code:plugin not declared
      true
    );
    expect(refusals).toHaveLength(1);
    expect(refusals[0].origin).toBe("claude-code:plugin");
    expect(refusals[0].protectedCount).toBe(7);
    expect(refusals[0].sampleNames).toHaveLength(5);
  });

  it("returns [] when the strict path is not engaged (legacy path)", () => {
    const ccDeploy = { _id: "20", name: "deploy", origin: "claude-code" };
    const pluginA = { _id: "21", name: "plugin-a", origin: "claude-code:plugin" };
    const refusals = computePruneRefusals(
      [ccDeploy, pluginA],
      [{ name: "deploy", origin: "claude-code" }],
      ["claude-code"]
      // scannedOriginsComplete omitted
    );
    expect(refusals).toEqual([]);
  });
});

// DEFECT 2 (adversarial gate on 113-02): computePruneRefusals' `strictPrunedIds` exclusion
// filter (skillSync.ts:146) was DEAD in every existing fixture — replacing it with an empty
// Set left all pre-existing tests green, because every fixture's "declared" origin never also
// held a row that was genuinely stale (i.e. legitimately pruned under BOTH the legacy and the
// strict rule). Without a row like that, `legacyPrunes` and `strictPrunes` never overlap on a
// declared origin, so the `if (strictPrunedIds.has(row._id)) continue` line never had anything
// to skip — the filter looked exercised but was never actually discriminating anything.
describe("computePruneRefusals — discriminates a row still pruned under strict mode from a row protected by it (defect 2)", () => {
  it("REGRESSION: a stale row in a DECLARED origin is genuinely pruned and NOT reported as a refusal, while a row in an undeclared origin is both protected and reported", () => {
    const ccDeploy = { _id: "60", name: "deploy", origin: "claude-code" };
    // Genuinely stale: declared covered (claude-code IS in scannedOrigins) and absent from
    // incoming — this row must be deleted under BOTH the additive/legacy rule and the strict
    // rule, so it must never show up as a "refusal."
    const ccStale = { _id: "61", name: "stale-cc-skill", origin: "claude-code" };
    // Protected: origin NOT declared, so the strict rule must refuse to prune it even though
    // the additive/legacy rule would.
    const pluginA = { _id: "62", name: "plugin-a", origin: "claude-code:plugin" };

    const incoming = [
      { name: "deploy", origin: "claude-code" },
      // Decoy: without an incoming row under claude-code:plugin, that origin would never be
      // prunable under the additive/legacy baseline either (computeSkillPrunes' additive mode
      // seeds prunableOrigins from BOTH incoming origins and scannedOrigins), which would make
      // pluginA non-discriminating too. This decoy is what makes claude-code:plugin actually
      // prunable under the legacy baseline, so the strict rule's protection of it is a real,
      // observable difference — not a case that was never going to prune it either way.
      { name: "plugin-decoy", origin: "claude-code:plugin" },
    ];

    const refusals = computePruneRefusals(
      [ccDeploy, ccStale, pluginA],
      incoming,
      ["claude-code"], // declared: claude-code only — claude-code:plugin is NOT declared
      true
    );

    expect(refusals).toHaveLength(1);
    expect(refusals[0].origin).toBe("claude-code:plugin");
    expect(refusals[0].sampleNames).toEqual(["plugin-a"]);

    // Confirm ccStale (the declared-origin row) was ACTUALLY pruned under the strict rule —
    // proving its absence from `refusals` reflects "correctly deleted," not "silently missed."
    const strictPrunes = computeSkillPrunes([ccDeploy, ccStale, pluginA], incoming, ["claude-code"], true);
    expect(strictPrunes.map((p) => p._id)).toEqual(["61"]);
  });
});

describe("computePruneRefusals — alert payload contract (D-05)", () => {
  const ccDeploy = { _id: "20", name: "deploy", origin: "claude-code" };
  const pluginRows = Array.from({ length: 7 }, (_, i) => ({
    _id: `p${i}`,
    name: `plugin-${i}`,
    origin: "claude-code:plugin",
  }));
  const projRows = [
    { _id: "proj0", name: "proj-0", origin: "claude-code:project:abc" },
    { _id: "proj1", name: "proj-1", origin: "claude-code:project:abc" },
  ];
  const incoming = [
    { name: "deploy", origin: "claude-code" },
    { name: "plugin-decoy", origin: "claude-code:plugin" },
    { name: "proj-decoy", origin: "claude-code:project:abc" },
  ];
  // DEFECT 3 (adversarial gate on 113-02): `existing`'s natural insertion order used to be
  // [ccDeploy, ...pluginRows, ...projRows], which is ALREADY alphabetical by origin
  // ("claude-code:plugin" < "claude-code:project:abc") — deleting the `.sort()` call in
  // computePruneRefusals left this fixture green by luck, not by proof. Insertion order here
  // deliberately CONTRADICTS alphabetical order (project rows first, then plugin rows) so the
  // `.sort()` call is the only thing that can make the assertion below pass.
  const refusals = computePruneRefusals(
    [...projRows, ccDeploy, ...pluginRows],
    incoming,
    ["claude-code"], // neither claude-code:plugin nor claude-code:project:abc declared
    true
  );

  it("sorts the result by origin ascending, one entry per protected origin, exact keys only", () => {
    expect(refusals.map((r) => r.origin)).toEqual([
      "claude-code:plugin",
      "claude-code:project:abc",
    ]);
    for (const r of refusals) {
      expect(Object.keys(r).sort()).toEqual(["origin", "protectedCount", "sampleNames"]);
    }
  });

  it("protectedCount is the exact real number of protected rows per origin", () => {
    expect(refusals[0].protectedCount).toBe(7);
    expect(refusals[1].protectedCount).toBe(2);
  });

  it("sampleNames is capped at 5 for the 7-row origin, uncapped (2) for the 2-row origin, and every name is drawn from the existing fixture", () => {
    expect(refusals[0].sampleNames).toHaveLength(5);
    expect(refusals[1].sampleNames).toHaveLength(2);
    const allExistingPluginNames = new Set(pluginRows.map((r) => r.name));
    const allExistingProjNames = new Set(projRows.map((r) => r.name));
    for (const n of refusals[0].sampleNames) expect(allExistingPluginNames.has(n)).toBe(true);
    for (const n of refusals[1].sampleNames) expect(allExistingProjNames.has(n)).toBe(true);
  });

  it("D-06: a fully-covered healthy scan (every existing origin declared, incoming matching) produces zero refusals", () => {
    const pluginA = { _id: "50", name: "plugin-a", origin: "claude-code:plugin" };
    const pluginB = { _id: "51", name: "plugin-b", origin: "claude-code:plugin" };
    const pluginC = { _id: "52", name: "plugin-c", origin: "claude-code:plugin" };
    const existing = [ccDeploy, pluginA, pluginB, pluginC];
    const incomingHealthy = [
      { name: "deploy", origin: "claude-code" },
      { name: "plugin-a", origin: "claude-code:plugin" },
      { name: "plugin-b", origin: "claude-code:plugin" },
      { name: "plugin-c", origin: "claude-code:plugin" },
    ];
    const healthyRefusals = computePruneRefusals(
      existing,
      incomingHealthy,
      ["claude-code", "claude-code:plugin"], // every existing origin declared
      true
    );
    expect(healthyRefusals).toEqual([]);
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
