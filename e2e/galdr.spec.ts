/**
 * Galdr end-to-end — the resolve-before-navigate contract (Phase 116, plan 116-08).
 *
 * THIS SPEC WRITES TO THE LIVE SELF-HOSTED CONVEX INSTANCE. The repo has no
 * separate test database. That is why two things here are mandatory rather than
 * tidy: the run-unique title suffix (a slug collision is a CORRECT D-06 refusal
 * and would read as a test failure on the second run), and the archive cleanup —
 * which lives in `afterEach`, NOT at the end of the test body, so that it also
 * runs when the body fails (see the `createdTitle` note below; a body-tail
 * cleanup leaked 18 rows before 2026-08-11). Never reach for a bulk delete or
 * `convex import` to clean up —
 * mass mutation on this instance is what took the dashboard down for days on
 * 2026-07-21/22 (repo CLAUDE.md, Self-Hosted Convex Operational Rules).
 *
 * The load-bearing assertion is step 2's NEGATIVE CONTROL: after picking Send to
 * Chat with an unfilled variable, the URL must still be /galdr. Without it,
 * "the fill-in dialog appeared" is consistent with a component that opens the
 * dialog AND navigates anyway.
 */
import { test, expect } from '@playwright/test';

/** See bifrost.spec.ts — load bound, not correctness bound, under full-suite load. */
const LIVE_DATA_TIMEOUT = 20_000;

test.describe('Galdr send-to-chat', () => {
  // Playwright's 30s per-test default is far too tight for this one. A single
  // pass creates a prompt, waits for a REAL Astridr model turn to render, then
  // navigates twice more and archives — the model round trip alone is allowed
  // 30s. Under full-suite parallel load the total legitimately exceeds the
  // default, which surfaced as an intermittent failure rather than a real one.
  test.setTimeout(150_000);

  // Same onboarding-skip as e2e/navigation.spec.ts. The OnboardingGuide overlay
  // is `fixed inset-0 z-50` and intercepts every pointer event, so without this
  // every click times out for a reason unrelated to Galdr.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('codepulse_onboarding_complete', 'true');
    });
  });

  /**
   * The title this run created, or null if it never got that far.
   *
   * 2026-08-11 (v14.0 audit INT-04): cleanup used to be step 5 of the test BODY.
   * Any failure at steps 2-4 therefore skipped it and leaked the prompt
   * permanently — `prompts` is deliberately retention-exempt (convex/retention.ts
   * D-13), so nothing ever reaps a leaked row. That is not hypothetical: this
   * spec is intermittently flaky under full-suite parallel load (see the timeout
   * note above), and the live library was found holding 18 leaked
   * `E2E send probe *` rows against 1 real prompt — 95% of what /galdr rendered.
   * Those were archived individually on 2026-08-11.
   *
   * Cleanup now lives in afterEach so it runs on the failure path too. It is
   * still the per-row archive path — never a bulk delete or `convex import`,
   * per the repo's Self-Hosted Convex Operational Rules.
   */
  let createdTitle: string | null = null;

  test.afterEach(async ({ page }) => {
    if (!createdTitle) return; // nothing was created — nothing to clean up
    const title = createdTitle;
    createdTitle = null;

    await page.goto('/galdr');
    await page.getByText(title).first().click();
    // Drawer footer Archive, then the AlertDialog's own Archive. Scoped by role
    // so the two same-named buttons cannot be confused for one another.
    await page.getByRole('button', { name: 'Archive' }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Archive' })
      .click();
    // Assert on the send-target chevron, which only a CARD has. A bare
    // getByText(title) also matches the drawer and the AlertDialog heading
    // (`Archive "{title}"?`), so it counts 2 while the dialog is up and never
    // reaches 0. The longer timeout covers the Convex subscription round trip,
    // which is measurably slower when the full suite runs 16 workers wide.
    // This stays a real assertion: if cleanup silently no-ops, the run must fail
    // rather than quietly leak, which is exactly how the 18 rows accumulated.
    await expect(
      page.getByRole('button', { name: `Choose send target for ${title}` })
    ).toHaveCount(0, { timeout: 20_000 });
  });

  test('resolves variables before navigating to chat', async ({ page }) => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const title = `E2E send probe ${suffix}`;
    // Registered BEFORE the create click, not after it succeeds: a create that
    // half-lands (row written, assertion times out) must still be cleaned up.
    createdTitle = title;

    // 1. Create a prompt with one variable through the drawer.
    await page.goto('/galdr');
    await page.getByRole('button', { name: 'New Prompt' }).click();

    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Category').fill('e2e');
    await page.getByLabel('Body').fill('Ship the {{thing}} today.');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText(title).first()).toBeVisible({ timeout: LIVE_DATA_TIMEOUT });

    // 2. Pick Send to Chat. The dialog must open AND the URL must not move.
    // Located by the chevron's aria-label rather than by walking up to a card
    // wrapper: the label already carries the title, so it is unique, and a
    // `div` filtered by text resolves to the innermost matching node, which
    // does not contain the footer controls.
    await page
      .getByRole('button', { name: `Choose send target for ${title}` })
      .click();
    await page.getByRole('menuitem', { name: 'Send to Chat' }).click();

    await expect(page.getByLabel('thing')).toBeVisible();
    // NEGATIVE CONTROL — resolution blocks navigation rather than following it.
    await expect(page).toHaveURL(/\/galdr$/);

    // 3. Fill the variable and submit.
    await page.getByLabel('thing').fill('release notes');
    await page.getByRole('button', { name: 'Send to Chat' }).click();

    // 4. Now the navigation happens, carrying a fully resolved body.
    await expect(page).toHaveURL(/\/chat$/);

    // Poll rather than snapshot. Chat.tsx's autoSend effect only fires once the
    // socket reports `connected`, so reading innerText the instant the URL
    // changes races the connect-then-send round trip and reads an empty
    // transcript. The generous timeout covers the socket handshake, not a slow
    // assertion.
    await expect(page.getByText('Ship the release notes today.').first()).toBeVisible({
      timeout: 30_000,
    });

    const chatText = await page.locator('body').innerText();
    expect(chatText).toContain('release notes');
    expect(chatText).not.toContain('{{');

    // Cleanup is NOT here — see the afterEach teardown below.
  });
});
