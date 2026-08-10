import { test, expect } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";

/**
 * The ONLY specs that exercise the Clerk auth gate itself.
 *
 * Closes astridr-repo
 * `.planning/todos/pending/2026-08-10-playwright-clerk-auth-fixture.md`, which
 * recorded that after 188.4-03 routed the 7 gated specs around the gate via a
 * keyless server, no spec in the suite tested authentication at all — sign-in,
 * sign-out and protected-route redirect were entirely uncovered.
 *
 * These run under the `chromium-authed` project against the GATED server. Every
 * other spec runs keyless. Do not merge the two: a keyless run of this file
 * would exercise nothing, which is why AUTH-GATE-PRESENT below exists.
 *
 * Sign-in uses the email/ticket strategy rather than a password. `clerk.signIn`
 * finds the user by email and mints a sign-in token through Clerk's backend API
 * using CLERK_SECRET_KEY, so no test-user password needs to live in .env.local
 * at all — one fewer secret on disk for the same coverage.
 */

const TEST_EMAIL = process.env.CLERK_TEST_EMAIL || "codepulse+clerk_test@example.com";

// The app shell's own nav — rendered only INSIDE AuthGuard, so its presence is
// equivalent to "the gate let us through". Same marker theme-contrast.spec.ts
// uses (DashboardLayout.tsx:257). `.first()` because the layout renders a
// desktop and a mobile aside, each containing one.
const appShellNav = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Main navigation" }).first();

const signInGate = (page: import("@playwright/test").Page) =>
  page.getByText("Sign in to access the telemetry dashboard");

test.describe("Clerk auth gate", () => {
  test("AUTH-GATE-PRESENT: signed out, a protected route shows the sign-in screen and NOT the app shell", async ({
    page,
  }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/");

    // This is the precondition for every other test in this file, and the
    // reason a misdirected run cannot pass quietly: against the keyless
    // dev:noauth server the app renders immediately and this assertion fails,
    // rather than the sign-in tests below "passing" without any auth involved.
    await expect(signInGate(page)).toBeVisible({ timeout: 15000 });
    await expect(appShellNav(page)).toHaveCount(0);
  });

  test("AUTH-SIGNIN-RENDERS-APP: after signing in, the protected route renders the app shell", async ({
    page,
  }) => {
    // clerk.signIn requires a prior goto to a page that has loaded Clerk. The
    // sign-in screen qualifies — ClerkProvider wraps the whole tree in
    // main.tsx, so Clerk is loaded even while AuthGuard is showing the gate.
    await page.goto("/");
    await expect(signInGate(page)).toBeVisible({ timeout: 15000 });

    await clerk.signIn({ page, emailAddress: TEST_EMAIL });

    await page.goto("/");
    await expect(appShellNav(page)).toBeVisible({ timeout: 15000 });
    await expect(signInGate(page)).toHaveCount(0);
  });

  test("AUTH-SIGNOUT-RESTORES-GATE: after signing out, the protected route returns to the sign-in screen", async ({
    page,
  }) => {
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: TEST_EMAIL });
    await page.goto("/");
    await expect(appShellNav(page)).toBeVisible({ timeout: 15000 });

    // The paired control for AUTH-SIGNIN-RENDERS-APP: without this, a build
    // where AuthGuard had been accidentally disabled would satisfy the sign-in
    // test just as well, because the app shell would render either way.
    await clerk.signOut({ page });

    await page.goto("/");
    await expect(signInGate(page)).toBeVisible({ timeout: 15000 });
    await expect(appShellNav(page)).toHaveCount(0);
  });
});
