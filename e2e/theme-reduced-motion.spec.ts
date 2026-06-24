import { test, expect } from "@playwright/test";

test.describe("prefers-reduced-motion suppression", () => {
  test("aubergine theme: .matrix-bg and .crt-scanline-bar are hidden under reduced-motion", async ({
    page,
  }) => {
    // Emulate reduced-motion OS preference BEFORE navigation
    await page.emulateMedia({ reducedMotion: "reduce" });

    // Set aubergine theme — both .matrix-bg and .crt-scanline-bar should be
    // suppressed by the CSS rules added in Plan 02 for readable/aubergine themes
    await page.addInitScript(() => {
      localStorage.setItem("codepulse-theme", "aubergine");
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // .matrix-bg should be display:none under [data-theme="aubergine"]
    await expect(page.locator(".matrix-bg")).toBeHidden();

    // .crt-scanline-bar should be display:none under [data-theme="aubergine"]
    await expect(page.locator(".crt-scanline-bar")).toBeHidden();
  });

  test("readable theme: .matrix-bg and .crt-scanline-bar are hidden (theme-driven, not motion-driven)", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("codepulse-theme", "readable");
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".matrix-bg")).toBeHidden();
    await expect(page.locator(".crt-scanline-bar")).toBeHidden();
  });
});
