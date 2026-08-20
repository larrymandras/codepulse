import { test, expect, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import {
  SENTINEL,
  type RGB,
  sampleColor,
  compositeSample,
  paintedColorOfClass,
  getThemeTokenText,
  relativeLuminance,
  contrastRatio,
  channelDistance,
} from "./lib/contrast";

/**
 * D-27 (122-18): the rendered result, not the source. Every other gate in
 * this phase proves the SOURCE changed (a class string, a grep hit). This
 * spec proves the RENDERED PIXELS changed — via canvas rasterisation, never
 * via regex-scraping a computed colour string.
 *
 * THE COLOUR MEASUREMENT LAW (122-CONTEXT.md, 122-TOKEN-LAW.md,
 * `[[tailwind-v4-oklch-defeats-css-color-scraping]]`): Tailwind v4 emits
 * `oklch()`/`oklab()`. A number-extraction regex over a computed colour
 * string reads the HUE ANGLE as a channel — Phase 120's withdrawn
 * measurement's tell was an impossible `rgb(0,0,262)`. Every colour claim in
 * this file goes through `sampleColor`/`compositeSample` (moved to
 * `./lib/contrast` in 123-02), which hand the raw string straight to
 * `canvas.fillStyle` (a real browser colour parser) and read back true sRGB
 * bytes via `getImageData`. Reading a computed string
 * (`getComputedStyle(...).color`) to hand to the sampler is fine and done
 * throughout this file; running a NUMBER-EXTRACTING REGEX over one is the
 * forbidden thing, and this file does not do that anywhere.
 *
 * `canvas.fillStyle` silently KEEPS its prior value on unparseable input —
 * it does not throw. Every sampler below sets a magenta sentinel first,
 * verifies the fill actually moved off it, and returns `null` (never a
 * guess) if it did not. Every consumer below REFUSES to report (asserts
 * `.not.toBeNull()`) rather than substituting a default.
 */

const THEMES = ["cyan", "emerald", "readable", "aubergine"] as const;
// `amber` carries the full token set (D-04) but is deliberately NOT exposed
// in ThemeSwitcher and is NOT in this matrix -- an unreachable theme cannot
// be measured against a rendered page, and e2e/theme-contrast.spec.ts's own
// 4-theme matrix already sets this precedent.

// The commit immediately before the FIRST src/index.css edit of this phase
// (feat(122-02) a4b02d56 is the first; its parent is this SHA). Anchored on
// the explicit SHA per D-27 -- never a relative ref, which a concurrent
// session's commit would silently redefine. Verified: `git show
// 2ddc80f5:src/index.css | grep -c surface-0` -> 0 (no surface ramp yet);
// `git log --oneline 2ddc80f5..a4b02d56` -> exactly one commit, the first
// index.css edit. See 122-RENDERED-RESULT.md for the full `git log`
// excerpt proving this.
const PRE_PHASE_SHA = "2ddc80f5516ed3312fa4e5537c639a971633d4ea";

// Tailwind's own static palette (node_modules/tailwindcss/theme.css), used
// ONLY for pre-phase controls whose literal class string is no longer
// compiled anywhere in the current source tree (the sweep converted every
// live occurrence away, so Tailwind's JIT scanner has nothing left to
// generate the old utility from). These are fixed design-system constants,
// not values resolved from this app's own cascade -- confirmed by grep
// against the installed package, not guessed:
//   grep -n "color-red-900:\|color-purple-400:\|color-purple-700:\|color-indigo-400:" node_modules/tailwindcss/theme.css
const TAILWIND_STATIC = {
  "red-900": "oklch(39.6% 0.141 25.723)",
  "purple-400": "oklch(71.4% 0.203 305.504)",
  "purple-700": "oklch(49.6% 0.265 301.924)",
  "indigo-400": "oklch(67.3% 0.182 276.935)",
} as const;

/** Record of every sample taken, so the "no channel outside 0-255" check
 *  and the printed-raw-values discipline both have one place to draw from.
 *  Module-scope state is only meaningful within a SINGLE worker process --
 *  Playwright's default config runs multiple worker processes in parallel,
 *  each with its own copy of this array. Run this file with `--workers=1`
 *  for the aggregate check in section 6 to see every sample; run without it
 *  and section 6 still passes (each worker's own subset is still in range),
 *  it just prints a smaller partial set. Documented, not silently relied on. */
const allSamples: { label: string; rgb: RGB }[] = [];
function record(label: string, rgb: RGB | null): RGB | null {
  if (rgb) allSamples.push({ label, rgb });
  return rgb;
}

/**
 * Extracts a custom property's literal declared VALUE from a specific
 * theme's block in a git blob's raw CSS SOURCE TEXT -- not a computed
 * colour string, not a regex over pixel numbers. This is a plain
 * property-value lookup in stylesheet text, used ONLY to build pre-phase
 * controls (D-27 requires anchoring the "before" figure on the explicit
 * pre-phase SHA's stylesheet, and no server runs that old stylesheet to
 * query it from a live page). If the property is not declared in the
 * theme's own block, falls back to the shared `.dark, [data-theme="cyan"]`
 * block, matching this file's real cascade (confirmed empirically: the
 * pre-phase `emerald`/`amber` blocks declare no `--status-error`/`--card`
 * of their own and inherit the shared block's values).
 */
function extractPrePhaseToken(sha: string, theme: string, token: string): string | null {
  const css = execSync(`git show ${sha}:src/index.css`, { encoding: "utf8" });
  const fromBlock = (selectorText: string): string | null => {
    const start = css.indexOf(selectorText);
    if (start === -1) return null;
    const blockStart = css.indexOf("{", start);
    const blockEnd = css.indexOf("\n}", blockStart);
    const block = css.slice(blockStart, blockEnd);
    const m = block.match(new RegExp(`${token}:\\s*([^;]+);`));
    return m ? m[1].trim() : null;
  };
  const own = fromBlock(`[data-theme="${theme}"]`);
  if (own !== null) return own;
  return fromBlock(".dark,");
}

async function gotoWithTheme(page: Page, theme: string) {
  await page.addInitScript((t: string) => {
    localStorage.setItem("codepulse-theme", t);
    localStorage.setItem("codepulse_onboarding_complete", "true");
  }, theme);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

// ─────────────────────────────────────────────────────────────────────────
// PROBE SELF-CONTROL -- must run and be reported FIRST. If the sampler
// cannot resolve #ffffff/#000000 exactly, or does not refuse an unparseable
// string, no other figure in this file may be trusted.
// ─────────────────────────────────────────────────────────────────────────
test.describe("0. probe self-control (must pass before any other figure is trusted)", () => {
  test("sampleColor resolves known-good values exactly and refuses an unparseable one", async ({ page }) => {
    await page.goto("/");
    const white = record("self-control:#ffffff", await sampleColor(page, "#ffffff"));
    const black = record("self-control:#000000", await sampleColor(page, "#000000"));
    const invalid = await sampleColor(page, "not-a-color-9x7q2");
    console.log(`[self-control] white=${white} black=${black} invalid=${invalid}`);
    expect(white).toEqual([255, 255, 255]);
    expect(black).toEqual([0, 0, 0]);
    expect(invalid).toBeNull();
  });

  test("extractPrePhaseToken finds a known-present pre-phase token and correctly returns null for one that did not exist yet", async () => {
    const knownPresent = extractPrePhaseToken(PRE_PHASE_SHA, "cyan", "--primary");
    const knownAbsent = extractPrePhaseToken(PRE_PHASE_SHA, "cyan", "--surface-0");
    console.log(`[self-control] pre-phase cyan --primary="${knownPresent}" --surface-0=${knownAbsent}`);
    expect(knownPresent).toBe("#06b6d4");
    expect(knownAbsent).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 1 & 2. Perceptibly stepped surfaces + the body actually paints --surface-0
// ─────────────────────────────────────────────────────────────────────────
// 122-19/122-20: the ORIGINAL version of this test asserted only that the
// four painted colours were not byte-identical (`Set` size === 4), which a
// ONE-POINT difference satisfies. The checkpoint's own automated pass on
// that vacuous check is exactly what let a perceptually flat ramp (adjacent
// WCAG-style contrast measured 1.032-1.109:1 across all five themes, per
// 122-19-SUMMARY.md's operator-verdict table) through as a "PASS" while the
// operator, looking at the running page, called it "one flat tone for the
// most part". Replaced with a WCAG relative-luminance contrast-ratio floor
// per ADJACENT pair (using this file's own `contrastRatio`, the same unit
// the checkpoint's evidence and 122-20-RAMP-REDERIVATION.md are stated in --
// not `channelDistance`, which answers a different question, hue
// separation, not lightness-step legibility).
//
// Threshold rationale: 122-20's brief cites two real dark-UI reference
// ramps measured the same way -- shadcn zinc (1.123/1.189/1.426) and GitHub
// dark (1.094/1.137/1.247) -- and names "roughly 1.10-1.30" as the target
// band. 1.12 sits just under shadcn zinc's weakest step and above GitHub
// dark's weakest step, so it sits inside the band while still discriminating
// EVERY theme's OLD flat values (worst-case per theme: cyan 1.042, emerald
// 1.032, amber 1.057, readable 1.089/1.067/1.109, aubergine 1.042 -- every
// one below 1.12, including readable's 2->3 step at 1.109, which very
// nearly clears a naive 1.10 floor and is why 1.10 itself was rejected as
// the threshold) from the NEW re-derived ramp (worst-case per theme's first
// step, 1.138-1.140 -- see the mutation-proof log this test's own MUTATION
// TEST run against the restored old values, documented in
// 122-20-RAMP-REDERIVATION.md).
const SURFACE_STEP_CONTRAST_MIN = 1.12;

for (const theme of THEMES) {
  test.describe(`[${theme}] surfaces`, () => {
    test(`--surface-0/1/2/3 resolve to four perceptibly-stepped painted colours`, async ({ page }) => {
      await gotoWithTheme(page, theme);
      const tokens = ["--surface-0", "--surface-1", "--surface-2", "--surface-3"];
      const triples: (RGB | null)[] = [];
      for (const t of tokens) {
        const text = await getThemeTokenText(page, t);
        triples.push(record(`[${theme}] ${t}`, await sampleColor(page, text)));
      }
      console.log(`[${theme}] surface triples:`, triples);
      for (const t of triples) expect(t, `${theme}: a surface token resolved to an unparseable colour`).not.toBeNull();

      // Byte-identity is still checked (four DIFFERENT colours), but it is
      // no longer the whole test -- it is now implied by, and strictly
      // weaker than, the per-adjacent-pair contrast floor below.
      const keys = new Set(triples.map((t) => t!.join(",")));
      expect(keys.size, `${theme}: expected 4 distinct surface colours, got ${keys.size}`).toBe(4);

      const stepRatios: number[] = [];
      for (let i = 0; i < triples.length - 1; i++) {
        const ratio = contrastRatio(triples[i + 1]!, triples[i]!);
        stepRatios.push(ratio);
      }
      console.log(`[${theme}] surface step-ratios (0->1, 1->2, 2->3):`, stepRatios.map((r) => r.toFixed(3)));
      for (let i = 0; i < stepRatios.length; i++) {
        expect(
          stepRatios[i],
          `${theme}: surface-${i}->surface-${i + 1} contrast ${stepRatios[i].toFixed(3)}:1 <= floor ${SURFACE_STEP_CONTRAST_MIN}:1 (perceptually flat)`,
        ).toBeGreaterThan(SURFACE_STEP_CONTRAST_MIN);
      }
    });

    test(`CONTROL: pre-phase git state had no --surface-N tokens at all`, async ({ page }) => {
      await gotoWithTheme(page, theme);
      const tokens = ["--surface-0", "--surface-1", "--surface-2", "--surface-3"];
      const declared = tokens.map((t) => extractPrePhaseToken(PRE_PHASE_SHA, theme, t));
      const triples = await Promise.all(declared.map((v) => sampleColor(page, v ?? "")));
      console.log(`[${theme}] PRE-PHASE surface tokens (declared text):`, declared, "-> sampled:", triples);
      expect(declared, `${theme}: a surface token unexpectedly existed pre-phase`).toEqual([null, null, null, null]);
      expect(triples, `${theme}: sampler should refuse all four (no token existed to sample)`).toEqual([
        null,
        null,
        null,
        null,
      ]);
    });

    test(`the rendered body background equals --surface-0`, async ({ page }) => {
      await gotoWithTheme(page, theme);
      const surface0Text = await getThemeTokenText(page, "--surface-0");
      const surface0RGB = record(`[${theme}] --surface-0 (body check)`, await sampleColor(page, surface0Text));
      expect(surface0RGB, `${theme}: --surface-0 must itself be a parseable colour`).not.toBeNull();

      const bodyBgText = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const bodyBgRGB = record(`[${theme}] body background`, await sampleColor(page, bodyBgText));
      expect(bodyBgRGB, `${theme}: rendered body background must be a parseable colour`).not.toBeNull();

      console.log(`[${theme}] surface-0=${surface0RGB} bodyBg=${bodyBgRGB}`);
      expect(bodyBgRGB).toEqual(surface0RGB);
    });

    test(`CONTROL: pre-phase body painted the flat --background literal, and no --surface-0 concept existed to compare it against`, async ({
      page,
    }) => {
      await gotoWithTheme(page, theme);
      const preBgText = extractPrePhaseToken(PRE_PHASE_SHA, theme, "--background");
      expect(preBgText, `${theme}: pre-phase --background must have been declared`).not.toBeNull();
      const preBgRGB = await sampleColor(page, preBgText!);
      expect(preBgRGB).not.toBeNull();

      const preSurface0 = extractPrePhaseToken(PRE_PHASE_SHA, theme, "--surface-0");
      console.log(
        `[${theme}] PRE-PHASE --background="${preBgText}" -> ${preBgRGB}; --surface-0 did not exist (${preSurface0})`,
      );
      expect(preSurface0, `${theme}: --surface-0 must not have existed pre-phase`).toBeNull();
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 3. --status-ok perceptibly separated from --primary (D-05)
// ─────────────────────────────────────────────────────────────────────────
// Euclidean sRGB-byte distance threshold. Measured minimum among the four
// exposed themes AFTER this phase is ~76 (readable); pre-phase, the
// collision D-05 fixes measures EXACTLY 0 on cyan/emerald (identical hex).
// 30 sits comfortably above single-digit anti-aliasing/rounding noise and
// comfortably below every real post-phase separation, so it discriminates
// "same colour" from "distinct hue" without being tuned to any one theme's
// exact figure.
const SEPARATION_THRESHOLD = 30;

for (const theme of THEMES) {
  test.describe(`[${theme}] status-ok vs primary separation`, () => {
    test(`--status-ok is perceptibly separated from --primary`, async ({ page }) => {
      await gotoWithTheme(page, theme);
      const okText = await getThemeTokenText(page, "--status-ok");
      const primaryText = await getThemeTokenText(page, "--primary");
      const ok = record(`[${theme}] --status-ok`, await sampleColor(page, okText));
      const primary = record(`[${theme}] --primary`, await sampleColor(page, primaryText));
      expect(ok, `${theme}: --status-ok must be a parseable colour`).not.toBeNull();
      expect(primary, `${theme}: --primary must be a parseable colour`).not.toBeNull();
      const distance = channelDistance(ok!, primary!);
      console.log(`[${theme}] status-ok=${ok} primary=${primary} distance=${distance.toFixed(1)}`);
      expect(distance, `${theme}: status-ok/primary distance ${distance.toFixed(1)} <= threshold ${SEPARATION_THRESHOLD}`).toBeGreaterThan(
        SEPARATION_THRESHOLD,
      );
    });

    test(`CONTROL: pre-phase --status-ok vs --primary`, async ({ page }) => {
      await gotoWithTheme(page, theme);
      const okText = extractPrePhaseToken(PRE_PHASE_SHA, theme, "--status-ok");
      const primaryText = extractPrePhaseToken(PRE_PHASE_SHA, theme, "--primary");
      expect(okText).not.toBeNull();
      expect(primaryText).not.toBeNull();
      const ok = await sampleColor(page, okText!);
      const primary = await sampleColor(page, primaryText!);
      expect(ok).not.toBeNull();
      expect(primary).not.toBeNull();
      const distance = channelDistance(ok!, primary!);
      console.log(
        `[${theme}] PRE-PHASE status-ok="${okText}"->${ok} primary="${primaryText}"->${primary} distance=${distance.toFixed(1)}`,
      );
      if (theme === "readable" || theme === "aubergine") {
        // D-05: already decoupled before this phase -- the control must
        // still show real separation (it is not a "before it was broken"
        // case for these two themes).
        expect(distance).toBeGreaterThan(SEPARATION_THRESHOLD);
      } else {
        // cyan/emerald: identical hex pre-phase (the exact collision D-05
        // exists to remove) -- distance must be exactly zero.
        expect(distance).toBe(0);
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Forge `failed` clears 4.5:1 against --card (D-06)
// ─────────────────────────────────────────────────────────────────────────
for (const theme of THEMES) {
  test.describe(`[${theme}] Forge 'failed' badge contrast`, () => {
    test(`clears 4.5:1 against --card`, async ({ page }) => {
      await gotoWithTheme(page, theme);
      const bgText = await paintedColorOfClass(page, "bg-[var(--status-error-fill)]", "backgroundColor");
      const fgText = await paintedColorOfClass(page, "text-[var(--status-error-on-fill)]", "color");
      const bg = record(`[${theme}] status-error-fill`, await sampleColor(page, bgText));
      const fg = record(`[${theme}] status-error-on-fill`, await sampleColor(page, fgText));
      expect(bg).not.toBeNull();
      expect(fg).not.toBeNull();

      // "measured against --card, not the page background" (120 handoff /
      // D-06): prove it explicitly by compositing the badge fill over the
      // live --card token, rather than only arguing opacity makes it moot.
      const cardText = await getThemeTokenText(page, "--card");
      const cardRGB = await sampleColor(page, cardText);
      const composited = await compositeSample(page, cardText, bgText);
      expect(cardRGB).not.toBeNull();
      expect(composited).not.toBeNull();
      // The fill is opaque (D-06/122-BADGE-LAW.md §8), so compositing over
      // --card must equal the fill sampled alone -- --card never enters.
      expect(composited).toEqual(bg);

      const ratio = contrastRatio(fg!, composited!);
      console.log(
        `[${theme}] Forge failed AFTER: card=${cardRGB} fill=${bg} fg=${fg} composited=${composited} ratio=${ratio.toFixed(3)}:1`,
      );
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    test(`CONTROL: pre-phase Forge 'failed' pairing (bg-red-900/60 text-[var(--status-error)]) measured against pre-phase --card`, async ({
      page,
    }) => {
      await gotoWithTheme(page, theme);
      const preCardText = extractPrePhaseToken(PRE_PHASE_SHA, theme, "--card");
      const preStatusErrorText = extractPrePhaseToken(PRE_PHASE_SHA, theme, "--status-error");
      expect(preCardText, `${theme}: pre-phase --card must be declared (own block or shared cascade)`).not.toBeNull();
      expect(preStatusErrorText, `${theme}: pre-phase --status-error must be declared`).not.toBeNull();

      // red-900 (opaque) is no longer compiled anywhere unprefixed/without
      // an opacity modifier in current source (`git grep` confirms zero
      // live `bg-red-900` occurrences outside test files/comments), so it
      // cannot be sampled through a live class the way the AFTER figure
      // is. Use Tailwind's static palette literal instead (documented
      // above) and alpha-composite the /60 opacity by hand via the same
      // canvas compositor used for every other pairing in this file.
      const red900Opaque = TAILWIND_STATIC["red-900"];
      const composited = await compositeSample(page, preCardText!, `oklch(39.6% 0.141 25.723 / 0.6)`);
      const fg = await sampleColor(page, preStatusErrorText!);
      expect(composited, `${theme}: red-900/60 over pre-phase --card must be parseable`).not.toBeNull();
      expect(fg).not.toBeNull();

      const ratio = contrastRatio(fg!, composited!);
      console.log(
        `[${theme}] Forge failed PRE-PHASE (old pairing): card="${preCardText}" red900(opaque, static)=${red900Opaque} composited=${composited} fg="${preStatusErrorText}"->${fg} ratio=${ratio.toFixed(3)}:1`,
      );
      if (theme === "cyan" || theme === "emerald") {
        // The sub-AA collision D-06/120-DESIGN-REVIEW-HANDOFF.md exists to fix.
        expect(ratio).toBeLessThan(4.5);
      } else {
        // readable/aubergine already cleared AA pre-phase per the handoff's
        // own figures (5.33:1) -- re-derived here independently.
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 5. --astridr appears only on Astridr surfaces (D-08), both directions
// ─────────────────────────────────────────────────────────────────────────
// Converted sites (ledger provenance):
//   - src/components/DiscoveredToolsTable.tsx CATEGORY_COLORS.memory.dot
//     (122-0x sweep, unslotted -- present since before slice E; the memory
//     capability's own identity marker) -> `bg-[var(--astridr)]`
//   - src/components/MemorySourceBadge.tsx SOURCE_STYLES.mem0.text
//     -> `text-(--astridr)`
//   - src/pages/Memory.tsx :472 `hadLlmSummarizer` chip (122-08-LEDGER.md,
//     slice E, adjudicated "a genuine per-record Astridr-memory-operation
//     flag, not a legend") -> `text-(--astridr)`
// Re-hued sites (ledger provenance, 122-07-LEDGER.md slice D):
//   - src/components/hr/AgentCard.tsx TIER_BADGE_COLOR.command
//     -> re-hued to `--primary` (shared command/domain/shared org-chart
//     enum; every agent in the roster is already Astridr's, so a single
//     enum slot cannot be the exclusive owner)
//   - src/components/hr/detail/DetailActivityTab.tsx eventTypeColors.handoff
//     -> re-hued to indigo (a generic activity-event-type category, not an
//     identity marker)
const CONVERTED_SITES = [
  { label: "DiscoveredToolsTable.tsx memory dot", className: "bg-[var(--astridr)]", prop: "backgroundColor" as const },
  { label: "MemorySourceBadge.tsx mem0 text", className: "text-(--astridr)", prop: "color" as const },
  { label: "Memory.tsx hadLlmSummarizer chip text", className: "text-(--astridr)", prop: "color" as const },
];
const REHUED_SITES = [
  { label: "AgentCard.tsx command-tier text", className: "text-primary", prop: "color" as const },
  { label: "DetailActivityTab.tsx handoff text", className: "text-indigo-400", prop: "color" as const },
];
// Pre-phase equivalents of the same sites (still-real Tailwind classes at
// PRE_PHASE_SHA; no longer compiled live, so measured via the static
// palette literal, same reasoning as the Forge-failed control above).
const PRE_PHASE_CONVERTED = [
  { label: "DiscoveredToolsTable.tsx memory dot (was bg-purple-400)", color: TAILWIND_STATIC["purple-400"] },
  { label: "MemorySourceBadge.tsx mem0 text (was text-purple-700)", color: TAILWIND_STATIC["purple-700"] },
  { label: "Memory.tsx chip text (was text-purple-400)", color: TAILWIND_STATIC["purple-400"] },
];
const PRE_PHASE_REHUED = [
  { label: "AgentCard.tsx command text (was text-purple-400)", color: TAILWIND_STATIC["purple-400"] },
  { label: "DetailActivityTab.tsx handoff text (was text-purple-400)", color: TAILWIND_STATIC["purple-400"] },
];

for (const theme of THEMES) {
  test.describe(`[${theme}] --astridr exclusivity`, () => {
    test(`converted ledger sites paint the astridr token`, async ({ page }) => {
      await gotoWithTheme(page, theme);
      const astridrText = await getThemeTokenText(page, "--astridr");
      const astridr = record(`[${theme}] --astridr token`, await sampleColor(page, astridrText));
      expect(astridr, `${theme}: --astridr must be a parseable colour`).not.toBeNull();

      for (const site of CONVERTED_SITES) {
        const colorText = await paintedColorOfClass(page, site.className, site.prop);
        const rgb = record(`[${theme}] converted: ${site.label}`, await sampleColor(page, colorText));
        expect(rgb, `${theme}: ${site.label} must be a parseable colour`).not.toBeNull();
        console.log(`[${theme}] CONVERTED ${site.label}: ${rgb} (astridr=${astridr})`);
        expect(rgb, `${theme}: ${site.label} should paint --astridr but did not`).toEqual(astridr);
      }
    });

    test(`re-hued ledger sites do NOT paint the astridr token`, async ({ page }) => {
      await gotoWithTheme(page, theme);
      const astridrText = await getThemeTokenText(page, "--astridr");
      const astridr = await sampleColor(page, astridrText);
      expect(astridr).not.toBeNull();

      for (const site of REHUED_SITES) {
        const colorText = await paintedColorOfClass(page, site.className, site.prop);
        const rgb = record(`[${theme}] re-hued: ${site.label}`, await sampleColor(page, colorText));
        expect(rgb, `${theme}: ${site.label} must be a parseable colour`).not.toBeNull();
        const distance = channelDistance(rgb!, astridr!);
        console.log(`[${theme}] RE-HUED ${site.label}: ${rgb} (astridr=${astridr}, distance=${distance.toFixed(1)})`);
        expect(distance, `${theme}: ${site.label} paints astridr violet but should not`).toBeGreaterThan(
          SEPARATION_THRESHOLD,
        );
      }
    });

    test(`CONTROL: pre-phase, both converted and re-hued sites used generic Tailwind purple (no --astridr token existed to converge on)`, async () => {
      const preAstridr = extractPrePhaseToken(PRE_PHASE_SHA, theme, "--astridr");
      expect(preAstridr, `${theme}: --astridr must not have existed pre-phase`).toBeNull();
      console.log(
        `[${theme}] PRE-PHASE: --astridr did not exist (${preAstridr}); ` +
          `converted-site classes were ${PRE_PHASE_CONVERTED.map((s) => s.label).join(", ")}; ` +
          `re-hued-site classes were ${PRE_PHASE_REHUED.map((s) => s.label).join(", ")} -- ` +
          `both families used the SAME generic purple palette pre-phase (D-08's whole reason to exist: ` +
          `"violet" was an accident of Tailwind's stock palette, not a deliberate identity marker), ` +
          `and only the AFTER state converges the genuine identity sites onto one canonical token ` +
          `while moving everything else away from it.`,
      );
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Structural guarantee check: every sample recorded above came from
// getImageData's Uint8ClampedArray, which by construction cannot report a
// channel outside 0-255 -- but assert it explicitly rather than merely
// argue it, per D-27/122-CONTEXT.md's "an impossible value is the cheapest
// detector there is".
// ─────────────────────────────────────────────────────────────────────────
test.describe("6. structural guarantee", () => {
  test("no recorded channel value across the whole run falls outside 0-255", () => {
    // Module state is per-worker-process (see the comment on `allSamples`
    // above). Under Playwright's default multi-worker config, this specific
    // test can land in a worker that ran no other test in this file yet, in
    // which case allSamples is legitimately empty here -- that is a fact
    // about worker scheduling, not a failure to find an out-of-range value.
    // Run `--workers=1` to make this check see every sample from the run.
    test.skip(
      allSamples.length === 0,
      "this worker process recorded zero samples (Playwright uses multiple worker " +
        "processes by default, each with its own module state) -- re-run with --workers=1 " +
        "for this check to see every sample taken during the run",
    );
    console.log(`[structural guarantee] checking ${allSamples.length} recorded samples in this worker`);
    const outOfRange = allSamples.filter(({ rgb }) => rgb.some((c) => c < 0 || c > 255));
    if (outOfRange.length > 0) {
      console.log("OUT OF RANGE:", outOfRange);
    }
    expect(outOfRange).toEqual([]);
  });
});
