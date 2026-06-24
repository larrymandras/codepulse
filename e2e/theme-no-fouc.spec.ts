import { test, expect } from "@playwright/test";

test.describe("No-FOUC pre-paint script", () => {
  test("readable theme: data-theme is set on domcontentloaded (before React hydration)", async ({
    page,
  }) => {
    // Seed the theme key before navigation — simulates a returning user
    await page.addInitScript(() => {
      localStorage.setItem("codepulse-theme", "readable");
    });

    // Capture data-theme on the DOMContentLoaded event, which fires before
    // the React <script type="module"> bundle runs. The inline pre-paint script
    // must have already set the attribute by this point.
    let dataThemeOnDCL = "";
    let hasClassDarkOnDCL = false;

    await page.goto("/", { waitUntil: "domcontentloaded" });

    dataThemeOnDCL = await page.evaluate(
      () => document.documentElement.getAttribute("data-theme") ?? ""
    );
    hasClassDarkOnDCL = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );

    expect(dataThemeOnDCL).toBe("readable");
    expect(hasClassDarkOnDCL).toBe(true);
  });

  test("default theme: data-theme defaults to cyan when no key is stored", async ({
    page,
  }) => {
    // No localStorage seed — simulates a first-time visitor

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const dataTheme = await page.evaluate(
      () => document.documentElement.getAttribute("data-theme") ?? ""
    );

    expect(dataTheme).toBe("cyan");
  });
});
