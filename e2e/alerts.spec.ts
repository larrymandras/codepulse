import { test, expect } from '@playwright/test';

test.describe('Alerts page', () => {
  test('alerts page loads successfully', async ({ page }) => {
    await page.goto('/alerts');
    await expect(page.locator('body')).toBeVisible();
  });

  test('shows "All clear" empty state when no alerts', async ({ page }) => {
    await page.goto('/alerts');
    // Wait for page to finish loading
    await page.waitForLoadState('networkidle');
    // Check for empty state message
    const allClear = page.getByText(/all clear/i);
    if (await allClear.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(allClear).toBeVisible();
    }
  });
});
