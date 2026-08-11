import { test, expect, type Page } from '@playwright/test';

/**
 * Command-center breakpoint proof (188.1-03, D-17).
 *
 * This spec exists to close 188-SMOKE.md's exact failure mode: `resize_window` reported success
 * while `window.innerWidth` stayed at 1920px, so lg/below-lg were never actually rendered or
 * measured. Every claim below MUST carry an in-page `window.innerWidth` reading and the tier's
 * `matchMedia(...)` result — read via `page.evaluate` from inside the page — and both neighbouring
 * tiers' `matchMedia` results, so a mis-tier (viewport resize that silently didn't take) cannot be
 * missed. Playwright's own reported viewport size is NEVER used as the source of truth for any
 * assertion here — only what the page itself reports about itself.
 *
 * Each tier's evidence object is emitted to stdout on a single line prefixed `D17-EVIDENCE ` so it
 * can be transcribed verbatim into 188.1-SMOKE.md without re-typing or re-deriving numbers.
 */

const LS_ONBOARDING = 'codepulse_onboarding_complete';
const LS_COMMAND_CENTER = 'codepulse-command-center';

const TIER_QUERIES = {
  xl: '(min-width: 1280px)',
  lg: '(min-width: 1024px) and (max-width: 1279px)',
  'below-lg': '(max-width: 1023px)',
} as const;

type TierName = keyof typeof TIER_QUERIES;

const TIERS: Array<{ name: TierName; width: number; height: number }> = [
  { name: 'xl', width: 1440, height: 900 },
  { name: 'lg', width: 1100, height: 900 },
  { name: 'below-lg', width: 900, height: 900 },
];

// 'ACTIVE AGENTS' removed 2026-08-11 (v14.0 audit INT-03): commit 87dafe30
// feat(111-02) deleted ActiveAgentsPanel, but this list still asserted its
// header was visible -- directly contradicting src/pages/Chat.test.tsx:1005,1012,
// which assert "ACTIVE AGENTS" is NOT in the document. The spec's own :104-109
// Clerk skip is why it went unnoticed: against the default :5173 server every
// tier skips, so it only fails when run unskipped against dev:noauth on :5181.
// The other six labels were each confirmed to resolve to a live component in
// src/components/control-center/; 'ACTIVE AGENTS' resolved to zero.
const PANEL_HEADERS = [
  'INTELLIGENCE FEED',
  'MISSION TIMELINE',
  'LLM STATUS',
  'SYSTEM MONITOR',
  'VOICE STATUS',
  'QUICK COMMANDS',
];

interface ViewportEvidence {
  tier: TierName;
  innerWidth: number;
  outerWidth: number;
  devicePixelRatio: number;
  matches: boolean;
  neighbours: Record<string, boolean>;
}

/**
 * The D-17 paired reading. Reads window.innerWidth, outerWidth, devicePixelRatio, and the
 * matchMedia result for the tier under test PLUS both neighbouring tier queries, all from inside
 * the page via a single page.evaluate call.
 */
async function readViewportEvidence(page: Page, tier: TierName): Promise<ViewportEvidence> {
  return page.evaluate(
    ({ tierQueries, tier: t }) => {
      const neighbours: Record<string, boolean> = {};
      for (const [name, query] of Object.entries(tierQueries)) {
        if (name === t) continue;
        neighbours[name] = window.matchMedia(query).matches;
      }
      return {
        tier: t,
        innerWidth: window.innerWidth,
        outerWidth: window.outerWidth,
        devicePixelRatio: window.devicePixelRatio,
        matches: window.matchMedia(tierQueries[t as TierName]).matches,
        neighbours,
      };
    },
    { tierQueries: TIER_QUERIES, tier }
  ) as Promise<ViewportEvidence>;
}

test.describe('Command-center breakpoints — in-page proof (D-17)', () => {
  for (const { name, width, height } of TIERS) {
    test(`${name} tier — renders and self-reports the correct viewport`, async ({ page }) => {
      // Suppress onboarding modal + force command-center mode ON via the same persisted
      // localStorage key Chat.tsx itself reads (codepulse-command-center, Chat.tsx:70).
      await page.addInitScript(
        ({ onboardingKey, ccKey }) => {
          window.localStorage.setItem(onboardingKey, 'true');
          window.localStorage.setItem(ccKey, 'true');
        },
        { onboardingKey: LS_ONBOARDING, ccKey: LS_COMMAND_CENTER }
      );

      await page.setViewportSize({ width, height });
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      // Race-safe gate check (brain-swap.spec.ts idiom): wait for either the Clerk sign-in gate OR
      // the command-center grid to actually paint before any .count() call.
      const signInText = page.getByText('Sign in to access the telemetry dashboard');
      const gridWrapper = page.getByTestId('cc-grid');
      await expect(signInText.or(gridWrapper).first()).toBeVisible({ timeout: 15000 });

      if (await signInText.count()) {
        test.skip(
          true,
          `Clerk auth gate present — the ${name} tier could not be honestly rendered or measured. Recorded as NOT verified in 188.1-SMOKE.md, never as a pass.`
        );
      }

      await expect(gridWrapper).toBeVisible();

      // Confirm command-center mode actually took (the grid testid only exists in that branch,
      // but assert explicitly so a future refactor that renames/duplicates the testid can't mask
      // a mode that silently reverted to calm).
      const ccFlag = await page.evaluate(
        (key) => window.localStorage.getItem(key),
        LS_COMMAND_CENTER
      );
      expect(ccFlag).toBe('true');

      // ── D-17 paired reading ────────────────────────────────────────────────────────────────
      const evidence = await readViewportEvidence(page, name);
      // eslint-disable-next-line no-console
      console.log(`D17-EVIDENCE ${JSON.stringify(evidence)}`);

      // Never assert on anything Playwright itself reports about the viewport — only on what the
      // page reads about itself.
      expect(evidence.matches, `${name} tier's own matchMedia must be true`).toBe(true);
      for (const [neighbourName, neighbourMatches] of Object.entries(evidence.neighbours)) {
        expect(
          neighbourMatches,
          `neighbouring tier "${neighbourName}"'s matchMedia must be false while "${name}" is true`
        ).toBe(false);
      }

      if (name === 'xl') {
        expect(evidence.innerWidth).toBeGreaterThanOrEqual(1280);
      } else if (name === 'lg') {
        expect(evidence.innerWidth).toBeGreaterThanOrEqual(1024);
        expect(evidence.innerWidth).toBeLessThanOrEqual(1279);
      } else {
        expect(evidence.innerWidth).toBeLessThanOrEqual(1023);
      }

      // ── Seven panels present at every tier ────────────────────────────────────────────────
      // Matcher is anchored at BOTH ends -- deliberately not `exact: false`,
      // because the Intelligence Feed renders arbitrary briefing prose and an
      // unanchored substring match could satisfy this assertion from feed text
      // rather than from a real panel header.
      //
      // The optional trailing group exists for exactly one known case: 188.1-04
      // (D-04) nests the "N FILTERED" disclosure INSIDE the same <span> as the
      // VOICE STATUS label (VoiceStatusPanel.tsx), so that element's text
      // content is "VOICE STATUS 0 FILTERED" and a bare `exact: true` finds no
      // element. That is correct per 188.1-UI-SPEC.md Part 5; this spec was
      // written before 188.1-04 landed and never validated against a real
      // render (the Clerk gate skipped every tier), so the assertion -- not the
      // component -- is the stale side. Caught 2026-08-06 on the first genuine
      // render of the command center.
      // NOTE the \s* (not \s+) between label and count: the live DOM's
      // textContent is literally "VOICE STATUS0 FILTERED" with NO separating
      // whitespace -- JSX drops it between the bare text node and the sibling
      // <span>. Verified 2026-08-06 by dumping textContent from inside the real
      // page; a \s+ matcher looks obviously right and never matches.
      for (const label of PANEL_HEADERS) {
        const headerMatcher = new RegExp(`^${label}(?:\\s*\\d+\\s*FILTERED)?$`);
        await expect(page.getByText(headerMatcher).first()).toBeVisible();
      }

      // ── D-14: CompactControlStrip confirmed at render, five controls in declared order ────
      const stripLabels = await page
        .getByTestId('compact-control-strip')
        .locator('button')
        .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label')));
      expect(stripLabels).toHaveLength(5);
      expect(stripLabels[0]).toBe('Choose brain');
      expect(stripLabels[1]).toBe('Choose voice');
      expect(stripLabels[2]).toMatch(/strict mode/i);
      expect(stripLabels[3]).toMatch(/focus mode/i);
      expect(stripLabels[4]).toMatch(/screen/i);

      // ── D-14: aura rendered width measured in-page, not from the class string ─────────────
      const auraWidth = await page
        .getByTestId('cc-aura-wrapper')
        .evaluate((el) => el.getBoundingClientRect().width);
      // eslint-disable-next-line no-console
      console.log(`D14-AURA-EVIDENCE ${JSON.stringify({ tier: name, auraWidth })}`);
      expect(auraWidth).toBeLessThanOrEqual(260.5); // command-center mode cap, small render tolerance

      // ── Self-bounding contract: zero page-level horizontal overflow ───────────────────────
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: window.innerWidth,
      }));
      expect(
        overflow.scrollWidth,
        `document.documentElement.scrollWidth (${overflow.scrollWidth}) must not exceed window.innerWidth (${overflow.clientWidth})`
      ).toBeLessThanOrEqual(overflow.clientWidth);

      // ── Self-bounding contract: footer band is REACHABLE, not merely present ──────────────
      // 188.1-03 live-render correction: `presence-ambient` (Chat.tsx:896) is a fixed
      // `h-full` column with NO document-level scroll by design (Chat.tsx:975-989's own
      // comment: "The page itself has no scroll"). The command-center content region
      // (grid + footer band) scrolls INSIDE its own `flex-1 min-h-0 overflow-y-auto`
      // wrapper. Comparing footerBox.y against `document.documentElement.scrollHeight`
      // therefore compares against a value that structurally can never grow past the
      // viewport — it does not measure reachability, only whether the *document* scrolls,
      // which this layout deliberately does not do. That produced two false failures on
      // the first genuine render (footer top 1516.5/3213 vs a document scrollHeight
      // pinned at 900) even though the vitals-column self-bound gap was a real, separate
      // defect (see below-lg-specific comment).
      //
      // The real observable a user experiences is: can the footer band be scrolled into
      // view at all, using the actual scrollable ancestor? `scrollIntoViewIfNeeded()`
      // exercises exactly that — the same mechanism a real scroll gesture would eventually
      // reach — then the assertion re-measures the footer's viewport-relative rect and
      // requires it to actually intersect the viewport. A footer that's merely far down an
      // internally-scrollable region is not "broken" (that's ordinary nested-scroll UX,
      // confirmed live: scrolling with the cursor over most of the grid content reaches it);
      // a footer that CANNOT be scrolled into view at all — e.g. clipped by an ancestor with
      // `overflow: hidden` instead of `auto` — would fail this assertion for real.
      const footerLocator = page.getByTestId('cc-footer-band');
      const footerBoxBeforeScroll = await footerLocator.boundingBox();
      const docScrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      await footerLocator.scrollIntoViewIfNeeded();
      const footerBox = await footerLocator.boundingBox();
      // eslint-disable-next-line no-console
      console.log(
        `FOOTER-BAND-EVIDENCE ${JSON.stringify({
          tier: name,
          footerBoxBeforeScroll,
          docScrollHeight,
          footerBoxAfterScrollIntoView: footerBox,
          viewportHeight: height,
        })}`
      );
      expect(footerBox, 'footer band must have a bounding box').not.toBeNull();
      if (footerBox) {
        expect(
          footerBox.y,
          `footer band top (${footerBox.y}) must be within the ${height}px viewport after scrollIntoViewIfNeeded — a footer that cannot be scrolled into view is genuinely unreachable`
        ).toBeLessThan(height);
        expect(
          footerBox.y + footerBox.height,
          `footer band bottom (${footerBox.y + footerBox.height}) must be greater than 0 after scrollIntoViewIfNeeded — confirms it is not scrolled fully past the viewport in the other direction`
        ).toBeGreaterThan(0);
      }

      // ── Tier-specific layout contract (188.1-UI-SPEC.md Part 3) ───────────────────────────
      if (name === 'lg') {
        const leftRailBox = await page.getByTestId('cc-left-rail').boundingBox();
        const chatBox = await page.getByTestId('cc-chat-column').boundingBox();
        const rightRailBox = await page.getByTestId('cc-right-rail').boundingBox();
        expect(leftRailBox).not.toBeNull();
        expect(chatBox).not.toBeNull();
        expect(rightRailBox).not.toBeNull();
        if (leftRailBox && chatBox && rightRailBox) {
          console.log(
            `LG-RAIL-EVIDENCE ${JSON.stringify({ leftRailBox, chatBox, rightRailBox })}`
          );
          expect(
            leftRailBox.y,
            'LEFT RAIL must render as a strip ABOVE the 3-column row at lg'
          ).toBeLessThan(chatBox.y);
          expect(
            rightRailBox.y,
            'RIGHT RAIL must render as a strip BELOW the 3-column row at lg'
          ).toBeGreaterThan(chatBox.y);
        }
      }

      if (name === 'below-lg') {
        const testids = [
          'cc-left-rail',
          'cc-chat-column',
          'cc-center-column',
          'cc-right-rail',
          'cc-vitals',
          'cc-footer-band',
        ];
        const boxes: Array<{ id: string; x: number; y: number }> = [];
        for (const id of testids) {
          const box = await page.getByTestId(id).boundingBox();
          expect(box, `${id} must have a bounding box at below-lg`).not.toBeNull();
          if (box) boxes.push({ id, x: box.x, y: box.y });
        }
        console.log(`BELOW-LG-STACK-EVIDENCE ${JSON.stringify(boxes)}`);
        const firstX = boxes[0].x;
        for (const box of boxes) {
          expect(
            Math.abs(box.x - firstX),
            `${box.id}'s left edge (${box.x}) must match the single-column left edge (${firstX})`
          ).toBeLessThan(2);
        }
        for (let i = 1; i < boxes.length; i++) {
          expect(
            boxes[i].y,
            `${boxes[i].id}'s top (${boxes[i].y}) must be strictly below ${boxes[i - 1].id}'s top (${boxes[i - 1].y}) — reading order`
          ).toBeGreaterThan(boxes[i - 1].y);
        }
      }

      // ── Rendered artifact for the panel-by-panel walk (Task 2) ────────────────────────────
      await page.screenshot({
        path: `test-results/command-center-${name}.png`,
        fullPage: true,
      });
    });
  }
});
