import { test, expect } from "@playwright/test";
import { SENTINEL, sampleColor, getThemeTokenText, type RGB } from "./lib/contrast";

/**
 * D-03 (Phase 125, plan 01): proves the aurora derivation actually RENDERS,
 * not just that src/index.css's text says so. For each of the five
 * data-theme values the switcher can reach (ThemeSwitcher.tsx's
 * VALID_THEMES plus `amber`, which carries the full token set per Phase
 * 122's D-04 even though it is unexposed in the switcher UI), this reads
 * the computed --aurora-a/b/c and --primary/--astridr/--status-ok values as
 * raw declared-text strings and rasterises each through the house
 * sentinel-guarded sampler (magenta SENTINEL -> fillStyle -> getImageData).
 *
 * THE COLOUR MEASUREMENT LAW (122-CONTEXT.md, 122-TOKEN-LAW.md,
 * `[[tailwind-v4-oklch-defeats-css-color-scraping]]`): never regex-scrape an
 * oklch()/oklab() string for channel values -- Phase 120's withdrawn
 * measurement's tell was an impossible `rgb(0,0,262)`. Every colour claim
 * below goes through `sampleColor`, which hands the raw string straight to
 * `canvas.fillStyle` (a real browser colour parser) and reads back true
 * sRGB bytes via `getImageData`.
 */

const THEMES = ["cyan", "emerald", "amber", "readable", "aubergine"] as const;

const AURORA_PAIRS: Array<{ aurora: string; owner: string }> = [
  { aurora: "--aurora-a", owner: "--primary" },
  { aurora: "--aurora-b", owner: "--astridr" },
  { aurora: "--aurora-c", owner: "--status-ok" },
];

test.describe("D-03: Signal Horizon aurora tokens resolve to their hue owners per theme", () => {
  test("all five themes: --aurora-a/b/c sample identically to --primary/--astridr/--status-ok, with a discriminating control", async ({
    page,
  }) => {
    await page.goto("/");

    // Restore whatever data-theme this page started with (the no-flash
    // pre-paint script or the persisted localStorage value), regardless of
    // pass/fail below. `page` is a test-scoped fixture, not a worker-scoped
    // one, so this is done with try/finally inside the test body rather
    // than a Playwright `afterAll` hook, which cannot receive `page`.
    const originalTheme = await page.evaluate(() => document.documentElement.dataset.theme ?? null);

    try {
      for (const theme of THEMES) {
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, theme);

        const rawValues: Record<string, string> = {};
        const samples: Record<string, RGB | null> = {};
        for (const { aurora, owner } of AURORA_PAIRS) {
          const auroraText = await getThemeTokenText(page, aurora);
          const ownerText = await getThemeTokenText(page, owner);
          rawValues[aurora] = auroraText;
          rawValues[owner] = ownerText;
          samples[aurora] = await sampleColor(page, auroraText);
          samples[owner] = await sampleColor(page, ownerText);
        }

        // Refuse to report on an unresolvable sample rather than compare
        // against a substituted default (the house sentinel-guard rule).
        for (const { aurora, owner } of AURORA_PAIRS) {
          expect(samples[aurora], `[${theme}] ${aurora} ("${rawValues[aurora]}") sampled null`).not.toBeNull();
          expect(samples[owner], `[${theme}] ${owner} ("${rawValues[owner]}") sampled null`).not.toBeNull();
        }

        // The actual claim: each aurora channel renders the SAME sRGB bytes
        // as its declared hue owner.
        for (const { aurora, owner } of AURORA_PAIRS) {
          expect(samples[aurora], `[${theme}] ${aurora} vs ${owner}`).toEqual(samples[owner]);
        }

        // The control the house law requires: a sampler that returned the
        // sentinel (or any constant) for everything would pass the equality
        // assertions above vacuously. Assert --aurora-a's sample does NOT
        // equal --status-ok's sample, so this control can only pass if the
        // sampler is actually discriminating between distinct hue owners.
        expect(samples["--aurora-a"], `[${theme}] control: aurora-a must differ from status-ok`).not.toEqual(
          samples["--status-ok"],
        );

        // Print the raw sampled RGB triples for the record -- required
        // evidence per this plan's acceptance criteria, not optional.
        console.log(
          `[signal-tokens][${theme}] --aurora-a=${JSON.stringify(samples["--aurora-a"])} ` +
            `--primary=${JSON.stringify(samples["--primary"])} ` +
            `--aurora-b=${JSON.stringify(samples["--aurora-b"])} ` +
            `--astridr=${JSON.stringify(samples["--astridr"])} ` +
            `--aurora-c=${JSON.stringify(samples["--aurora-c"])} ` +
            `--status-ok=${JSON.stringify(samples["--status-ok"])}`,
        );
      }
    } finally {
      await page.evaluate((orig) => {
        if (orig === null) {
          delete document.documentElement.dataset.theme;
        } else {
          document.documentElement.dataset.theme = orig;
        }
      }, originalTheme);
    }
  });

  test("probe self-control: sampleColor refuses an unparseable string rather than returning the sentinel colour", async ({
    page,
  }) => {
    await page.goto("/");
    const invalid = await sampleColor(page, "not-a-color-9x7q2-signal");
    const known = await sampleColor(page, "#ffffff");
    console.log(`[signal-tokens][self-control] invalid=${invalid} known=${JSON.stringify(known)} SENTINEL=${SENTINEL}`);
    expect(invalid).toBeNull();
    expect(known).toEqual([255, 255, 255]);
  });
});
