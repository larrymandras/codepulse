import { test, expect, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import {
  sampleColor,
  compositeSample,
  paintedColorOfClass,
  getThemeTokenText,
  contrastRatio,
  wcagThresholdFor,
} from "./lib/contrast";

/**
 * D-02 pass 2 -- the isolation harness. Renders class strings against real
 * theme surfaces in a live page and rasterises the painted result; it does
 * not compute anything from hex + alpha. Tailwind v4 compiles `/NN` to
 * `color-mix(in oklab, var(--token) NN%, transparent)`, a perceptual mix
 * that hex arithmetic cannot reproduce -- see
 * `e2e/theme-rendered-result.spec.ts`'s header comment and
 * `[[tailwind-v4-oklch-defeats-css-color-scraping]]` for the full law this
 * file follows. Every colour claim below goes through the shared
 * `e2e/lib/contrast.ts` rasteriser (sentinel-guarded, `.not.toBeNull()`
 * everywhere) -- no second rasteriser, no second luminance formula.
 *
 * Threshold rule: a flat 4.5:1 at CLASS level (font size is a property of
 * an OCCURRENCE, not of a class -- `wcagThresholdFor`'s 3:1 large-text
 * allowance can only be claimed per-occurrence with a `readTextMetrics`
 * reading attached, which is not this file's job).
 *
 * This file ships the INSTRUMENT and its controls (C3, C6, sentinel
 * discipline, `wcagThresholdFor` unit cases) -- not the corpus verdicts.
 * 123-07 consumes `e2e/.artifacts/123-isolation-pass2.json` to decide which
 * of the 15 classes actually need fixing.
 */

const THEMES = ["cyan", "emerald", "readable", "aubergine"] as const;

const FLAT_THRESHOLD = 4.5;

// This is the commit immediately after 123-02's Task 1 (the shared
// rasteriser extraction), captured via `git rev-parse HEAD` ONCE at
// implementation time -- NOT resolved dynamically at test time, and never
// a relative ref one commit back (a concurrent session can move HEAD). D-01's `text-*/NN` sweep is a
// LATER plan in this same phase (123-03..07), so at this SHA -- and for as
// long as no later commit has touched the two probed component files below
// -- the class strings this test measures live are byte-identical to what
// they were at this anchor. This lets the C6 "before" ledger rows be
// measured live (the shared rasteriser cannot render a historical build)
// while still being genuinely anchored to real git history via
// `confirmClassPresentAtSha` below, not merely asserted unchanged.
const PRE_123_SHA = "327cf92b47438ab0b1a5aca62a82663e745516ea";

const DEFAULT_SURFACES = ["--background", "--card", "--popover", "--muted"] as const;

interface ClassSpec {
  className: string;
  surfaces: readonly string[];
}

// The 15 unique opacity-modifier class strings re-derived 2026-08-20 with
// `grep -rhoE ... | sort | uniq -c` (occurrences, not matching lines) --
// see 123-02-PLAN.md <interfaces>. This is the pass-2 measurement unit: 15
// classes, not 176 occurrences.
const CLASS_MATRIX: ClassSpec[] = [
  { className: "text-primary/70", surfaces: DEFAULT_SURFACES },
  { className: "text-muted-foreground/50", surfaces: DEFAULT_SURFACES },
  { className: "text-muted-foreground/70", surfaces: DEFAULT_SURFACES },
  { className: "text-muted-foreground/60", surfaces: DEFAULT_SURFACES },
  { className: "text-primary/80", surfaces: DEFAULT_SURFACES },
  { className: "text-muted-foreground/80", surfaces: DEFAULT_SURFACES },
  { className: "text-primary/60", surfaces: DEFAULT_SURFACES },
  { className: "text-primary/40", surfaces: DEFAULT_SURFACES },
  { className: "text-primary/50", surfaces: DEFAULT_SURFACES },
  { className: "text-primary/90", surfaces: DEFAULT_SURFACES },
  { className: "text-primary/30", surfaces: DEFAULT_SURFACES },
  { className: "text-muted-foreground/40", surfaces: DEFAULT_SURFACES },
  { className: "text-muted-foreground/30", surfaces: DEFAULT_SURFACES },
  { className: "text-(--status-warn)/80", surfaces: DEFAULT_SURFACES },
  { className: "text-(--status-error)/60", surfaces: DEFAULT_SURFACES },
];

// C6's two probed classes and the file they both live in (DashboardLayout.tsx
// :91 and :148 -- the two sites STATE.md's scope narrative attributes 184 of
// 205 contrast nodes to).
const C6_PROBES = [
  { className: "text-muted-foreground/80", filePath: "src/layouts/DashboardLayout.tsx" },
  { className: "text-primary/60", filePath: "src/layouts/DashboardLayout.tsx" },
] as const;

type LedgerRow = {
  pass: "isolation" | "isolation-before";
  theme: string;
  className: string;
  surface: string;
  threshold: number;
  ratio: number;
  fg: [number, number, number];
  bg: [number, number, number];
};

async function gotoWithTheme(page: Page, theme: string) {
  await page.addInitScript((t: string) => {
    localStorage.setItem("codepulse-theme", t);
    localStorage.setItem("codepulse_onboarding_complete", "true");
  }, theme);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

/**
 * Measures one `className` painted over one `surfaceToken`'s live-rendered
 * colour: reads the surface as an opaque background, reads the class's own
 * computed foreground colour (which may carry alpha from a `/NN` Tailwind
 * opacity modifier), alpha-composites it over the surface via the shared
 * `compositeSample` (real browser "source-over" compositing, never hex
 * arithmetic), and returns the WCAG ratio between the composited foreground
 * pixel and the opaque surface. Returns `null` -- never a guess -- if any
 * intermediate sample is unparseable, per this module's sentinel law.
 */
async function measureClassOnSurface(
  page: Page,
  className: string,
  surfaceToken: string,
): Promise<{ ratio: number; fg: [number, number, number]; bg: [number, number, number] } | null> {
  const surfaceText = await getThemeTokenText(page, surfaceToken);
  const surfaceRGB = await sampleColor(page, surfaceText);
  if (!surfaceRGB) return null;

  const classColorText = await paintedColorOfClass(page, className, "color");
  const compositedFg = await compositeSample(page, surfaceText, classColorText);
  if (!compositedFg) return null;

  return { ratio: contrastRatio(compositedFg, surfaceRGB), fg: compositedFg, bg: surfaceRGB };
}

/**
 * Confirms `className` literally appears in `filePath`'s source text at
 * `sha` -- a hard-coded, git-extracted anchor (never a relative ref), the same
 * "explicit SHA, execSync" idiom `extractPrePhaseToken`
 * (`e2e/theme-rendered-result.spec.ts`) uses for CSS custom properties,
 * applied here to a Tailwind utility class string instead. This is what
 * makes the C6 "before" rows genuinely anchored to git history rather than
 * merely assumed unchanged.
 */
function confirmClassPresentAtSha(sha: string, filePath: string, className: string): boolean {
  const text = execSync(`git show ${sha}:${filePath}`, { encoding: "utf8" });
  return text.includes(className);
}

// ─────────────────────────────────────────────────────────────────────────
// wcagThresholdFor unit cases (Task 1's acceptance criteria, all five)
// ─────────────────────────────────────────────────────────────────────────
test.describe("wcagThresholdFor", () => {
  const cases: { fontSizePx: number; fontWeight: number; expected: number; label: string }[] = [
    { fontSizePx: 24, fontWeight: 400, expected: 3, label: "24px normal -> large-text 3:1" },
    { fontSizePx: 18.66, fontWeight: 700, expected: 3, label: "18.66px bold -> large-text 3:1" },
    { fontSizePx: 18.66, fontWeight: 400, expected: 4.5, label: "18.66px normal -> normal-text 4.5:1" },
    // DashboardLayout.tsx:148 is 14px normal, :91 is 12px bold -- both owe
    // 4.5:1; a threshold function returning 3 for either would be wrong.
    { fontSizePx: 14, fontWeight: 700, expected: 4.5, label: "14px bold -> normal-text 4.5:1" },
    { fontSizePx: 12, fontWeight: 700, expected: 4.5, label: "12px bold -> normal-text 4.5:1" },
  ];
  for (const c of cases) {
    test(c.label, () => {
      expect(wcagThresholdFor({ fontSizePx: c.fontSizePx, fontWeight: c.fontWeight })).toBe(c.expected);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Sentinel discipline control
// ─────────────────────────────────────────────────────────────────────────
test.describe("sentinel discipline", () => {
  test("sampleColor refuses an unparseable string and resolves a known-good one exactly", async ({ page }) => {
    await page.goto("/");
    const invalid = await sampleColor(page, "not-a-color-9x7q2");
    const white = await sampleColor(page, "#ffffff");
    console.log(`[sentinel discipline] invalid=${invalid} white=${white}`);
    expect(invalid, "an unparseable colour string must refuse (null), never silently keep the sentinel fill").toBeNull();
    expect(white).toEqual([255, 255, 255]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C3 -- the harness flags a deliberately sub-AA fixture, and in the same
// pass, does not flag a known-passing element. Both directions in one test,
// so a harness that flags nothing AND a harness that flags everything both
// fail.
// ─────────────────────────────────────────────────────────────────────────
test.describe("C3: harness discriminates sub-AA from compliant", () => {
  test("flags a sub-AA pairing and passes a known-compliant one, per theme", async ({ page }) => {
    for (const theme of THEMES) {
      await gotoWithTheme(page, theme);

      const subAA = await measureClassOnSurface(page, "text-muted-foreground/30", "--background");
      expect(subAA, `${theme}: sub-AA fixture must be a parseable measurement`).not.toBeNull();
      console.log(
        `[C3][${theme}] sub-AA text-muted-foreground/30 on --background: ratio=${subAA!.ratio.toFixed(3)}:1`,
      );
      expect(
        subAA!.ratio,
        `${theme}: text-muted-foreground/30 on --background measured ${subAA!.ratio.toFixed(3)}:1, expected BELOW ${FLAT_THRESHOLD}`,
      ).toBeLessThan(FLAT_THRESHOLD);

      const passing = await measureClassOnSurface(page, "text-foreground", "--background");
      expect(passing, `${theme}: known-passing element must be a parseable measurement`).not.toBeNull();
      console.log(`[C3][${theme}] known-passing text-foreground on --background: ratio=${passing!.ratio.toFixed(3)}:1`);
      expect(
        passing!.ratio,
        `${theme}: text-foreground on --background measured ${passing!.ratio.toFixed(3)}:1, expected ABOVE ${FLAT_THRESHOLD}`,
      ).toBeGreaterThan(FLAT_THRESHOLD);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Main pass-2 matrix + C6 before-control, combined into ONE test so the
// whole ledger is built and written from a single worker process -- the
// same per-process module-state caveat `theme-rendered-result.spec.ts`
// documents for `allSamples` applies here, so cross-test/cross-worker
// aggregation is avoided entirely rather than relied upon.
// ─────────────────────────────────────────────────────────────────────────
test.describe("D-02 pass-2 isolation matrix", () => {
  test("measures every class x theme x surface cell and writes the pass-labelled ledger", async ({ page }) => {
    const rows: LedgerRow[] = [];

    for (const theme of THEMES) {
      await gotoWithTheme(page, theme);

      for (const spec of CLASS_MATRIX) {
        for (const surface of spec.surfaces) {
          const measured = await measureClassOnSurface(page, spec.className, surface);
          expect(
            measured,
            `${theme}/${spec.className} on ${surface} must be a parseable measurement (sentinel refusal is a bug here, not an expected outcome)`,
          ).not.toBeNull();
          rows.push({
            pass: "isolation",
            theme,
            className: spec.className,
            surface,
            threshold: FLAT_THRESHOLD,
            ratio: measured!.ratio,
            fg: measured!.fg,
            bg: measured!.bg,
          });
        }
      }

      // C6 before-control: anchor each probed class to PRE_123_SHA via a
      // real git-extraction, then measure it live (valid for as long as
      // this class hasn't been touched by a sweep plan since that SHA --
      // true at 123-02 time, see PRE_123_SHA's comment above).
      for (const probe of C6_PROBES) {
        const presentAtAnchor = confirmClassPresentAtSha(PRE_123_SHA, probe.filePath, probe.className);
        expect(
          presentAtAnchor,
          `${theme}: ${probe.className} must be present in ${probe.filePath} at anchor ${PRE_123_SHA}`,
        ).toBe(true);

        const measured = await measureClassOnSurface(page, probe.className, "--card");
        expect(measured, `${theme}: C6 before-control for ${probe.className} on --card must be parseable`).not.toBeNull();
        rows.push({
          pass: "isolation-before",
          theme,
          className: probe.className,
          surface: "--card",
          threshold: FLAT_THRESHOLD,
          ratio: measured!.ratio,
          fg: measured!.fg,
          bg: measured!.bg,
        });
      }
    }

    const expectedIsolationRows = THEMES.length * CLASS_MATRIX.reduce((n, s) => n + s.surfaces.length, 0);
    const expectedBeforeRows = THEMES.length * C6_PROBES.length;
    console.log(
      `[D-02 pass-2] wrote ${rows.length} rows ` +
        `(isolation=${rows.filter((r) => r.pass === "isolation").length}/${expectedIsolationRows}, ` +
        `isolation-before=${rows.filter((r) => r.pass === "isolation-before").length}/${expectedBeforeRows})`,
    );

    // 15 classes x 4 themes x 4 surfaces = 240 "isolation" rows, plus
    // 2 classes x 4 themes = 8 "isolation-before" rows -- both comfortably
    // clear the plan's >= 60-row floor (15 classes x 4 themes), but assert
    // the EXACT expected counts too, so a silently truncated matrix (a
    // skipped surface, a skipped theme) fails here rather than reporting a
    // short table as complete.
    expect(rows.filter((r) => r.pass === "isolation").length).toBe(expectedIsolationRows);
    expect(rows.filter((r) => r.pass === "isolation-before").length).toBe(expectedBeforeRows);
    expect(rows.length).toBeGreaterThanOrEqual(60);
    expect(rows.every((r) => r.pass === "isolation" || r.pass === "isolation-before")).toBe(true);

    mkdirSync("e2e/.artifacts", { recursive: true });
    writeFileSync("e2e/.artifacts/123-isolation-pass2.json", JSON.stringify(rows, null, 2));
  });
});
