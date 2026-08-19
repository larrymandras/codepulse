import { test, expect, type Page } from "@playwright/test";

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

// ─────────────────────────────────────────────────────────────────────────
// D-11/D-12 (122-18): population-level no-motion assertions, each paired
// with a control that MUST show motion. A green population check that
// silently measured nothing (a broken selector, a broken theme switch, an
// element walk that runs before paint) is indistinguishable from a green
// population check that measured a genuinely motion-free page -- so every
// assertion below is paired with a run of the SAME probe that is required
// to come back non-empty. See 122-CONTEXT.md D-11/D-12 and this repo's own
// memory: a green that means "the probe measured nothing" reads identically
// to a real pass, and only a must-differ control tells them apart.
// ─────────────────────────────────────────────────────────────────────────

async function gotoWithTheme(page: Page, theme: string) {
  await page.addInitScript((t: string) => {
    localStorage.setItem("codepulse-theme", t);
    localStorage.setItem("codepulse_onboarding_complete", "true");
  }, theme);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

/**
 * Walk every element in the document, plus its ::before/::after pseudo
 * elements, and collect any reporting a non-zero animation-duration or a
 * non-zero entry in transition-duration.
 *
 * Population check, not a per-effect list -- that is the entire point of
 * D-12: a NEW animation added anywhere in the app is caught by this walk
 * without anyone having to remember to add it to an enumerated list.
 *
 * Pseudo-element phantom-offender handling: getComputedStyle(el, "::before")
 * returns a value for every element, even ones with no `content` (i.e. no
 * pseudo-element is actually generated in the render tree). Filtered on
 * `content !== "none"` so a phantom `::before`/`::after` that generates no
 * box is never reported as an offender -- confirmed necessary by running the
 * walk unfiltered first, which produced offenders naming pseudo-elements on
 * plain <div>s and <span>s with no `content` declared anywhere in the app's
 * CSS (i.e. exactly the phantom case this filter exists to remove).
 */
async function findMotionOffenders(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bad: string[] = [];
    const all: Element[] = [document.documentElement, ...Array.from(document.querySelectorAll("*"))];
    for (const el of all) {
      for (const pseudo of [undefined, "::before", "::after"] as const) {
        const cs = getComputedStyle(el, pseudo);
        if (pseudo !== undefined && cs.content === "none") continue; // phantom pseudo-element, no box generated
        const hasAnim = cs.animationDuration !== "0s" && cs.animationName !== "none";
        const hasTrans = cs.transitionDuration.split(", ").some((d) => d !== "0s");
        if (hasAnim || hasTrans) {
          const tag = pseudo ? `${el.tagName}${pseudo}` : el.tagName;
          const cls = (el as HTMLElement).className ? `.${String((el as HTMLElement).className).split(" ").join(".")}` : "";
          bad.push(`${tag}${cls}: anim=${cs.animationDuration}/${cs.animationName} trans=${cs.transitionDuration}`);
        }
      }
    }
    return bad;
  });
}

function assertNoOffenders(offenders: string[], label: string) {
  if (offenders.length !== 0) {
    const shown = offenders.slice(0, 5).join("\n  - ");
    const more = offenders.length > 5 ? `\n  (+${offenders.length - 5} more)` : "";
    throw new Error(
      `${label}: expected zero motion offenders, found ${offenders.length}:\n  - ${shown}${more}`,
    );
  }
}

function assertHasOffenders(offenders: string[], label: string) {
  expect(
    offenders.length,
    `${label}: control probe found ZERO offenders -- this invalidates the paired assertion above ` +
      `(a green there would mean "the probe measured nothing", not "the app is motion-free")`,
  ).toBeGreaterThan(0);
}

test.describe("D-12: population-level reduced-motion check, paired with a must-show-motion control", () => {
  test("REDUCED MOTION (cyan): no element reports non-zero animation/transition duration under prefers-reduced-motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoWithTheme(page, "cyan");
    const offenders = await findMotionOffenders(page);
    console.log(`[cyan][reduced-motion] offender count: ${offenders.length}`);
    assertNoOffenders(offenders, "cyan under prefers-reduced-motion");
  });

  test("CONTROL: the same page (cyan, no reduced-motion override) DOES show motion", async ({
    page,
  }) => {
    // No emulateMedia call -- default OS preference (no-preference).
    await gotoWithTheme(page, "cyan");
    const offenders = await findMotionOffenders(page);
    console.log(`[cyan][no override] offender count: ${offenders.length} (must be > 0)`);
    assertHasOffenders(offenders, "cyan with no reduced-motion override");
  });
});

test.describe("D-11: readable's blanket no-effects rule, paired with a must-show-motion control", () => {
  test("READABLE (no reduced-motion override): no element reports non-zero animation/transition duration", async ({
    page,
  }) => {
    // Deliberately NO emulateMedia call -- readable's suppression is
    // theme-driven (the blanket `[data-theme="readable"]` rule), not
    // motion-preference-driven. D-11's whole point is that a new animation
    // is effect-free under `readable` BY DEFAULT, without needing the OS
    // reduced-motion preference to be set at all.
    await gotoWithTheme(page, "readable");
    const offenders = await findMotionOffenders(page);
    console.log(`[readable][no override] offender count: ${offenders.length}`);
    assertNoOffenders(offenders, "readable with no reduced-motion override");
  });

  test("CONTROL: cyan (no reduced-motion override) DOES show motion", async ({ page }) => {
    await gotoWithTheme(page, "cyan");
    const offenders = await findMotionOffenders(page);
    console.log(`[cyan][no override, readable's control] offender count: ${offenders.length} (must be > 0)`);
    assertHasOffenders(offenders, "cyan (readable's control)");
  });
});
