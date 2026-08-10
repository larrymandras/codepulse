import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const THEMES = ["cyan", "emerald", "readable", "aubergine"] as const;
const PAGES = [
  { name: "Dashboard", path: "/" },
  { name: "LiveRun", path: "/live-run" },
  { name: "Analytics", path: "/analytics" },
  { name: "Forge", path: "/forge" },
  { name: "Graphs", path: "/graphs" },
] as const;

for (const theme of THEMES) {
  for (const pg of PAGES) {
    test(`[${theme}] ${pg.name} — zero WCAG-AA contrast violations`, async ({
      page,
    }) => {
      // Set theme in localStorage before page navigation to avoid FOUC in test.
      // addInitScript runs before the page load, so the pre-paint inline script
      // (Plan 03) will see the correct codepulse-theme value from localStorage.
      // Also suppress OnboardingGuide's full-screen `fixed inset-0 z-50` overlay:
      // it is gated purely on localStorage (OnboardingGuide.tsx:39, no auth
      // dependency) and otherwise covers the page, so the contrast scan measures
      // the modal instead of the page under test.
      await page.addInitScript((t: string) => {
        localStorage.setItem("codepulse-theme", t);
        localStorage.setItem("codepulse_onboarding_complete", "true");
      }, theme);

      await page.goto(pg.path);
      await page.waitForLoadState("networkidle");

      // ─── Gate check (188.4 validation audit, 2026-08-10) ──────────────────
      // These 20 tests were PASSING VACUOUSLY behind the Clerk gate. Measured
      // 2026-08-10: gated 5173 gave 6 failed / 5 skipped / 27 passed, keyless
      // 5181 gave 20 failed / 18 passed, and every one of those 20 new
      // failures is in this file and was in the gated server's passing set.
      // They passed because the page under test never rendered — AuthGuard
      // (AuthGuard.tsx:18-37) replaces the whole app shell with a sign-in
      // screen that has almost no content and therefore almost no contrast to
      // violate. axe was scanning an empty page and finding nothing, which is
      // exactly the "absence checked without a control that could have shown
      // the thing present" class this 188.x line exists to remove.
      //
      // Same waiting-locator idiom as analytics-cache-tile.spec.ts:24-30 and
      // command-center-breakpoints.spec.ts:99-107. The marker is
      // DashboardLayout's own nav (DashboardLayout.tsx:257), which lives
      // INSIDE AuthGuard and is common to all five pages under test — unlike a
      // per-page heading it needs no per-route table to maintain. `.first()`
      // because the layout renders a desktop and a mobile aside, each
      // containing one.
      const signInText = page.getByText("Sign in to access the telemetry dashboard");
      const appShellNav = page.getByRole("navigation", { name: "Main navigation" }).first();
      await expect(signInText.or(appShellNav).first()).toBeVisible({ timeout: 15000 });

      if (await signInText.count()) {
        test.skip(
          true,
          `Clerk auth gate present — ${pg.name} never rendered, so a zero-violation result would ` +
            `measure the sign-in screen, not the page. Run against dev:noauth (see ` +
            `\`npm run test:e2e:noauth:help\`). Recorded as NOT verified, never as a pass.`,
        );
      }

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
}
