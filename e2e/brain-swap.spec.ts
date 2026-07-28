import { test, expect } from '@playwright/test';

/**
 * Brain-swap picker — stub round trip (103-08-T1).
 *
 * ⚠ HONESTY NOTE (read before trusting a green run here): a passing run of this spec proves the
 * picker-open → swap → PENDING round trip against the D-16 STUB adapter (`VITE_BRAINS_STUB=true`,
 * `src/lib/brainsFixtures.ts`). It proves the per-profile UI is internally consistent and honest
 * about its own stub-ness (STUB banner/chip render correctly, the picker never pretends stub data
 * is live, and D-15's never-optimistic pending suffix holds). It does NOT prove live per-profile
 * integration — no real Ástríðr `gateway.model.set` backend exists yet (deferred to astridr Phase
 * 184.1, see `103-CONTRACT.md`). The GLOBAL axis (`swap.set`/`swap.catalogue`/`swap.state`) is
 * separately and genuinely verified live against the running stack in 103-08-T2 (a human
 * checkpoint, not this file) — see `103-VALIDATION.md`.
 *
 * ⚠ D-14 FINDING (discovered while writing this spec, see 103-08-SUMMARY.md Deviations for the
 * full incident): the picker's per-profile SUCCESS toast only fires once `useActiveEngine()`'s
 * Convex-reactive `activeEngineSnapshots` query reports the swap has genuinely landed
 * (`BrainPicker.tsx`'s own effect gates on `activeEngine?.model === pendingTarget.id`). The
 * per-profile stub adapter's `dispatchSwap` intentionally does NOT write to that table — by
 * design, D-14 forbids the UI (real or stub) from ever asserting its own success from a client
 * action or an ack payload alone. That means an honest stub round trip can prove the ACCEPT (ack)
 * and the never-optimistic PENDING state (asserted below), but cannot itself manufacture the
 * CONFIRMED success toast without writing directly to the shared, production
 * `activeEngineSnapshots` Convex table from this test — which this spec deliberately does not do
 * (that table has no delete path in the shipped API, and a stray write was found to leak into the
 * live-stack header badge site-wide during this plan's execution). This spec therefore asserts the
 * dispatch-accepted pending state rather than a stub-manufactured success toast.
 *
 * This spec requires the served build to run with `VITE_BRAINS_STUB=true` (set on the Playwright
 * webServer's `env`, see `playwright.config.ts`, rather than relying on the developer's shell). If
 * an already-running dev server is reused (`reuseExistingServer`) without that flag — e.g. the
 * live-stack dev server used for 103-08-T2's global-axis verification — the STUB banner will be
 * absent and this spec skips honestly instead of asserting against whatever live data happens to
 * be present.
 */
test.describe('Brain-swap picker — stub round trip', () => {
  test('picker-open to swap to toast round trip against the stub adapter', async ({ page }) => {
    // Suppress the first-visit OnboardingGuide modal (unrelated to this spec — it would otherwise
    // cover the page with a bg-black/60 backdrop that intercepts every click below).
    await page.addInitScript(() => {
      window.localStorage.setItem('codepulse_onboarding_complete', 'true');
    });

    await page.goto('/');

    // Race-safe Clerk-gate check: wait for either the sign-in gate OR the badge to actually
    // render (a bare `.count()` immediately after `goto` can read 0 before the app hydrates and
    // the gate paints, silently skipping the guard instead of honestly detecting it).
    const signInText = page.getByText('Sign in to access the telemetry dashboard');
    const badgeButton = page.getByRole('button', { name: /^Active brain:/ });
    await expect(signInText.or(badgeButton).first()).toBeVisible({ timeout: 15000 });

    if (await signInText.count()) {
      test.skip(true, 'Clerk auth gate present — run e2e without VITE_CLERK_PUBLISHABLE_KEY');
    }

    // 1. Active-brain badge present in the header status cluster.
    await expect(badgeButton).toBeVisible();

    // 2. Click the badge, assert the picker opens.
    await badgeButton.click();
    const popover = page.locator('[data-slot="popover-content"]');
    await expect(popover).toBeVisible();

    // Honest stub-absent guard: only proceed if the stub adapter is genuinely active on this
    // served build. Never assert against whatever live data happens to be present instead.
    const stubBannerCount = await popover
      .getByText('Running on stub brain data', { exact: false })
      .count();
    if (stubBannerCount === 0) {
      test.skip(
        true,
        'VITE_BRAINS_STUB is not active on the served build (STUB banner absent) — the stub round trip cannot be honestly exercised against whatever live data is present. Start the dev server with VITE_BRAINS_STUB=true to run this spec.'
      );
    }
    await expect(popover.getByText('Running on stub brain data', { exact: false })).toBeVisible();

    // 3. Group headings render in fixed order: Subscription, API, Local (D-07).
    const headings = await popover.locator('[cmdk-group-heading]').allTextContents();
    expect(headings).toEqual(['Subscription', 'API', 'Local']);

    // 4. Scope selector reads "This profile" on open (D-08). Radix's ToggleGroup type="single"
    // renders each item with role="radio" (roving within an implicit radiogroup) — not "button".
    const profileScopeBtn = popover.getByRole('radio', { name: 'This profile' });
    const globalScopeBtn = popover.getByRole('radio', { name: 'All profiles' });
    await expect(profileScopeBtn).toBeChecked();
    await expect(globalScopeBtn).not.toBeChecked();

    // D-08 reset-on-open, genuinely exercised: deliberately move scope to "All profiles", close
    // the picker WITHOUT dispatching, reopen, and confirm it reset to "This profile" rather than
    // remembering the last-selected scope. A trivial "never touched, still default" open would
    // prove nothing about the reset rule itself.
    await globalScopeBtn.click();
    await expect(globalScopeBtn).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();

    await badgeButton.click();
    const reopenedPopover = page.locator('[data-slot="popover-content"]');
    await expect(reopenedPopover).toBeVisible();
    await expect(reopenedPopover.getByRole('radio', { name: 'This profile' })).toBeChecked();

    // 5. Search narrows the visible row set.
    const searchInput = reopenedPopover.getByPlaceholder('Search brains…');
    await searchInput.fill('Codex');
    await expect(reopenedPopover.getByText('Codex CLI')).toBeVisible();
    await expect(reopenedPopover.getByText('Antigravity CLI')).toBeHidden();

    // 6. Select a normal-tier fixture row — dispatches immediately (no expensive/unknown-tier
    // inline confirm). Per D-15, the header badge's own pending suffix renders as a purely
    // additive "· switching to Codex CLI…" over the still-truthful base label — the base label
    // itself never flips optimistically. (See the file-header D-14 FINDING above for why this
    // spec asserts the accepted-and-pending state rather than the Convex-confirmed success toast.)
    await reopenedPopover.locator('button', { hasText: 'Codex CLI' }).click();
    await expect(page.getByTestId('brain-header-badge-pending')).toContainText(
      'switching to Codex CLI'
    );
    await expect(page.getByTestId('brain-header-badge-label')).toHaveText('No brain reported');

    // 7. Reopen the picker — scope selector has reset to "This profile" again (the dispatch's own
    // handleOpenChange(false) closed it; this reopen proves the reset rule holds on every open,
    // not just the one exercised above).
    await badgeButton.click();
    const finalPopover = page.locator('[data-slot="popover-content"]');
    await expect(finalPopover).toBeVisible();
    await expect(finalPopover.getByRole('radio', { name: 'This profile' })).toBeChecked();
  });
});
