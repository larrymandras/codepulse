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
      await page.addInitScript((t: string) => {
        localStorage.setItem("codepulse-theme", t);
      }, theme);

      await page.goto(pg.path);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
}
