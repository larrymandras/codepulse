import { test, expect } from '@playwright/test';

/**
 * Serif trial load-proof (Phase 125 plan 10, D-13/D-14/D-15/D-16).
 *
 * This spec does NOT judge whether the serif voice is right for Ástríðr --
 * that is Task 2's blocking human checkpoint. It proves the CONDITIONS
 * under which that judgement will be made are real: a populated
 * `/briefings` page, the actual Instrument Serif ITALIC face loaded (not
 * Georgia's synthetic oblique), and the `readable` theme's override
 * provably flipping the prose back to Geist/upright. A verdict rendered on
 * an empty page or the wrong face would be a verdict about the wrong thing
 * (T-125-10-03, T-125-10-04) -- the same defect class that already produced
 * four false-negative accessibility findings in Phase 123.
 *
 * Runs only against the keyless dev:noauth server. See
 * `npm run test:e2e:noauth:help` for the exact invocation.
 */

test.describe('Serif trial -- load proof', () => {
  test.beforeEach(async ({ page }) => {
    // Same onboarding-modal suppression as e2e/navigation.spec.ts and
    // e2e/theme-contrast.spec.ts -- OnboardingGuide is a full-screen overlay
    // gated purely on localStorage (OnboardingGuide.tsx:39), unrelated to
    // Clerk, and it intercepts every pointer event if left up.
    // Also pin the starting theme explicitly to cyan, rather than relying on
    // the pre-paint script's own fallback, so this spec is never silently
    // coupled to whatever theme a prior manual session left in localStorage.
    await page.addInitScript(() => {
      window.localStorage.setItem('codepulse_onboarding_complete', 'true');
      window.localStorage.setItem('codepulse-theme', 'cyan');
    });
  });

  test('briefings feed is populated, the real italic face is loaded, and the readable override flips it back', async ({
    page,
  }) => {
    await page.goto('/briefings');

    // T-125-10-01: this spec is meant to run only against the keyless
    // dev:noauth server. If the Clerk gate is live (e.g. run by mistake
    // against the default gated :5173 server), fail loudly rather than
    // silently measuring the sign-in screen -- same idiom as
    // e2e/theme-contrast.spec.ts's gate check.
    const signInText = page.getByText('Sign in to access the telemetry dashboard');
    const voiceLocator = page.locator('.briefing-voice');
    await expect(signInText.or(voiceLocator.first()).first()).toBeVisible({ timeout: 15000 });
    if (await signInText.count()) {
      throw new Error(
        'Clerk auth gate present -- run against dev:noauth, not the default gated server. ' +
          'From Git Bash: VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth, then ' +
          'PW_BASE_URL=http://localhost:5181 npx playwright test e2e/serif-trial.spec.ts --project=chromium ' +
          '(see npm run test:e2e:noauth:help).',
      );
    }

    // ─── T-125-10-04 / D-16: the trial cannot be judged on an empty feed ───
    // FAIL, do not skip and do not pass, if no populated .briefing-voice
    // element appears. A capture taken before the query resolves (or
    // against a genuinely empty feed) records a clean page that is not
    // clean -- this repo has already lost four accessibility findings to
    // exactly this defect class (Phase 123).
    try {
      await expect(voiceLocator.first()).toBeVisible({ timeout: 15000 });
    } catch {
      throw new Error(
        'SERIF-TRIAL FAILED: no .briefing-voice element appeared on /briefings within 15s -- ' +
          'the trial cannot be run against an empty feed. This is a failure, not a skip.',
      );
    }
    const firstVoiceText = ((await voiceLocator.first().textContent()) ?? '').trim();
    if (firstVoiceText.length === 0) {
      throw new Error(
        'SERIF-TRIAL FAILED: a .briefing-voice element rendered but with empty text content -- ' +
          'the trial cannot be judged on blank prose.',
      );
    }

    const briefingCount = await voiceLocator.count();
    expect(briefingCount).toBeGreaterThan(0);
    // Printed for the plan report -- the operator-facing checkpoint (Task 2)
    // needs this number as the populated-page proof.
    // eslint-disable-next-line no-console
    console.log(`SERIF-TRIAL briefingCount=${briefingCount}`);

    // ─── Font-loading proof (D-14, T-125-10-03) ─────────────────────────────
    // document.fonts.check on its own proves nothing -- paired with a bogus
    // family that MUST return false, a true for the real family becomes
    // meaningful. MEASURED (not assumed): in this Chromium build,
    // document.fonts.check("italic 17px '<any family>'") returns TRUE
    // unconditionally -- for the real loaded face, for a fully bogus
    // "Definitely Not A Real Family" name, and for real-family/wrong-style
    // and real-family/wrong-weight combinations that were never loaded. This
    // is the plan's own warned-about hazard ("document.fonts.check returning
    // true means nothing on its own") in its most extreme form: the control
    // does not merely weaken the signal, it is identically true for both
    // conditions, so a check()-only assertion would be exactly the "bogus
    // path returned 200 identically" failure this repo's own rules exist to
    // catch. check()'s value is still recorded below for the plan's record,
    // but the PASS/FAIL assertion rests on a control that actually
    // discriminates: iterating the live FontFaceSet (document.fonts) for a
    // FontFace whose family/style/status match. A bogus family has ZERO
    // matching entries in that set (no @font-face rule ever declared it),
    // which is a genuine, verified false -- confirmed empirically against
    // this same page before writing this assertion.
    const fontCheck = await page.evaluate(() => {
      const realFamilyCheck = document.fonts.check("italic 17px 'Instrument Serif'");
      const bogusFamilyCheck = document.fonts.check("italic 17px 'Definitely Not A Real Family'");
      const faces = Array.from(document.fonts);
      const realFamilyLoaded = faces.some(
        (f) => f.family.replace(/^"|"$/g, '') === 'Instrument Serif' && f.style === 'italic' && f.status === 'loaded',
      );
      const bogusFamilyHasAnyEntry = faces.some((f) => f.family.includes('Definitely Not A Real Family'));
      return { realFamilyCheck, bogusFamilyCheck, realFamilyLoaded, bogusFamilyHasAnyEntry };
    });
    // eslint-disable-next-line no-console
    console.log(
      `SERIF-TRIAL fontsCheck realFamilyCheck=${fontCheck.realFamilyCheck} bogusFamilyCheck=${fontCheck.bogusFamilyCheck} ` +
        `(both booleans from document.fonts.check(); MEASURED to be true unconditionally in this Chromium build -- ` +
        `not a working control, see comment above) realFamilyLoaded(FontFaceSet)=${fontCheck.realFamilyLoaded} ` +
        `bogusFamilyHasAnyEntry(FontFaceSet)=${fontCheck.bogusFamilyHasAnyEntry}`,
    );
    expect(
      fontCheck.realFamilyLoaded,
      'a loaded FontFace entry for italic Instrument Serif must exist in document.fonts',
    ).toBe(true);
    expect(
      fontCheck.bogusFamilyHasAnyEntry,
      'the bogus-family control must have zero matching FontFace entries, or the true above is meaningless',
    ).toBe(false);

    // ─── Element-level proof, default (cyan) theme ──────────────────────────
    // A string comparison on a font stack / style keyword, not a colour
    // scrape -- the Tailwind v4 oklch hazard (regex-scraping getComputedStyle
    // for COLOUR, which reads the hue angle as a channel) does not apply
    // here. Do not "fix" this into a canvas rasterisation.
    const cyanStyle = await voiceLocator.first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { fontFamily: cs.fontFamily, fontStyle: cs.fontStyle };
    });
    // eslint-disable-next-line no-console
    console.log(
      `SERIF-TRIAL cyanStyle fontFamily="${cyanStyle.fontFamily}" fontStyle="${cyanStyle.fontStyle}"`,
    );
    // getComputedStyle returns the CSS-serialised stack, so the first family
    // is double-quoted (`"Instrument Serif", Georgia, serif`) -- strip the
    // leading quote before the startsWith check. MEASURED: a naive
    // `.startsWith('Instrument Serif')` against the raw string is false here
    // even when the font is genuinely first in the stack.
    expect(cyanStyle.fontFamily.replace(/^"/, '').startsWith('Instrument Serif')).toBe(true);
    expect(cyanStyle.fontStyle).toBe('italic');

    await page.screenshot({ path: 'test-results/serif-trial-cyan.png', fullPage: true });

    // ─── D-15 scope check: readable flips it back, both directions ─────────
    // Switch the theme attribute directly (no reload needed -- the readable
    // override is a plain CSS-level rule per D-15) and assert BOTH
    // directions: a test that only checks the four serif themes cannot
    // detect an override that never actually applies.
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'readable';
    });
    const readableStyle = await voiceLocator.first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { fontFamily: cs.fontFamily, fontStyle: cs.fontStyle };
    });
    // eslint-disable-next-line no-console
    console.log(
      `SERIF-TRIAL readableStyle fontFamily="${readableStyle.fontFamily}" fontStyle="${readableStyle.fontStyle}"`,
    );
    expect(readableStyle.fontStyle).toBe('normal');
    expect(readableStyle.fontFamily.replace(/^"/, '').startsWith('Instrument Serif')).toBe(false);

    await page.screenshot({ path: 'test-results/serif-trial-readable.png', fullPage: true });

    // Restore the original theme -- leaves no residue for any later use of
    // this page/context.
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'cyan';
    });
  });
});
