import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { THEMES, ALL_ROUTES, CRITERION_PAGES, type RouteMarker } from "./a11y-routes";

// Phase 122 (A11Y-01) env switches, both no-ops when unset -- default
// behaviour (neither var set) is byte-for-byte what this spec did before:
//   A11Y_CAPTURE_DIR   -- directory to write per-cell raw axe violation JSON to
//   A11Y_MEASURE_ONLY  -- "1" skips the zero-violations assertion so the whole
//                         matrix completes in one pass instead of stopping at
//                         the first violating cell (sizing, not remediation)
// Phase 123 (A11Y-02/A11Y-03) env switch:
//   A11Y_SCAN_ALL      -- "1" drives the matrix from the full 47-route table
//                         (D-16) instead of the 20-cell criterion set A11Y-02
//                         is judged on. Widens the SCAN, not the CRITERION.
const routes = process.env.A11Y_SCAN_ALL === "1" ? ALL_ROUTES : CRITERION_PAGES;

/**
 * D-13: turns a route's marker DESCRIPTOR (e2e/a11y-routes.ts, no `page`
 * available there) into an actual Playwright locator. Returns `null` for a
 * `marker: null` table entry -- the caller skips the visibility wait for
 * those routes but never skips the axe scan itself.
 */
function buildMarkerLocator(page: Page, marker: RouteMarker) {
  if (marker === null) return null;
  if (marker.kind === "heading") {
    return page.getByRole("heading", { level: marker.level, name: marker.name }).first();
  }
  return page.getByTestId(marker.value).first();
}

let generatedCellCount = 0;

for (const theme of THEMES) {
  for (const route of routes) {
    generatedCellCount++;
    test(`[${theme}] ${route.name} — zero WCAG-AA contrast violations`, async ({
      page,
    }) => {
      // Set theme in localStorage before page navigation to avoid FOUC in test.
      // addInitScript runs before the page load, so the pre-paint inline script
      // (Plan 03) will see the correct codepulse-theme value from localStorage.
      // Also suppress OnboardingGuide's full-screen `fixed inset-0 z-50` overlay:
      // it is gated purely on localStorage (OnboardingGuide.tsx:39, no auth
      // dependency) and otherwise covers the page, so the contrast scan measures
      // the modal instead of the page under test.
      await page.addInitScript((t: string) => {
        localStorage.setItem("codepulse-theme", t);
        localStorage.setItem("codepulse_onboarding_complete", "true");
      }, theme);

      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      // ─── Gate check (188.4 validation audit, 2026-08-10) ──────────────────
      // These 20 tests were PASSING VACUOUSLY behind the Clerk gate. Measured
      // 2026-08-10: gated 5173 gave 6 failed / 5 skipped / 27 passed, keyless
      // 5181 gave 20 failed / 18 passed, and every one of those 20 new
      // failures is in this file and was in the gated server's passing set.
      // They passed because the page under test never rendered — AuthGuard
      // (AuthGuard.tsx:18-37) replaces the whole app shell with a sign-in
      // screen that has almost no content and therefore almost no contrast to
      // violate. axe was scanning an empty page and finding nothing, which is
      // exactly the "absence checked without a control that could have shown
      // the thing present" class this 188.x line exists to remove.
      //
      // Same waiting-locator idiom as analytics-cache-tile.spec.ts:24-30 and
      // command-center-breakpoints.spec.ts:99-107. The marker is
      // DashboardLayout's own nav (DashboardLayout.tsx:257), which lives
      // INSIDE AuthGuard and is common to all five pages under test — unlike a
      // per-page heading it needs no per-route table to maintain. `.first()`
      // because the layout renders a desktop and a mobile aside, each
      // containing one.
      const signInText = page.getByText("Sign in to access the telemetry dashboard");
      const appShellNav = page.getByRole("navigation", { name: "Main navigation" }).first();
      await expect(signInText.or(appShellNav).first()).toBeVisible({ timeout: 15000 });

      if (await signInText.count()) {
        // D-11: append to the fail-on-skip side-channel BEFORE test.skip() --
        // test.skip() throws, so anything after it never runs. Read and
        // aggregated across all worker processes by
        // e2e/theme-contrast.global-teardown.ts, which fails the whole suite
        // if this file is non-empty. The annotation and skipped status below
        // are deliberately unchanged: the cell still reads "skipped", only
        // the suite's exit code changes.
        appendFileSync("e2e/.a11y-skip-log.txt", `${theme}__${route.name}\n`);
        test.skip(
          true,
          `Clerk auth gate present — ${route.name} never rendered, so a zero-violation result ` +
            `would measure the sign-in screen, not the page. Run against dev:noauth (see ` +
            `\`npm run test:e2e:noauth:help\`). Recorded as NOT verified, never as a pass.`,
        );
      }

      // ─── D-13 content marker (Plan 123-03) ─────────────────────────────────
      // The gate check above only proves the Clerk sign-in screen is absent --
      // it does NOT prove this route's own content rendered. `/analytics`
      // demonstrably renders as app shell plus `SectionErrorBoundary`
      // fallbacks under the three known query timeouts Phase 121 caught live,
      // and the old marker (the shell's own nav) is common to every page
      // whether or not that page's content does, which is the exact hole
      // D-13 exists to close. A missing marker FAILS the cell -- it is never
      // wrapped in try/catch and never routed through test.skip, unlike the
      // Clerk gate above (that branch is a genuine "not applicable", this one
      // is a genuine defect).
      //
      // `marker: null` (no route currently uses it) means this route has no
      // content-specific locator to wait on -- skip the wait, never the axe
      // scan, and log why so a `null`-marker route can't quietly go
      // unnoticed.
      const marker = buildMarkerLocator(page, route.marker);
      if (marker) {
        await expect(marker).toBeVisible({ timeout: 20000 });
      } else {
        // eslint-disable-next-line no-console
        console.log(`[a11y] ${route.name} (${route.path}) has no content marker -- scanned without a render-proof wait`);
      }

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      // Phase 122 (A11Y-01): capture the raw per-cell violation JSON when asked.
      // This MUST run before the assertion below -- a failing cell throws out of
      // expect() and never reaches a later write, so ordering it after would
      // silently leave holes in the baseline for every cell that has violations
      // (i.e. most of them, which is the entire point of this measurement).
      const captureDir = process.env.A11Y_CAPTURE_DIR;
      if (captureDir) {
        mkdirSync(captureDir, { recursive: true });
        const payload = {
          theme,
          page: route.name,
          path: route.path,
          url: page.url(),
          capturedAt: new Date().toISOString(),
          violationCount: results.violations.length,
          violations: results.violations,
          axeVersion: results.testEngine,
        };
        writeFileSync(
          `${captureDir}/${theme}__${route.name}.json`,
          JSON.stringify(payload, null, 2),
        );
      }

      // ─── D-14 measure-only non-green (Plan 123-03) ─────────────────────────
      // A11Y_MEASURE_ONLY=1 -- A11Y-01 is a SIZING requirement, not a
      // remediation requirement: the whole matrix must complete in one pass so
      // every cell gets measured AND every capture gets written, rather than
      // the run stopping at the first violating cell. What changed from the
      // old behaviour (a bare `return`, which made a measurement run report
      // green): the cell now still completes and still writes its capture
      // above, but ends the test in a FAILED state carrying a fixed,
      // greppable message, so a measurement run can never be filed as a
      // verification. This does not short-circuit the remaining cells --
      // each matrix cell is its own independent Playwright test function, so
      // one cell throwing here has no effect on any other cell's execution.
      // Remediation (A11Y-02, Phase 123) runs this same spec with the switch
      // UNSET, where behaviour past this point is unchanged.
      if (process.env.A11Y_MEASURE_ONLY === "1") {
        throw new Error("assertions suppressed: this is a measurement, not a verification");
      }

      expect(results.violations).toEqual([]);
    });
  }
}

// ─── C5 scan-count control (Plan 123-03) ───────────────────────────────────
// "The suite scanned what it claims to have scanned" is itself a claim that
// needs a discriminating check: a scan that silently enumerates fewer routes
// than it should reports green for routes it never visited -- this phase's
// own founding defect, one level up. `generatedCellCount` is incremented once
// per `test()` call actually declared above, so this is not a tautology
// against `THEMES.length * routes.length` -- it would catch a future edit
// that filters or slices the loop body without updating both counters
// together.
test("route table: population is 47 (not 62), criterion set is 5, generated cell count matches themes x routes", () => {
  expect(ALL_ROUTES.length).toBe(47);
  expect(CRITERION_PAGES.length).toBe(5);
  expect(CRITERION_PAGES.map((r) => r.name).sort()).toEqual(
    ["Analytics", "Dashboard", "Forge", "Graphs", "LiveRun"],
  );
  // 62 is `ls src/pages/*.tsx | wc -l` -- the top-level glob INCLUDING
  // *.test.tsx files. 47 = 42 non-test top-level pages + 5 hr/ pages.
  // 122-CONTRAST-BASELINE.md warns explicitly against propagating 62 as a
  // route denominator; re-derived 2026-08-20, see e2e/a11y-routes.ts header.
  expect(ALL_ROUTES.length).not.toBe(62);
  expect(generatedCellCount).toBe(THEMES.length * routes.length);
});
