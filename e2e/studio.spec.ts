/**
 * Studio end-to-end — the phase's two mandatory browser control pairs, plus
 * nav reachability and the no-original-fetch rule (Phase 118, plan 118-15).
 *
 * D-07's pair, D-08's three states and D-16's reachability were each verified
 * by DIRECT PROBE during execution, which proves they worked once and guards
 * nothing. This spec closes that hole the same way e2e/loom.spec.ts closed
 * Phase 119's.
 *
 * Reads the LIVE self-hosted Convex instance and creates nothing, like
 * e2e/bifrost.spec.ts and e2e/loom.spec.ts. Its fixtures are the real rows
 * plans 118-12 and 118-13 generated, plus the deliberately sidecar-less
 * control file placed alongside them.
 *
 * DELIBERATELY FAILS rather than skips when those rows are missing. A spec
 * that skips itself when its fixture is absent passes vacuously and reports
 * green while proving nothing — the exact defect `fee96b5d` had to fix in
 * theme-contrast.spec.ts. This file contains no skip directive of any form, and
 * an acceptance criterion greps for one. That sentence deliberately does not
 * spell the directive out: the grep is a whole-file match, so writing the
 * literal here — even inside a comment saying there isn't one — would fail the
 * check. If you add the literal to a comment, the grep goes red and the grep is
 * right.
 *
 * ONE DELIBERATE SUBSTITUTION FROM THE PLAN. 118-15-PLAN.md asks Test 2 to
 * assert that the populated and absent recipe fields carry DIFFERENT class
 * strings. Plan 118-11 shipped `data-present="true"|"false"` on every field row
 * precisely so a spec would not have to depend on Tailwind class strings, and
 * said so in its SUMMARY. Asserting on the class string would couple this spec
 * to styling and break on any restyle that preserves the behaviour — so it
 * asserts on `data-present` AND on the rendered text, which is strictly
 * stronger and stable. Recorded here rather than silently swapped.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';

/** The gallery rows come from a Convex subscription, and the full suite runs
 * many workers against one dev server. This is a load bound, not a correctness
 * bound — the failure message still names the missing fixture. */
const FIXTURE_TIMEOUT = 20_000;

const SYNC_CAPTION = 'Auto-syncs every 5 min · run /studio-sync for an instant sync';

/** The onboarding modal renders as a full-screen overlay and intercepts pointer
 * events on first load, so every click below would hit it instead of the grid.
 * Seeded rather than dismissed with Escape: seeding is deterministic, an
 * Escape race is not. */
async function seedOnboarding(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('codepulse_onboarding_complete', 'true');
  });
}

/** All gallery cards currently rendered. */
function cards(page: Page): Locator {
  return page.locator('[data-testid^="studio-media-card-"]');
}

/** Cards carrying the "No provenance recorded" badge — i.e. rows whose sidecar
 * was absent or malformed. The badge testid is only emitted for those rows. */
function badgedCards(page: Page): Locator {
  return page.locator('[data-testid^="studio-media-provenance-badge-"]');
}

/** Waits for the grid to have painted at least one card, failing with a reason
 * rather than timing out anonymously. */
async function waitForGrid(page: Page) {
  await expect(
    cards(page).first(),
    'no media rows on /studio — the vault is empty, or the watcher has not ingested. ' +
      'This spec needs the rows plans 118-12/118-13 generated plus the sidecar-less control file.'
  ).toBeVisible({ timeout: FIXTURE_TIMEOUT });
}

/** Extracts the Convex row id out of a card's testid. */
async function rowIdOf(card: Locator): Promise<string> {
  const testid = await card.getAttribute('data-testid');
  expect(testid, 'card is missing its data-testid').toBeTruthy();
  return testid!.replace('studio-media-card-', '');
}

test.describe('Studio', () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboarding(page);
  });

  /* ────────────────────────────────────────────────────────────────────────
   * D-16 — reachable from the nav a human actually uses
   * ──────────────────────────────────────────────────────────────────────*/

  test('D-16: clicking Studio in the COMMAND nav group reaches /studio and it renders', async ({
    page,
  }) => {
    await page.goto('/');

    // A real click-through, not a route-config assertion. The decision is about
    // REACHABILITY: a route can exist in App.tsx while being unreachable from
    // the sidebar, and that state satisfies a config check perfectly.
    const navLink = page.getByRole('link', { name: 'Studio', exact: true });
    await expect(
      navLink,
      'no "Studio" link in the sidebar — D-16 requires a nav entry in the COMMAND group, ' +
        'registered in src/lib/navRegistry.ts (BOTH iconComponents and the group items array)'
    ).toBeVisible({ timeout: FIXTURE_TIMEOUT });
    await navLink.click();

    await expect(page).toHaveURL(/\/studio$/);
    await expect(page.getByRole('heading', { name: 'Studio' })).toBeVisible();

    // The <=5-minute ingest latency being VISIBLE is part of the page contract:
    // without it a freshly generated asset looks lost rather than pending.
    await expect(page.getByText(SYNC_CAPTION)).toBeVisible();
  });

  /* ────────────────────────────────────────────────────────────────────────
   * D-07 — the control pair, in one grid view and then at field level
   * ──────────────────────────────────────────────────────────────────────*/

  test('D-07: a complete-recipe card and a no-provenance card render in the SAME grid, and their fields discriminate', async ({
    page,
  }) => {
    await page.goto('/studio');
    await waitForGrid(page);

    const total = await cards(page).count();
    const badged = await badgedCards(page).count();

    // BOTH HALVES, ASSERTED TOGETHER. This is the whole point: "the image
    // appeared" is satisfied identically by a sidecar reader that silently
    // returns nothing for every row. Only the RATIO discriminates — a broken
    // reader badges everything, and a reader that infers provenance from the
    // filename badges nothing.
    expect(
      badged,
      'no "No provenance recorded" card in the grid — the sidecar-less control file is missing ' +
        'from media-vault\\gen\\, so D-07\'s pair cannot be proven'
    ).toBeGreaterThan(0);
    expect(
      total - badged,
      'every card carries the no-provenance badge — either no generated asset with a sidecar is ' +
        'present, or the sidecar reader is returning nothing for every row'
    ).toBeGreaterThan(0);

    // Identify one of each, by badge presence rather than by a hardcoded row id.
    const badgedId = (await badgedCards(page).first().getAttribute('data-testid'))!.replace(
      'studio-media-provenance-badge-',
      ''
    );
    const withProvenance = cards(page).filter({
      hasNot: page.locator('[data-testid^="studio-media-provenance-badge-"]'),
    });
    await expect(withProvenance.first()).toBeVisible();

    // --- the populated half ---
    await withProvenance.first().click();
    const sheet = page.getByTestId('studio-detail-sheet');
    await expect(sheet).toBeVisible({ timeout: FIXTURE_TIMEOUT });

    const populatedPrompt = page.getByTestId('studio-detail-field-prompt');
    await expect(populatedPrompt).toHaveAttribute('data-present', 'true');
    await expect(populatedPrompt).not.toContainText('No provenance recorded');
    for (const field of ['model', 'provider']) {
      await expect(page.getByTestId(`studio-detail-field-${field}`)).toHaveAttribute(
        'data-present',
        'true'
      );
    }
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // --- the absent half, same assertion surface ---
    await page.getByTestId(`studio-media-card-${badgedId}`).click();
    await expect(sheet).toBeVisible({ timeout: FIXTURE_TIMEOUT });

    const absentPrompt = page.getByTestId('studio-detail-field-prompt');
    await expect(absentPrompt).toHaveAttribute('data-present', 'false');
    await expect(absentPrompt).toContainText('No provenance recorded');

    // Provenance is NEVER inferred from the filename. The control file's own
    // name contains the words "control" and "no-sidecar"; none of that text may
    // reach a provenance field, because a filename-derived prompt is
    // indistinguishable from a real one at the point someone copies the recipe.
    const filename = await page.getByTestId('studio-detail-filename').innerText();
    const promptText = await absentPrompt.innerText();
    for (const word of filename.replace(/\.[a-z0-9]+$/i, '').split(/[_\-.]+/)) {
      if (word.length < 4) continue;
      expect(
        promptText.toLowerCase(),
        `the prompt field contains "${word}" from the filename — provenance is being inferred`
      ).not.toContain(word.toLowerCase());
    }
  });

  /* ────────────────────────────────────────────────────────────────────────
   * D-08 — soft delete is three states, not two
   * ──────────────────────────────────────────────────────────────────────*/

  test('D-08: trash then restore round-trips through Gallery -> Trash -> Gallery', async ({
    page,
  }) => {
    await page.goto('/studio');
    await waitForGrid(page);

    // Operate on the sidecar-less CONTROL row deliberately: it carries no
    // provenance worth risking if this test dies part-way.
    const badgedFirst = badgedCards(page).first();
    await expect(
      badgedFirst,
      'no no-provenance row to operate on — this test refuses to trash a row carrying real provenance'
    ).toBeVisible({ timeout: FIXTURE_TIMEOUT });
    const rowId = (await badgedFirst.getAttribute('data-testid'))!.replace(
      'studio-media-provenance-badge-',
      ''
    );

    const before = await cards(page).count();
    await expect(page.getByTestId(`studio-media-card-${rowId}`)).toBeVisible();

    // 1. Trash it.
    await page.getByTestId(`studio-media-card-${rowId}`).click();
    await expect(page.getByTestId('studio-detail-sheet')).toBeVisible({ timeout: FIXTURE_TIMEOUT });
    await page.getByTestId('studio-detail-trash').click();

    // 2. NO confirmation dialog. The no-modal behaviour is part of D-08's
    //    contract, not an omission: a 30-day Restore path plus a visible
    //    countdown IS the safety net, and a confirm on top of it trains the
    //    operator to click through dialogs.
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    // 3. Gone from Gallery, and the count moved by exactly one.
    await expect(page.getByTestId(`studio-media-card-${rowId}`)).toHaveCount(0, {
      timeout: FIXTURE_TIMEOUT,
    });
    await expect
      .poll(async () => cards(page).count(), { timeout: FIXTURE_TIMEOUT })
      .toBe(before - 1);

    // 4. Present in Trash, with its countdown.
    await page.getByTestId('studio-tab-trash').click();
    await expect(page.getByTestId(`studio-media-card-${rowId}`)).toBeVisible({
      timeout: FIXTURE_TIMEOUT,
    });
    await expect(page.getByTestId(`studio-media-purge-caption-${rowId}`)).toContainText(
      /Deletes automatically in \d+ days/
    );

    // 5. Restore, and the count returns to where it started. Asserting the
    //    ORIGINAL value, not merely "greater than after", is what catches a
    //    restore that resurrects the wrong row.
    await page.getByTestId(`studio-media-card-${rowId}`).click();
    await expect(page.getByTestId('studio-detail-sheet')).toBeVisible({ timeout: FIXTURE_TIMEOUT });
    await page.getByTestId('studio-detail-restore').click();

    await page.getByTestId('studio-tab-gallery').click();
    await expect(page.getByTestId(`studio-media-card-${rowId}`)).toBeVisible({
      timeout: FIXTURE_TIMEOUT,
    });
    await expect.poll(async () => cards(page).count(), { timeout: FIXTURE_TIMEOUT }).toBe(before);
  });

  // If the test above dies between the trash and the restore, the row stays
  // flagged and the NEXT watcher cycle physically moves the file into trash\
  // within five minutes. That is recoverable but noisy, so this puts it back.
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) return;
    if (!testInfo.title.startsWith('D-08')) return;
    try {
      await page.goto('/studio');
      await page.getByTestId('studio-tab-trash').click();
      const orphan = badgedCards(page).first();
      if ((await orphan.count()) === 0) return;
      const id = (await orphan.getAttribute('data-testid'))!.replace(
        'studio-media-provenance-badge-',
        ''
      );
      await page.getByTestId(`studio-media-card-${id}`).click();
      await page.getByTestId('studio-detail-restore').click();
    } catch {
      // Best-effort only. A cleanup that throws would mask the real failure,
      // and the row is recoverable by hand from the Trash tab either way.
    }
  });

  /* ────────────────────────────────────────────────────────────────────────
   * D-02 — the original bytes never reach the browser
   * ──────────────────────────────────────────────────────────────────────*/

  test('D-02: the page fetches thumbnails and never the original media file', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (r) => requested.push(r.url()));

    await page.goto('/studio');
    await waitForGrid(page);
    await cards(page).first().click();
    await expect(page.getByTestId('studio-detail-sheet')).toBeVisible({ timeout: FIXTURE_TIMEOUT });

    // The absPath is a copy-to-clipboard string in the UI, never an <img src>
    // or an <a href>. A 500 MB video in the vault must cost the browser nothing.
    const absPath = (await page.getByTestId('studio-detail-abspath').innerText()).trim();
    expect(absPath.length, 'the detail sheet rendered no absPath to check against').toBeGreaterThan(
      0
    );
    const vaultFilename = absPath.split(/[\\/]/).pop()!;

    const originalFetches = requested.filter(
      (u) => u.includes(vaultFilename) || /^file:\/\//i.test(u)
    );
    expect(
      originalFetches,
      `the page requested the original media file: ${originalFetches.join(', ')}`
    ).toHaveLength(0);

    // CONTROL, in the same test: at least one thumbnail WAS fetched. Without
    // it, a page that loaded nothing at all — a blank grid, a crashed
    // subscription — passes the assertion above perfectly.
    const thumbFetches = requested.filter((u) => /\/api\/storage\//.test(u));
    expect(
      thumbFetches.length,
      'no thumbnail request was made at all, so the no-original-fetch assertion above proves nothing'
    ).toBeGreaterThan(0);
  });
});
