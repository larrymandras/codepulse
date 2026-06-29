import { test, expect } from '@playwright/test';

/**
 * Prompt-cache monitoring tile (Analytics page).
 *
 * Verifies the structure renders — not specific token values, which depend on
 * live Convex data. Asserts the headline "Cache Hit Rate (24h)" MetricCard and
 * the "Prompt Cache by Model" panel (table when there's Anthropic traffic, or
 * the empty-state otherwise).
 *
 * Like the other e2e specs, this assumes Clerk is disabled (no
 * VITE_CLERK_PUBLISHABLE_KEY — the CI dev server has none). If a Clerk-gated
 * build is reused locally, it skips rather than false-failing.
 */
test.describe('Analytics — prompt-cache tile', () => {
  test('renders the cache hit-rate card and per-model panel', async ({ page }) => {
    await page.goto('/analytics');

    if (await page.getByText('Sign in to access the telemetry dashboard').count()) {
      test.skip(true, 'Clerk auth gate present — run e2e without VITE_CLERK_PUBLISHABLE_KEY');
    }

    // Headline MetricCard (renders "--" or "N%" depending on data)
    await expect(page.getByText('Cache Hit Rate (24h)')).toBeVisible();

    // Per-model panel heading (partial match avoids the em-dash literal)
    await expect(page.getByText('Prompt Cache by Model')).toBeVisible();

    // Body is data-dependent: the per-model table OR the empty state.
    const table = page.locator('table').filter({ hasText: 'Hit Rate' });
    const empty = page.getByText('No Anthropic calls in the last 24h');
    await expect(table.or(empty).first()).toBeVisible();
  });
});
