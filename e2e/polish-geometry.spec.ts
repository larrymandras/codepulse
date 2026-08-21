import { test, expect, type Page } from '@playwright/test';

/**
 * Geometry proof for 120-07 (POLISH-02, POLISH-06).
 *
 * Follows the command-center-breakpoints.spec.ts discipline: every claim carries an in-page
 * `window.innerWidth` reading — Playwright's own reported viewport size is NEVER the source of
 * truth for an assertion, because `resize_window` has silently no-opped in this repo before
 * while reporting success.
 *
 * Block 1 (POLISH-02) proves the E-Stop control holds fixed geometry — identical width, identical
 * height, and no line break in its label — from 360px (mobile) through 2560px (ultrawide).
 *
 * WRAP-DETECTION CORRECTION (found live during this plan's Task 1, before any source change):
 * the label is `<span>E-Stop</span>`, a DIRECT CHILD of a `display: flex` button. CSS
 * blockification means a flex item's computed `display` is forced to `block` regardless of its
 * specified value — verified live: `getComputedStyle(labelSpan).display === "block"`. A block
 * box's own `getClientRects()` ALWAYS returns exactly 1 rect (the block's border box) even when
 * the text inside it wraps across two lines; only an INLINE element fragments into one rect per
 * visual line. So `labelSpan.getClientRects().length` can never detect this wrap — it is
 * structurally blind to the exact defect it was written to catch, and reported a vacuous 1 at
 * every width during this file's own pre-fix run, while `buttonHeight` (48 vs 28) already showed
 * something was wrong. The correct place to read line-fragmentation is the TEXT NODE inside the
 * span (`document.createRange().selectNodeContents(textNode).getClientRects()`), because a text
 * node is never blockified — it fragments into one rect per visual line regardless of its
 * container's computed display. Confirmed empirically: at 640px the text-node range reports 2
 * rects ("E-" / "Stop", the exact hyphen break the plan's <interfaces> section predicted) while
 * the span itself reports 1. Both are captured below; only the text-node count is asserted on.
 *
 * Block 2 (POLISH-06) reproduces the 900px sidebar/Settings collision BEFORE any source change and
 * names the overflowing element by walking every descendant of <body> for horizontal overflow.
 * (Widened from <main> to <body> mid-task — see the inline comment above the walk for why: the
 * real defect lives in the shared <header>, not in Settings' own content.)
 *
 * Each measurement is emitted as a single console.log line so it can be transcribed verbatim into
 * 120-GEOMETRY-EVIDENCE.md rather than re-typed or re-derived.
 */

const ESTOP_WIDTHS = [360, 640, 900, 1440, 2560];
const VIEWPORT_HEIGHT = 900;

interface EstopEvidence {
  requestedWidth: number;
  innerWidth: number;
  buttonWidth: number;
  buttonHeight: number;
  buttonClientRectsLength: number;
  labelClientRectsLength: number | null;
  labelComputedDisplay: string | null;
  labelTextNodeRectsLength: number | null;
  labelOffsetHeight: number | null;
}

interface OverflowCulprit {
  tag: string;
  className: string;
  scrollWidth: number;
  clientWidth: number;
  right: number;
  overflowAmount: number;
}

interface Settings900Evidence {
  innerWidth: number;
  scrollWidth: number;
  bodyScrollWidth: number;
  asideRect: { x: number; y: number; width: number; height: number } | null;
  mainRect: { x: number; y: number; width: number; height: number } | null;
  culprits: OverflowCulprit[];
}

/** Race-safe gate check identical to command-center-breakpoints.spec.ts's idiom. Returns true
 * (and calls test.skip) if the Clerk sign-in gate is what actually rendered. */
async function gateOrSkip(page: Page, target: ReturnType<Page['getByRole']> | ReturnType<Page['locator']>, label: string) {
  const signInText = page.getByText('Sign in to access the telemetry dashboard');
  await expect(signInText.or(target).first()).toBeVisible({ timeout: 15000 });
  if (await signInText.count()) {
    test.skip(
      true,
      `Clerk auth gate present — ${label} could not be honestly rendered or measured. Recorded as NOT verified in 120-GEOMETRY-EVIDENCE.md, never as a pass.`
    );
  }
}

async function readEstopEvidence(page: Page, requestedWidth: number): Promise<EstopEvidence> {
  const estopButton = page.getByRole('button', { name: 'Emergency Stop' });
  return estopButton.evaluate((btn, w) => {
    const rect = btn.getBoundingClientRect();
    const label = btn.querySelector('span');
    const textNode = label?.firstChild ?? null;
    let textNodeRectsLength: number | null = null;
    if (textNode) {
      const range = document.createRange();
      range.selectNodeContents(textNode);
      textNodeRectsLength = range.getClientRects().length;
    }
    return {
      requestedWidth: w,
      innerWidth: window.innerWidth,
      buttonWidth: rect.width,
      buttonHeight: rect.height,
      buttonClientRectsLength: btn.getClientRects().length,
      labelClientRectsLength: label ? label.getClientRects().length : null,
      labelComputedDisplay: label ? getComputedStyle(label).display : null,
      labelTextNodeRectsLength: textNodeRectsLength,
      labelOffsetHeight: label instanceof HTMLElement ? label.offsetHeight : null,
    } satisfies EstopEvidence;
  }, requestedWidth);
}

test.describe('E-Stop fixed geometry — in-page proof (POLISH-02)', () => {
  for (const width of ESTOP_WIDTHS) {
    test(`${width}px — E-Stop holds fixed geometry, single-line label`, async ({ page }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto('/');

      const estopButton = page.getByRole('button', { name: 'Emergency Stop' });
      await gateOrSkip(page, estopButton, `the ${width}px E-Stop tier`);

      await expect(estopButton).toBeVisible();

      const evidence = await readEstopEvidence(page, width);

      // eslint-disable-next-line no-console
      console.log(`ESTOP-GEOMETRY-EVIDENCE ${JSON.stringify(evidence)}`);

      // A mismatch means the resize silently did not take — void this tier's assertions rather
      // than reporting them as if the requested width actually rendered.
      expect(
        evidence.innerWidth,
        `in-page window.innerWidth (${evidence.innerWidth}) must match the requested viewport width (${width}) or this tier is VOID`
      ).toBe(width);

      // The TEXT NODE's client-rect count is the mechanically correct wrap detector: a text node
      // is never CSS-blockified, so it fragments into one rect per visual line regardless of the
      // parent span's computed display. (The span itself is blockified by its flex-item context
      // and its own getClientRects() is captured above for the record, but is NOT asserted on —
      // it always reports 1 even when the text inside wraps, which is exactly why this file
      // switched to the text-node range mid-task; see the header comment.)
      expect(
        evidence.labelTextNodeRectsLength,
        `label text node must report exactly 1 client rect at ${width}px (>1 means the label wrapped) — got ${JSON.stringify(evidence)}`
      ).toBe(1);
    });
  }

  test('button width and height are identical across all five widths', async ({ page }) => {
    const collected: EstopEvidence[] = [];
    for (const width of ESTOP_WIDTHS) {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto('/');

      const estopButton = page.getByRole('button', { name: 'Emergency Stop' });
      await gateOrSkip(page, estopButton, `the ${width}px cross-width comparison`);

      await expect(estopButton).toBeVisible();

      collected.push(await readEstopEvidence(page, width));
    }

    // eslint-disable-next-line no-console
    console.log(`ESTOP-GEOMETRY-CROSSWIDTH-EVIDENCE ${JSON.stringify(collected)}`);

    const [first, ...rest] = collected;
    for (const e of rest) {
      expect(
        Math.abs(e.buttonHeight - first.buttonHeight),
        `height at ${e.requestedWidth}px (${e.buttonHeight}) must match height at ${first.requestedWidth}px (${first.buttonHeight}) — a two-line wrap changes height`
      ).toBeLessThan(0.5);
      expect(
        Math.abs(e.buttonWidth - first.buttonWidth),
        `width at ${e.requestedWidth}px (${e.buttonWidth}) must match width at ${first.requestedWidth}px (${first.buttonWidth}) — fixed geometry means constant width too`
      ).toBeLessThan(0.5);
    }
  });
});

// ─── Plan 124-10 additions below ───────────────────────────────────────────
// D-06's re-run of POLISH-06's measurement, now that the consolidated 3-zone
// header (124-07 through 124-09) is built. See the plan's <interfaces> section
// and 120-GEOMETRY-EVIDENCE.md for why this re-measurement exists at all.

const HEADER_ZONE_WIDTHS = [375, 900];

interface HeaderZoneEvidence {
  className: string;
  display: string;
  hidden: boolean;
  laidOutWidth: number;
  minContentWidth: number;
}

interface HeaderZonesEvidence {
  requestedWidth: number;
  innerWidth: number;
  headerClientWidth: number;
  headerPaddingLeft: number;
  headerPaddingRight: number;
  headerAvailableWidth: number;
  headerHeight: number;
  headerClientRectsLength: number;
  zones: HeaderZoneEvidence[];
  sumMinContentWidth: number;
  culprits: OverflowCulprit[];
}

test.describe('Header three-zone min-content measurement — D-06 branch decision (124-10)', () => {
  for (const width of HEADER_ZONE_WIDTHS) {
    test(`${width}px — header zone min-content vs available width`, async ({ page }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto('/');

      const header = page.locator('header').first();
      await gateOrSkip(page, header, `the ${width}px header-zones measurement`);

      await expect(header).toBeVisible();

      const evidence = await header.evaluate((headerEl, w) => {
        const zones: HeaderZoneEvidence[] = [];
        let sum = 0;
        Array.from(headerEl.children).forEach((child) => {
          const el = child as HTMLElement;
          const cs = getComputedStyle(el);
          if (cs.display === 'none') {
            // Genuinely not rendered at this viewport (e.g. the `hidden
            // md:flex` command bar / breadcrumb below `md`) — contributes 0
            // to the header's real content-driven width, not an unmeasured
            // gap. Recorded, not silently dropped.
            zones.push({
              className: el.className,
              display: cs.display,
              hidden: true,
              laidOutWidth: 0,
              minContentWidth: 0,
            });
            return;
          }
          const laidOutWidth = el.getBoundingClientRect().width;
          // Min-content measured IN PLACE, one zone at a time: force this
          // zone's used width to `min-content`, then measure, then restore
          // the original inline style before moving to the next zone. Not a
          // detached clone — a clone re-parented outside the flex row would
          // lose the flex-item context that determines whether `width:
          // min-content` even applies at all, and this file's own POLISH-02
          // methodology-correction section already shows an unverified
          // measurement mechanism is worse than none.
          //
          // CORRECTION found live during this task: setting `flex-basis`
          // alone is NOT sufficient for the command-bar zone (`flex-1`,
          // i.e. `flex: 1 1 0%`) — flex-grow stays 1 from that class, so the
          // item still grows to consume all leftover row space up to its
          // `max-w-[420px]` cap regardless of the basis, and the first pass
          // of this measurement recorded a false 420px "min-content" for it
          // at every width. `flex: none` (grow:0, shrink:0, basis:auto)
          // fully decouples the item from the row's flex distribution before
          // `width: min-content` is applied, which is what a true min-content
          // reading requires.
          const savedWidth = el.style.width;
          const savedFlex = el.style.flex;
          el.style.flex = 'none';
          el.style.width = 'min-content';
          const minContentWidth = el.getBoundingClientRect().width;
          el.style.width = savedWidth;
          el.style.flex = savedFlex;
          sum += minContentWidth;
          zones.push({
            className: el.className,
            display: cs.display,
            hidden: false,
            laidOutWidth,
            minContentWidth,
          });
        });
        const headerRect = headerEl.getBoundingClientRect();
        // The header's own px-6 padding is INSIDE clientWidth (clientWidth =
        // content-box + padding, minus border/scrollbar) but is NOT available
        // to the three zone children, which sit inside the padded content
        // box. Comparing the zones' summed width straight against clientWidth
        // would silently give them 48px of room they do not actually have —
        // subtract the header's own left/right padding to get the width the
        // zones are really competing for.
        const headerCs = getComputedStyle(headerEl);
        const headerPaddingLeft = parseFloat(headerCs.paddingLeft) || 0;
        const headerPaddingRight = parseFloat(headerCs.paddingRight) || 0;

        // Wrap-branch regression guard: walk every descendant of the header
        // itself (not the whole body — that is the existing 900px /settings
        // block's job) and flag any box whose right edge actually extends
        // past window.innerWidth. Same `rightOverflow > 1` criterion and
        // `sr-only` exclusion as the existing 900px collision walk below
        // (found live there to avoid two known-benign false positives —
        // Radix's `sr-only` clipping technique and the sidebar nav's own
        // contained `overflow-x-auto` scroll).
        const culprits: OverflowCulprit[] = [];
        headerEl.querySelectorAll('*').forEach((node) => {
          const cEl = node as HTMLElement;
          if (cEl.classList.contains('sr-only')) return;
          const rect = cEl.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;
          const scrollOverflow = cEl.scrollWidth - cEl.clientWidth;
          const rightOverflow = rect.right - w;
          if (rightOverflow > 1) {
            culprits.push({
              tag: cEl.tagName,
              className: typeof cEl.className === 'string' ? cEl.className : String(cEl.className),
              scrollWidth: cEl.scrollWidth,
              clientWidth: cEl.clientWidth,
              right: rect.right,
              overflowAmount: Math.max(scrollOverflow, rightOverflow),
            });
          }
        });
        culprits.sort((a, b) => b.overflowAmount - a.overflowAmount);

        return {
          requestedWidth: w,
          innerWidth: window.innerWidth,
          headerClientWidth: headerEl.clientWidth,
          headerPaddingLeft,
          headerPaddingRight,
          headerAvailableWidth: headerEl.clientWidth - headerPaddingLeft - headerPaddingRight,
          headerHeight: headerRect.height,
          headerClientRectsLength: headerEl.getClientRects().length,
          zones,
          sumMinContentWidth: sum,
          culprits: culprits.slice(0, 15),
        } satisfies HeaderZonesEvidence;
      }, width);

      // eslint-disable-next-line no-console
      console.log(`HEADER-ZONES-EVIDENCE ${JSON.stringify(evidence)}`);

      // Void check first, per this file's existing convention.
      expect(
        evidence.innerWidth,
        `in-page window.innerWidth (${evidence.innerWidth}) must match the requested viewport width (${width}) or this tier is VOID`
      ).toBe(width);

      // Permanent regression guard (Task 1's own acceptance criterion). The
      // measurement above (see SUMMARY) found the sum of zone min-content
      // widths EXCEEDS the header's available width at both 375px and 900px
      // — decisively, not marginally (706 vs 620 available at 900px; 351.5
      // vs 327 at 375px) — so D-06's "clears with margin" branch was NOT
      // taken; `min-h-14 flex-wrap gap-y-1` stays. Per the plan's own
      // branch-dependent guard spec, the wrap branch's guard is therefore
      // NOT "sum stays under available width" (that would never pass while
      // wrapping is structurally required, and asserting it would make this
      // a test of a fact already known false) — it is "the header still
      // renders every right-zone control within the viewport" despite the
      // wrap, i.e. no header descendant actually clips past the edge. This
      // is what would fail if a future change broke `flex-wrap` again.
      expect(
        evidence.culprits.length,
        `header culprit list must be empty at ${width}px (every control must render within the viewport even while wrapping); found: ${JSON.stringify(evidence.culprits)}`
      ).toBe(0);
    });
  }
});

test.describe('900px sidebar/Settings collision — in-page proof (POLISH-06)', () => {
  test('900x900 /settings has no horizontal overflow and an empty culprit list', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('/settings');

    const settingsHeading = page.getByText('Settings', { exact: true }).first();
    await gateOrSkip(page, settingsHeading, 'the 900px /settings collision check');

    await expect(settingsHeading).toBeVisible();

    const evidence = await page.evaluate(() => {
      const innerWidth = window.innerWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      const bodyScrollWidth = document.body.scrollWidth;

      const asideEl = document.querySelector('aside');
      const asideRect = asideEl
        ? (({ x, y, width, height }) => ({ x, y, width, height }))(asideEl.getBoundingClientRect())
        : null;

      const mainEl = document.querySelector('main');
      const mainRect = mainEl
        ? (({ x, y, width, height }) => ({ x, y, width, height }))(mainEl.getBoundingClientRect())
        : null;

      // WIDENED SCOPE — found live during this task, before any source change. The plan's own
      // <interfaces> section scoped this walk to "every element under the main content region".
      // At a plain 900x900 /settings load that scope legitimately finds ZERO culprits and
      // document.documentElement.scrollWidth === window.innerWidth — i.e. Task 1's reproduction
      // does NOT reproduce under <main>. Widening the walk to the whole <body> (per this task's
      // own widen-the-probe instruction) found the real defect: the shared <header> — present on
      // every route, not just /settings — has three unshrinkable flex-row groups whose combined
      // content-driven minimum width (981px measured) exceeds the header's own available width
      // (660px at 900px viewport). The excess renders PAST the header's box (header has no
      // overflow-hidden of its own) and is only invisibly clipped by a distant ancestor further
      // up the tree, which is why document.documentElement.scrollWidth stayed bounded while real,
      // large (204-384px measured across 820-1000px) element-level overflow existed. See
      // 120-GEOMETRY-EVIDENCE.md § BEFORE for the full widened-probe matrix (widths, sidebar
      // collapsed/expanded, Settings Sheet open/closed).
      // CRITERION REFINEMENT — found live once the header fix was applied, before this was
      // finalized. A body-wide walk's `scrollOverflow` half (el.scrollWidth > el.clientWidth)
      // fires on two benign, pre-existing patterns unrelated to "collides with the sidebar" /
      // "cut off at the right edge": (1) Radix/shadcn's `sr-only` accessibility technique
      // deliberately clips a full-width dialog title/description to a 1px box — scrollWidth ~=
      // its full text width vs clientWidth 1px BY DESIGN, never rendered, never cut off; (2) the
      // sidebar <nav> already declares its own `overflow-x-auto` and its children's few-px
      // internal scrollWidth mismatch is contained and reachable by that ancestor's own scroll,
      // not a page-edge collision. Neither has any `rightOverflow` (both were measured at
      // -661..-900, nowhere near the viewport edge). `rightOverflow` — the element's own box
      // actually extending past `window.innerWidth` — is the literal, unambiguous "cut off at
      // the right edge" observable and is what gates PASS/FAIL below; `scrollOverflow` is still
      // captured per element for the record but does not by itself fail the assertion.
      const culprits: OverflowCulprit[] = [];
      document.querySelectorAll('body *').forEach((node) => {
        const el = node as HTMLElement;
        if (el.classList.contains('sr-only')) return; // deliberately hidden, not a collision
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return; // not actually rendered/visible
        const scrollOverflow = el.scrollWidth - el.clientWidth;
        const rightOverflow = rect.right - innerWidth;
        if (rightOverflow > 1) {
          culprits.push({
            tag: el.tagName,
            className: typeof el.className === 'string' ? el.className : String(el.className),
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            right: rect.right,
            overflowAmount: Math.max(scrollOverflow, rightOverflow),
          });
        }
      });
      culprits.sort((a, b) => b.overflowAmount - a.overflowAmount);

      return {
        innerWidth,
        scrollWidth,
        bodyScrollWidth,
        asideRect,
        mainRect,
        culprits: culprits.slice(0, 15),
      } satisfies Settings900Evidence;
    });

    // eslint-disable-next-line no-console
    console.log(`SETTINGS-900-EVIDENCE ${JSON.stringify(evidence)}`);

    expect(
      evidence.innerWidth,
      `in-page window.innerWidth (${evidence.innerWidth}) must be 900 or this tier is VOID`
    ).toBe(900);

    expect(
      evidence.scrollWidth,
      `document.documentElement.scrollWidth (${evidence.scrollWidth}) must not exceed window.innerWidth (${evidence.innerWidth})`
    ).toBeLessThanOrEqual(evidence.innerWidth);

    expect(
      evidence.culprits.length,
      `culprit list must be empty; found: ${JSON.stringify(evidence.culprits)}`
    ).toBe(0);

    // D-17 (plan 124-10, Task 2): RE-RUN of this same check, at the NEW
    // 232px sidebar width, rather than a second/duplicate 900px block. The
    // `asideRect` value has always been captured above (:193-197 originally)
    // but never asserted on until now — the sidebar is already `w-[232px]`
    // live (124-05/124-09; DashboardLayout.tsx's desktop <aside>), so this
    // closes D-17's "re-measure, don't infer from 240px having survived" gap.
    // 0.5px tolerance for sub-pixel layout rounding, stated per the plan's
    // own instruction.
    expect(
      evidence.asideRect?.width,
      `aside width must be 232px (+/- 0.5px tolerance) at 900px; got ${JSON.stringify(evidence.asideRect)}`
    ).toBeGreaterThanOrEqual(231.5);
    expect(
      evidence.asideRect?.width,
      `aside width must be 232px (+/- 0.5px tolerance) at 900px; got ${JSON.stringify(evidence.asideRect)}`
    ).toBeLessThanOrEqual(232.5);
  });
});

// D-17/124-05 (plan 124-10, Task 2): the 2px active-nav rail, measured as
// RENDERED rather than asserted from a class string — jsdom (124-05's unit
// test) cannot compute a `::before` pseudo-element, only a real browser can.
interface NavRailEvidence {
  innerWidth: number;
  activeBeforeWidth: string;
  activeBeforeBackgroundColor: string;
  activeOwnBackgroundColor: string;
  inactiveBeforeWidth: string;
  inactiveBeforeBackgroundColor: string;
}

test.describe('Active nav rail — rendered measurement (D-17/124-05)', () => {
  test('/alerts — active link carries a rendered 2px ::before rail; an inactive link does not', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('/alerts');

    const activeLink = page.locator('[aria-current="page"]').first();
    await gateOrSkip(page, activeLink, 'the active nav rail measurement');

    await expect(activeLink).toBeVisible();

    const evidence = await page.evaluate(() => {
      const active = document.querySelector('[aria-current="page"]');
      // Control: an inactive sidebar nav link — same component, no isActive
      // styling, no `before:*` utility classes at all. Without this pairing,
      // a rule that applied the rail to EVERY nav item (active or not) would
      // pass just as easily as the correct one.
      const inactive = document.querySelector('nav[aria-label="Main navigation"] a:not([aria-current="page"])');

      const readBefore = (el: Element | null) => {
        if (!el) return { width: 'MISSING', backgroundColor: 'MISSING' };
        const cs = getComputedStyle(el, '::before');
        return { width: cs.width, backgroundColor: cs.backgroundColor };
      };

      const activeBefore = readBefore(active);
      const inactiveBefore = readBefore(inactive);
      const activeOwn = active ? getComputedStyle(active).backgroundColor : 'MISSING';

      return {
        innerWidth: window.innerWidth,
        activeBeforeWidth: activeBefore.width,
        activeBeforeBackgroundColor: activeBefore.backgroundColor,
        activeOwnBackgroundColor: activeOwn,
        inactiveBeforeWidth: inactiveBefore.width,
        inactiveBeforeBackgroundColor: inactiveBefore.backgroundColor,
      } satisfies NavRailEvidence;
    });

    // eslint-disable-next-line no-console
    console.log(`NAV-RAIL-EVIDENCE ${JSON.stringify(evidence)}`);

    expect(
      evidence.innerWidth,
      `in-page window.innerWidth (${evidence.innerWidth}) must be 900 or this tier is VOID`
    ).toBe(900);

    expect(
      evidence.activeBeforeWidth,
      `active link's ::before width must be 2px; got ${evidence.activeBeforeWidth}`
    ).toBe('2px');

    // Do NOT assert an exact colour string — Tailwind v4 emits oklch()/oklab()
    // and this project has already produced a confidently wrong contrast
    // verdict once by regex-scraping computed colour and reading a hue angle
    // as a channel (see tailwind-v4-oklch-defeats-css-color-scraping). Assert
    // only that a colour was actually applied (not transparent/unset), and
    // record the raw string for the operator checkpoint to judge.
    expect(
      evidence.activeBeforeBackgroundColor,
      `active link's ::before backgroundColor must not be transparent; got ${evidence.activeBeforeBackgroundColor}`
    ).not.toBe('rgba(0, 0, 0, 0)');
    expect(
      evidence.activeBeforeBackgroundColor,
      `active link's ::before backgroundColor must not be transparent; got ${evidence.activeBeforeBackgroundColor}`
    ).not.toBe('transparent');

    // Control (mandatory): the INACTIVE link's ::before must be absent/0px —
    // without this, a rule applying the rail to every nav item would also
    // pass the assertion above.
    expect(
      ['0px', 'auto', 'MISSING'],
      `inactive link's ::before width must read as absent/0px, not a real rail; got ${evidence.inactiveBeforeWidth}`
    ).toContain(evidence.inactiveBeforeWidth);
  });
});
