import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    // VITE_BRAINS_STUB=true so e2e/brain-swap.spec.ts's stub round trip is genuinely exercisable
    // when Playwright spins up a fresh dev server (e.g. CI). When an already-running dev server is
    // reused locally (reuseExistingServer=true), this has no effect on that server's own env — the
    // spec's own stub-absent skip guard handles that case honestly instead of asserting against
    // whatever live data happens to be present (103-08-T1).
    env: {
      VITE_BRAINS_STUB: 'true',
    },
  },
});
