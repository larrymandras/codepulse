import { test, expect } from '@playwright/test';

test.describe('Sidebar navigation', () => {
  test('loads the dashboard page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.locator('body')).toBeVisible();
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
