import { test, expect } from '@playwright/test';

test.describe('Sidebar navigation', () => {
  // OnboardingGuide renders a full-screen `fixed inset-0 z-50` overlay whenever
  // localStorage `codepulse_onboarding_complete` is unset, and it intercepts every
  // pointer event -- so every click here failed with `locator.click: Test timeout`.
  // The modal is gated PURELY on localStorage (OnboardingGuide.tsx:39) with no auth
  // dependency, so this was failing independently of any Clerk configuration.
  // Suppressed the same way e2e/command-center-breakpoints.spec.ts does.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('codepulse_onboarding_complete', 'true');
    });
  });

  test('loads the dashboard page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.locator('body')).toBeVisible();
  });

  // Phase 116: proves the nav-registry entry actually renders as a reachable
  // link. No unit test can show that -- the registry is data, and a typo in the
  // route or a missing iconComponents key both leave the entry looking correct
  // in the registry while producing no working link.
  test('navigates to galdr page', async ({ page }) => {
    await page.goto('/');
    const galdrLink = page.locator('a[href="/galdr"]').first();
    await galdrLink.click();
    await expect(page).toHaveURL('/galdr');
  });

  // Phase 117: same reasoning as the galdr test above — proves the registry
  // entry renders as a reachable link, which no unit test can show.
  test('navigates to bifrost page', async ({ page }) => {
    await page.goto('/');
    const bifrostLink = page.locator('a[href="/bifrost"]').first();
    await bifrostLink.click();
    await expect(page).toHaveURL('/bifrost');
  });

  test('navigates to alerts page', async ({ page }) => {
    await page.goto('/');
    const alertsLink = page.locator('a[href="/alerts"]').first();
    await alertsLink.click();
    await expect(page).toHaveURL('/alerts');
  });

  test('navigates to analytics page', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('a[href="/analytics"]').first();
    await link.click();
    await expect(page).toHaveURL('/analytics');
  });

  test('navigates to infrastructure page', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('a[href="/infrastructure"]').first();
    await link.click();
    await expect(page).toHaveURL('/infrastructure');
  });

  test('navigates to security page', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('a[href="/security"]').first();
    await link.click();
    await expect(page).toHaveURL('/security');
  });

  test('navigates to build progress page', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('a[href="/build"]').first();
    await link.click();
    await expect(page).toHaveURL('/build');
  });

  test('navigates to settings page', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('a[href="/settings"]').first();
    await link.click();
    await expect(page).toHaveURL('/settings');
  });
});
