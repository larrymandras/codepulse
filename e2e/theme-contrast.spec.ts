// RED-pending: All 20 test cases (4 themes x 5 pages) will fail until:
// - Plan 02 (89-02): readable + aubergine token blocks added to src/index.css
// - Plan 03 (89-03): no-flash inline script + localStorage key consolidation
// - Plan 04 (89-04): hardcoded hex sites migrated to var(--token)
// These specs become green at the 89-VALIDATION.md Phase Gate (post all waves).
// Do NOT treat failures here as regressions during Plans 02-06 execution.

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
