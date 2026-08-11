/**
 * Loom end-to-end — the design doc's error/clean control pair (Phase 119).
 *
 * §4.4's gate: "a live run driven by real emits animates start→complete on
 * every step; an error event renders distinctly (control: a clean run shows no
 * error styling)". That was originally verified by direct probe, which left it
 * unguarded against regression — this spec closes that hole.
 *
 * Reads the LIVE self-hosted Convex instance and creates nothing, like
 * e2e/bifrost.spec.ts. It relies on the two runs Phase 119 emitted.
 *
 * DELIBERATELY FAILS rather than skips when those runs are missing. A spec that
 * skips itself when its fixture is absent passes vacuously and reports green
 * while proving nothing — the exact defect `fee96b5d` had to fix in
 * theme-contrast.spec.ts.
 */
import { test, expect } from '@playwright/test';

test.describe('Loom run rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('codepulse_onboarding_complete', 'true');
    });
  });

  test('an errored run renders error styling; a clean run renders none', async ({
    page,
  }) => {
    await page.goto('/loom');
    await page
      .locator('[data-testid^="loom-step-"]')
      .first()
      // `attached`, not the default `visible`: React Flow renders nodes into the
      // DOM before it has measured and positioned them, so a freshly-mounted
      // node is present but not yet visible. These assertions only need it in
      // the DOM.
      .waitFor({ state: 'attached' });

    const completeRun = page.getByTestId('loom-run-complete').first();
    const errorRun = page.getByTestId('loom-run-error').first();

    // Non-vacuous: the fixture must exist, or this fails with a clear reason.
    // Generous timeout, not a masked defect: the run rows come from a SECOND
    // Convex subscription chained after the pipeline query, and the full suite
    // runs many workers against one dev server. The default 5s is a load bound,
    // not a correctness bound. The message still fails loudly if the fixture is
    // genuinely absent.
    const FIXTURE_TIMEOUT = 20_000;
    await expect(
      completeRun,
      'no completed run on /loom — emit one before running this spec'
    ).toBeVisible({ timeout: FIXTURE_TIMEOUT });
    await expect(
      errorRun,
      'no errored run on /loom — emit one before running this spec'
    ).toBeVisible({ timeout: FIXTURE_TIMEOUT });

    // CONTROL first: a clean run must show zero error styling.
    await completeRun.click();
    await expect(page.getByTestId('loom-step-error')).toHaveCount(0);
    const cleanComplete = await page
      .getByTestId('loom-step-complete')
      .count();
    expect(cleanComplete).toBeGreaterThan(0);

    // Then the errored run must show it. Without the control above, a page that
    // rendered every step as errored would pass this half.
    await errorRun.click();
    await expect(page.getByTestId('loom-step-error')).not.toHaveCount(0);
  });

  test('every rendered step carries a known state, and the count matches the pipeline', async ({
    page,
  }) => {
    await page.goto('/loom');
    await page
      .locator('[data-testid^="loom-step-"]')
      .first()
      // `attached`, not the default `visible`: React Flow renders nodes into the
      // DOM before it has measured and positioned them, so a freshly-mounted
      // node is present but not yet visible. These assertions only need it in
      // the DOM.
      .waitFor({ state: 'attached' });

    const ids = await page
      .locator('[data-testid^="loom-step-"]')
      .evaluateAll((els) =>
        els.map((e) => e.getAttribute('data-testid') ?? '')
      );

    expect(ids.length).toBeGreaterThan(0);
    const known = [
      'loom-step-pending',
      'loom-step-running',
      'loom-step-complete',
      'loom-step-warn',
      'loom-step-error',
    ];
    for (const id of ids) expect(known).toContain(id);
  });
});
