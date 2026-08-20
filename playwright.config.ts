import { defineConfig, devices } from '@playwright/test';

/**
 * Two projects, deliberately separated (see the `chromium-authed` block):
 *
 * - `chromium`      — everything except *.authed.spec.ts. Points at PW_BASE_URL,
 *                     which for the 188.4-03 specs is the KEYLESS dev:noauth
 *                     server on 5181 (`npm run test:e2e:noauth:help`).
 * - `chromium-authed` — only *.authed.spec.ts, pinned to the GATED server. These
 *                     are the only specs that exercise Clerk itself.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  // Fetches the Clerk Testing Token once per run. Also the reason the authed
  // specs can sign in at all — Clerk's bot detection challenges scripted
  // sign-ins without it.
  globalSetup: './e2e/global-setup.ts',
  // D-11: fail the run on any contrast-matrix cell that hits the Clerk-gate
  // skip branch, without corrupting per-cell result.status. See
  // e2e/theme-contrast.global-teardown.ts for why this is a globalTeardown
  // and not a test.afterAll.
  globalTeardown: './e2e/theme-contrast.global-teardown.ts',
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /.*\.authed\.spec\.ts/,
    },
    {
      // Pinned to CLERK_TEST_BASE_URL (default 5173, the gated server) and
      // NOT to PW_BASE_URL. This is load-bearing, not tidiness: PW_BASE_URL is
      // routinely set to the keyless 5181 server for the navigation specs, and
      // an auth test run against a server with no auth would pass while
      // testing nothing — the exact vacuous-green defect that
      // theme-contrast.spec.ts was filed for. The specs themselves also assert
      // the gate is present before trusting any sign-in result, so a
      // misconfiguration fails loudly instead of silently.
      name: 'chromium-authed',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.CLERK_TEST_BASE_URL || 'http://localhost:5173',
      },
      testMatch: /.*\.authed\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
