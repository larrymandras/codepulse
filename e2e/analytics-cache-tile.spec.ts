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
 * VITE_CLERK_PUBLISHABLE_KEY). Run `npm run test:e2e:noauth` (see
 * `npm run test:e2e:noauth:help` for the exact invocation and shell
 * constraints) against a keyless `dev:noauth` server. If a Clerk-gated build
 * is reused locally, it skips rather than false-failing.
 */
test.describe('Analytics — prompt-cache tile', () => {
  test('renders the cache hit-rate card and per-model panel', async ({ page }) => {
    await page.goto('/analytics');

    // Race-safe gate check (command-center-breakpoints.spec.ts / quick-commands-stop.spec.ts
    // idiom): wait for either the Clerk sign-in gate OR this page's own stable heading to
    // actually paint before any .count() call, instead of racing the gate's render.
    const signInText = page.getByText('Sign in to access the telemetry dashboard');
    const cacheHeading = page.getByText('Cache Hit Rate (24h)');
    await expect(signInText.or(cacheHeading).first()).toBeVisible({ timeout: 15000 });

    if (await signInText.count()) {
      test.skip(true, 'Clerk auth gate present — run npm run test:e2e:noauth');
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
