/**
 * dataSensitiveCoverage.ratchet.test.ts — screenshot/demo privacy can only move
 * forward.
 *
 * `src/index.css` defines two privacy rules that key off a `data-sensitive`
 * attribute:
 *
 *     .privacy-demo       [data-sensitive] { filter: blur(4px) }
 *     .privacy-screenshot [data-sensitive] { visibility: hidden }
 *
 * Measured 2026-08-27, those rules had **zero consumers anywhere in src/**.
 * They had been dead CSS for as long as they had existed: the selector matched
 * nothing, so screenshot mode hid nothing. The JS half of the same mechanism
 * was independently inert (every `usePrivacyMask` helper gated on `enabled`,
 * which `setLevel` never sets) — that half is now fixed and guarded by
 * `src/hooks/usePrivacyMask.test.tsx`.
 *
 * This ratchet guards the MARKUP half, and it is deliberately a floor, not a
 * target. It CANNOT tell you which elements are still missing the attribute —
 * nobody has ever enumerated every element in this app that renders PII, and a
 * test that guessed at that set would report a mechanism as complete when it is
 * not, which is the exact failure being fixed. What it can do is make the
 * number monotonic: once an element is marked, it stays marked.
 *
 * TO RAISE THE FLOOR: mark more elements, then bump MIN_CONSUMERS. That is the
 * intended workflow, and the fact that it requires a deliberate edit is the
 * point — it makes silent regression impossible and progress explicit.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = __dirname;

/**
 * The floor, counted in ATTRIBUTE occurrences in source — not string matches.
 *
 * This distinction is the whole test. The first version of this ratchet counted
 * every occurrence of the string `data-sensitive` and set the floor at 2. It
 * passed. Then a mutation test deleted the actual attribute and it STILL
 * passed, because MessageRoutingSummary.tsx contains two *comments* naming the
 * attribute while explaining it — so the floor was met by prose alone and the
 * ratchet was a rubber stamp. That is the failure this repo's own CLAUDE.md
 * warns about: "an exact/zero-count criterion is satisfiable by REWORDING A
 * COMMENT... assert on the construct."
 *
 * So: comment lines are stripped, and only the attribute form
 * (`data-sensitive=`) counts.
 *
 * 2026-08-27: 1 — the sender label in MessageRoutingSummary.tsx, which renders
 * once per channel at runtime but appears once in source.
 */
const MIN_CONSUMERS = 1;

/** Attribute form only. A bare mention in prose is not coverage. */
const ATTRIBUTE = /data-sensitive\s*=/g;

/** Full-line comments. */
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*|\{\/\*)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(entry)) out.push(full);
  }
  return out;
}

function countConsumers() {
  let markup = 0;
  let cssRules = 0;
  const files: string[] = [];

  for (const file of walk(SRC)) {
    if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
    const src = readFileSync(file, "utf-8");

    if (file.endsWith(".css")) {
      // The rules themselves, not consumers of them.
      cssRules += (src.match(/\[data-sensitive\]/g) ?? []).length;
      continue;
    }
    const code = src
      .split("\n")
      .filter((line) => !COMMENT_LINE.test(line))
      .join("\n");

    const hits = (code.match(ATTRIBUTE) ?? []).length;
    if (hits > 0) {
      markup += hits;
      files.push(path.relative(SRC, file).replace(/\\/g, "/"));
    }
  }
  return { markup, cssRules, files };
}

describe("data-sensitive — the CSS half of privacy mode exists", () => {
  it("index.css still defines the rules this attribute feeds", () => {
    // If these rules are ever deleted, the ratchet below would keep passing
    // while the mechanism it guards had been removed — a guard that cannot
    // fail is indistinguishable from one never violated.
    const css = readFileSync(path.join(SRC, "index.css"), "utf-8");
    expect(css).toMatch(/\.privacy-demo\s+\[data-sensitive\]/);
    expect(css).toMatch(/\.privacy-screenshot\s+\[data-sensitive\]/);
  });

  it("the scan can see the css rules at all (control)", () => {
    const { cssRules } = countConsumers();
    expect(cssRules).toBeGreaterThan(0);
  });
});

describe("data-sensitive — markup coverage is monotonic", () => {
  it(`at least ${MIN_CONSUMERS} elements carry the attribute`, () => {
    const { markup, files } = countConsumers();
    expect(
      markup,
      `data-sensitive coverage dropped to ${markup} (floor ${MIN_CONSUMERS}). ` +
        `Currently marked in: ${files.join(", ") || "(nothing)"}. ` +
        `Screenshot mode hides ONLY elements carrying this attribute — removing ` +
        `one silently un-hides real PII.`
    ).toBeGreaterThanOrEqual(MIN_CONSUMERS);
  });

  it("the floor is honest — it is not set above what actually exists", () => {
    // A floor higher than reality would be a permanently-red test, which gets
    // skipped and then deleted. A floor far BELOW reality is a rubber stamp.
    const { markup } = countConsumers();
    expect(markup).toBeGreaterThanOrEqual(MIN_CONSUMERS);
    expect(
      markup,
      `coverage is now ${markup}, well above the floor of ${MIN_CONSUMERS} — ` +
        `raise MIN_CONSUMERS so the ratchet keeps biting`
    ).toBeLessThan(MIN_CONSUMERS + 10);
  });

  it("counts the ATTRIBUTE, not the word — a comment must not satisfy the floor", () => {
    // The regression this file exists to not repeat: the first version counted
    // bare string matches, and MessageRoutingSummary.tsx's two explanatory
    // comments met the floor on their own. Deleting the real attribute left it
    // green.
    expect('data-sensitive=""'.match(ATTRIBUTE)).toHaveLength(1);
    expect("data-sensitive".match(ATTRIBUTE)).toBeNull();
    expect(
      "// `.privacy-screenshot [data-sensitive] { visibility: hidden }`".match(
        ATTRIBUTE
      )
    ).toBeNull();
    expect(COMMENT_LINE.test("    // and `[data-sensitive]` blurs")).toBe(true);
    expect(COMMENT_LINE.test('    data-sensitive=""')).toBe(false);
  });
});
