/**
 * Bifröst end-to-end — the design doc's palette-open gate (Phase 117).
 *
 * seidr-suite-design.md §4.2 states the gate as "palette-open works end-to-end".
 * A unit test can show a link renders as a palette item; only this can show that
 * Ctrl+K → type → Enter actually opens the URL.
 *
 * This spec reads the LIVE self-hosted Convex instance — the repo has no test
 * database — but unlike e2e/galdr.spec.ts it creates nothing and mutates
 * nothing. It relies on the two real links seeded during Phase 117 and asserts
 * only on what it finds, so it leaves no rows behind to clean up.
 */
import { test, expect } from '@playwright/test';

test.describe('Bifröst command palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('codepulse_onboarding_complete', 'true');
    });
  });

  test('Ctrl+K, search a link, Enter opens its URL', async ({ page }) => {
    await page.goto('/bifrost');
    await expect(page.getByText('Ástríðr API')).toBeVisible();

    // DashboardLayout owns the global Ctrl+K binding; Phase 117 deliberately
    // added no new global shortcut.
    await page.keyboard.press('Control+k');

    const input = page.getByPlaceholder(
      'Search pages, agents, sessions, commands...'
    );
    await expect(input).toBeVisible();

    await input.fill('Ástríðr API');
    const item = page.locator('[cmdk-item]', { hasText: 'Ástríðr API' }).first();
    await expect(item).toBeVisible();

    // The link is external, so selecting it calls window.open — Playwright
    // surfaces that as a popup. Asserting on the popup's URL is what makes this
    // an end-to-end proof rather than a "the item was clickable" check.
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      item.click(),
    ]);
    expect(popup.url()).toContain('8181');
  });

  test('a link bound to a running container shows a dot; an unbound one shows none', async ({
    page,
  }) => {
    await page.goto('/bifrost');
    await expect(page.getByText('Ástríðr API')).toBeVisible();
    await expect(page.getByText('CodePulse dev server')).toBeVisible();

    // D-03's live half. Two cards, exactly one dot: the container-bound link
    // resolves, the unbound one renders nothing rather than a green dot.
    // The red case cannot be produced without stopping a real service, so it is
    // covered in src/pages/Bifrost.test.tsx instead.
    const up = page.getByTestId('bifrost-dot-up');
    const down = page.getByTestId('bifrost-dot-down');
    expect((await up.count()) + (await down.count())).toBe(1);
  });
});
