/**
 * boundedReads.ratchet.test.ts — stop the SWEEP-01 defect class from growing.
 *
 * THE DEFECT. In Convex, `.filter()` runs on rows ALREADY READ — it does not
 * bound the index scan. So this shape reads everything the index prefix
 * selects and discards the rest in JS:
 *
 *     .withIndex("by_status", q => q.eq("status", "completed"))
 *     .filter(q => q.gte(q.field("lastEventAt"), dayStart))   // <-- POST-READ
 *     .collect()
 *
 * It has bitten this repo repeatedly and silently: `automation.cronSummary`
 * (fixed), three separate reads inside `getDailyDigestDataInternal` (fixed),
 * and `evalScores`' sample query, which was a byte-for-byte clone of the
 * sessions one and which nobody had noticed. Every instance was found by
 * hand, after the fact. This ratchet finds the NEXT one at authoring time.
 *
 * WHAT IT FLAGS, precisely: a RANGE comparison (`gte`/`gt`/`lte`/`lt`) inside a
 * post-read `.filter()`. Not `.filter()` itself — `.filter(q => q.neq(
 * q.field("archived"), true))` after a properly bounded index is correct and
 * common (`events.ts` does it deliberately). A range is specifically the thing
 * an index CAN bound, and therefore the thing that should have been pushed into
 * `withIndex`.
 *
 * WHAT IT DELIBERATELY DOES NOT FLAG: a bare `.withIndex("name")` with no range
 * callback. Measured 2026-08-27: 127 of those exist and the overwhelming
 * majority are correct — a bare index followed by `.order("desc").take(50)` is
 * properly bounded. Flagging them would produce a ratchet that cries wolf 127
 * times, which is a ratchet nobody keeps.
 *
 * THE ALLOWLIST IS THE POINT. New violations fail; the known ones are pinned
 * with a reason each, so this cannot quietly become a rubber stamp. If you are
 * here because the test went red: push the range into `withIndex`. Add to the
 * allowlist only if the field genuinely is not in any usable index, and say so.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Range comparison inside a post-read filter callback. */
const RANGE_IN_FILTER = /q\.(gte|gt|lte|lt)\(\s*q\.field\(/;

/** Full-line comments. C-family: a `#`-based filter is a SILENT no-op on
 * TypeScript, which is the documented trap this pattern exists to avoid. */
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/;

/**
 * Known instances, each with the reason it is not simply fixable. Keyed
 * `file:line-ish` by FILE only — line numbers churn, so the allowlist counts
 * per file rather than pinning positions, which would make every unrelated
 * edit above them a false failure.
 */
const ALLOWED: Record<string, { count: number; why: string }> = {
  "briefings.ts": {
    count: 4,
    why:
      "listBriefings uses .paginate(), not .collect(), and queries with NO index " +
      "at all — the page size bounds the read. A different shape from the " +
      "collect-everything defect; pushing a range in would require an index on " +
      "generatedAt that no query currently needs.",
  },
  "forge.ts": {
    count: 1,
    why:
      "claimCommands filters on `expiresAt`, which is not a field of " +
      "by_host_status_created ([hostId, status, createdAt]) — so the range " +
      "CANNOT be pushed into that index. Bounded by .take(10) instead.",
  },
};

function convexSourceFiles(): string[] {
  return readdirSync(__dirname)
    .filter((f) => f.endsWith(".ts"))
    .filter((f) => !f.endsWith(".test.ts") && f !== "schema.ts")
    .sort();
}

function scan() {
  const violations: Array<{ file: string; line: number; text: string }> = [];
  let controlWithIndex = 0;

  for (const file of convexSourceFiles()) {
    const src = readFileSync(path.join(__dirname, file), "utf-8");
    src.split("\n").forEach((text, i) => {
      if (COMMENT_LINE.test(text)) return;
      controlWithIndex += (text.match(/\.withIndex\(/g) ?? []).length;
      if (RANGE_IN_FILTER.test(text)) {
        violations.push({ file, line: i + 1, text: text.trim() });
      }
    });
  }
  return { violations, controlWithIndex };
}

describe("bounded reads — the scan itself must be able to find things", () => {
  it("sees a non-trivial number of .withIndex( calls (control)", () => {
    // Without this, a scan whose glob or comment-stripping silently matched
    // NOTHING would report zero violations and look like a clean bill of
    // health. A zero is only meaningful once the probe is shown to be live.
    const { controlWithIndex } = scan();
    expect(controlWithIndex).toBeGreaterThan(100);
  });

  it("its regex actually matches the defect shape (control)", () => {
    expect(RANGE_IN_FILTER.test('q.gte(q.field("lastEventAt"), dayStart)')).toBe(true);
    expect(RANGE_IN_FILTER.test('q.lt(q.field("detectedAt"), dayEnd)')).toBe(true);
    // ...and does NOT match the legitimate non-range post-read filter.
    expect(RANGE_IN_FILTER.test('q.neq(q.field("archived"), true)')).toBe(false);
    expect(RANGE_IN_FILTER.test('q.eq(q.field("status"), "queued")')).toBe(false);
  });

  it("comment-stripping does not swallow real code (control)", () => {
    expect(COMMENT_LINE.test("    // q.gte(q.field(\"x\"), y)")).toBe(true);
    expect(COMMENT_LINE.test("      .filter((q) => q.gte(q.field(\"x\"), y))")).toBe(false);
  });
});

describe("bounded reads — no NEW range-in-post-read-filter may be introduced", () => {
  it("every violation is in the allowlist, and no file exceeds its pinned count", () => {
    const { violations } = scan();

    const byFile: Record<string, typeof violations> = {};
    for (const v of violations) {
      (byFile[v.file] ??= []).push(v);
    }

    const unexpected: string[] = [];
    for (const [file, hits] of Object.entries(byFile)) {
      const allowed = ALLOWED[file];
      if (!allowed) {
        unexpected.push(
          `${file}: ${hits.length} range comparison(s) in a post-read .filter() — ` +
            `push the range into withIndex, e.g. ` +
            `.withIndex("by_x", q => q.eq(...).gte("field", lo).lt("field", hi)). ` +
            hits.map((h) => `${h.file}:${h.line} ${h.text}`).join(" | ")
        );
      } else if (hits.length > allowed.count) {
        unexpected.push(
          `${file}: ${hits.length} violations but only ${allowed.count} are allowed ` +
            `(${allowed.why}). New: ` +
            hits.map((h) => `${h.file}:${h.line} ${h.text}`).join(" | ")
        );
      }
    }

    expect(unexpected).toEqual([]);
  });

  it("the allowlist does not over-claim — each entry still has at least one real hit", () => {
    // An allowlist entry for a file that no longer violates is stale, and a
    // stale allowance is how a ratchet decays into a rubber stamp.
    const { violations } = scan();
    const counts: Record<string, number> = {};
    for (const v of violations) counts[v.file] = (counts[v.file] ?? 0) + 1;

    for (const [file, { count }] of Object.entries(ALLOWED)) {
      expect(
        counts[file] ?? 0,
        `${file} is allowlisted for ${count} but now has ${counts[file] ?? 0} — ` +
          `lower the count or drop the entry`
      ).toBe(count);
    }
  });
});
