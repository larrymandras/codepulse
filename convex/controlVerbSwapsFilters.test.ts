import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isBrainSwap, SWAP_HISTORY_CAP, mergeSwapHistory } from "./controlVerbSwapsFilters";

// Tests for Phase 109 (TELE-02, D-11): controlVerbSwapsFilters.ts's mergeSwapHistory helper.
// isBrainSwap/SWAP_HISTORY_CAP already have their own coverage in controlVerbSwaps.test.ts
// (which imports them from this same module) — this file focuses on mergeSwapHistory and the
// WR-02 dependency-free property this module exists to protect.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Strip full-line comments so a docstring that legitimately explains WHY this module avoids
 * `_generated`/`convex/values` imports cannot pollute the source-level guard below. Copied
 * verbatim from controlVerbSwaps.test.ts. */
function stripCommentLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
}

type Row = { _id: string; timestamp: number };

function row(_id: string, timestamp: number): Row {
  return { _id, timestamp };
}

describe("mergeSwapHistory — descending order across interleaved timestamps (Phase 109, D-11)", () => {
  it("sorts scoped and global rows into one descending-by-timestamp list", () => {
    const scoped = [row("s1", 100), row("s2", 300)];
    const global = [row("g1", 200), row("g2", 400)];

    const { rows } = mergeSwapHistory(scoped, global);

    expect(rows.map((r) => r._id)).toEqual(["g2", "s2", "g1", "s1"]);
    expect(rows.map((r) => r.timestamp)).toEqual([400, 300, 200, 100]);
  });
});

describe("mergeSwapHistory — origin tagging (Phase 109, D-11)", () => {
  it("tags every row with the origin discriminant driven by its source array, never re-derived from a field", () => {
    const scoped = [row("s1", 100)];
    const global = [row("g1", 200)];

    const { rows } = mergeSwapHistory(scoped, global);

    const scopedRow = rows.find((r) => r._id === "s1");
    const globalRow = rows.find((r) => r._id === "g1");
    expect(scopedRow?.origin).toBe("scoped");
    expect(globalRow?.origin).toBe("global");
  });
});

describe("mergeSwapHistory — combined cap (Phase 109, D-11)", () => {
  it("caps a 25+25 input at exactly 20 rows while reporting the true pre-truncation count of 50", () => {
    const scoped = Array.from({ length: 25 }, (_, i) => row(`s${i}`, i));
    const global = Array.from({ length: 25 }, (_, i) => row(`g${i}`, i + 1000));

    const { rows, totalCount } = mergeSwapHistory(scoped, global);

    expect(rows.length).toBe(20);
    expect(rows.length).toBe(SWAP_HISTORY_CAP);
    expect(totalCount).toBe(50);
  });
});

describe("mergeSwapHistory — deterministic tie-break (Phase 109, D-11)", () => {
  it("produces byte-identical output for two identical-timestamp rows fed in either input order", () => {
    const a = row("aaa", 500);
    const b = row("bbb", 500);

    const orderOne = mergeSwapHistory([a], [b]);
    const orderTwo = mergeSwapHistory([b], [a]);

    // Both orderings place scoped/global rows in the SAME arrays passed in either call — what
    // varies between the two calls is which array ("scoped" vs "global") each row comes from,
    // so what must be identical is the resulting _id ORDER, independent of call argument order.
    expect(orderOne.rows.map((r) => r._id)).toEqual(orderTwo.rows.map((r) => r._id));
    expect(orderOne.rows.map((r) => r._id)).toEqual(["aaa", "bbb"]);
    expect(orderOne.totalCount).toBe(orderTwo.totalCount);
  });

  it("breaks a same-array tie deterministically by _id, independent of input array order", () => {
    const x = row("xxx", 700);
    const y = row("yyy", 700);

    const forward = mergeSwapHistory([x, y], []);
    const reversed = mergeSwapHistory([y, x], []);

    expect(forward.rows.map((r) => r._id)).toEqual(["xxx", "yyy"]);
    expect(reversed.rows.map((r) => r._id)).toEqual(["xxx", "yyy"]);
  });
});

describe("mergeSwapHistory — empty inputs (Phase 109, D-11)", () => {
  it("returns { rows: [], totalCount: 0 } for empty + empty", () => {
    const result = mergeSwapHistory([], []);
    expect(result).toEqual({ rows: [], totalCount: 0 });
  });
});

// WR-02 guard: this module must stay importable from browser code with zero risk of dragging in
// the Convex server runtime. A value-import of `_generated/server` or `convex/values` here would
// reintroduce the exact bundling defect found at runtime after 108-06 shipped (108-REVIEW.md).
describe("WR-02 — dependency-free module (source-level guard)", () => {
  const filtersPath = path.resolve(__dirname, "./controlVerbSwapsFilters.ts");

  it("contains no _generated import and no convex/values import (comment-stripped source)", () => {
    // Comment-stripped: this module's own docstrings legitimately explain WHY it avoids these
    // imports (naming them in prose), so a raw substring match against the full file would flag
    // documentation as a violation. Sanity check on the stripping itself, mirroring
    // controlVerbSwaps.test.ts's CR-01 block: the RAW file DOES contain both strings in prose —
    // if it didn't, the negative assertions below would be vacuous.
    const raw = readFileSync(filtersPath, "utf-8");
    expect(raw).toMatch(/_generated/);
    expect(raw).toMatch(/convex\/values/);

    const source = stripCommentLines(raw);
    expect(source).not.toMatch(/_generated/);
    expect(source).not.toMatch(/convex\/values/);
  });

  it("exports mergeSwapHistory exactly once", () => {
    const source = readFileSync(filtersPath, "utf-8");
    const matches = source.match(/export function mergeSwapHistory/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

// Sanity check: isBrainSwap re-imported here still behaves as documented (guards against this
// test file and controlVerbSwaps.test.ts silently drifting on which module owns the predicate).
describe("isBrainSwap — re-import sanity (imported from this module, same as controlVerbSwaps.ts)", () => {
  it("returns true only for swap_model", () => {
    expect(isBrainSwap({ verb: "swap_model" })).toBe(true);
    expect(isBrainSwap({ verb: "swap_voice" })).toBe(false);
  });
});
