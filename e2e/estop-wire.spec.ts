import { test, expect } from '@playwright/test';

/**
 * D-20 replacement control for 125-12 (2026-08-24 -- see 125-CONTEXT.md's
 * D-20 for the full reasoning). 125-12's must_have originally specified a
 * BEFORE/AFTER control on `data-horizon-state`: the horizon stays `unknown`
 * while no `estop_state` emitter is deployed, and leaves `unknown` only
 * after the astridr-repo rebuild that ships one. That "before" state is no
 * longer observable -- a concurrent session's Phase 195 rebuild shipped the
 * emitter into the running container incidentally, before this plan ran.
 * Rebuilding backwards to recreate the "before" state was considered and
 * rejected as disproportionate and risky (D-20).
 *
 * This spec proves the SAME property the original control targeted -- that
 * only a valid `estop_state` snapshot can clear the horizon's fail-closed
 * state -- via a different, still-falsifying pair: the horizon ENTERS
 * `unknown` on a MALFORMED snapshot and LEAVES `unknown` only on a
 * WELL-FORMED one. A component that ignored payload validity would pass the
 * well-formed case and fail the malformed one, so this remains a real test
 * of the validation gate, not a tautology.
 *
 * Mechanism: `window.__signalHorizonStub` (SignalHorizon.tsx, DEV-only,
 * gated on `import.meta.env.DEV`) routes through the exact same
 * `handleFrame` -> `parseEstopPayload` path the real WS `estop_state`
 * subscription drives (T-125-04-05: "the stub must not be able to bypass
 * validation"). This is used instead of a real socket delivery because no
 * genuine `estop_state` frame can be produced from this spec without
 * astridr-repo's live emitter and a real E-Stop arm/disarm.
 *
 * WHAT THIS DOES NOT PROVE: end-to-end delivery from Ástríðr's emitter,
 * through the socket, to the DOM. That burden is carried by 125-13, which
 * arms the real E-Stop and watches the real horizon over a real connection.
 * A green run here is evidence about the CLIENT's handling of snapshot
 * validity ONLY -- it is not evidence that Ástríðr's emitter reaches the
 * browser.
 *
 * Runs only against the keyless dev:noauth server (same convention as
 * e2e/serif-trial.spec.ts / e2e/navigation.spec.ts). See
 * `npm run test:e2e:noauth:help` for the exact invocation.
 */

declare global {
  interface Window {
    __signalHorizonStub?: (payload: Record<string, unknown>) => void;
  }
}

async function pushFrame(page: import('@playwright/test').Page, payload: Record<string, unknown>) {
  await page.evaluate((p) => {
    if (typeof window.__signalHorizonStub !== 'function') {
      throw new Error('__signalHorizonStub is not a function on window');
    }
    window.__signalHorizonStub(p);
  }, payload);
}

test.describe('D-20: Signal Horizon fail-closed on malformed estop_state snapshots', () => {
  test.beforeEach(async ({ page }) => {
    // Same onboarding-modal suppression as e2e/serif-trial.spec.ts and
    // e2e/navigation.spec.ts -- OnboardingGuide is a full-screen overlay
    // gated purely on localStorage, unrelated to Clerk, and intercepts
    // every pointer event if left up. Theme pinned explicitly so this spec
    // is never coupled to whatever theme a prior manual session left.
    await page.addInitScript(() => {
      window.localStorage.setItem('codepulse_onboarding_complete', 'true');
      window.localStorage.setItem('codepulse-theme', 'cyan');
    });
  });

  test('malformed snapshots enter unknown; only a well-formed snapshot leaves it', async ({ page }) => {
    await page.goto('/');

    // T-125-04/serif-trial idiom: fail loudly, not silently, if this run
    // landed on the Clerk-gated server by mistake.
    const signInText = page.getByText('Sign in to access the telemetry dashboard');
    const horizon = page.locator('.signal-horizon');
    await expect(signInText.or(horizon.first()).first()).toBeVisible({ timeout: 15000 });
    if (await signInText.count()) {
      throw new Error(
        'Clerk auth gate present -- run against dev:noauth, not the default gated server. ' +
          'From Git Bash: VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth, then ' +
          'PW_BASE_URL=http://localhost:5181 npx playwright test e2e/estop-wire.spec.ts --project=chromium ' +
          '(see npm run test:e2e:noauth:help).',
      );
    }

    // Confirm the DEV-only stub actually exists before relying on it --
    // its absence would mean this is not a DEV build, or the hook was
    // removed, and every assertion below would be meaningless.
    const stubExists = await page.evaluate(() => typeof window.__signalHorizonStub === 'function');
    expect(stubExists, '__signalHorizonStub missing -- not a DEV build, or the hook was removed from SignalHorizon.tsx').toBe(
      true,
    );

    // NOTE (measured live, 2026-08-24): dev:noauth's WS context connects to
    // the SAME real Ástríðr backend as production -- it is not a stub
    // backend, only Clerk is disabled. Because the real `estop_state`
    // emitter is now live (D-01/D-02, shipped incidentally by the
    // concurrent astridr-repo rebuild D-20 describes), the REAL wire
    // delivers a genuine well-formed disarmed snapshot on connect almost
    // immediately, so `data-horizon-state` is already `resting` by the
    // time this spec's first locator resolves -- `unknown` is not
    // observable here for more than a few hundred ms. This is itself
    // corroborating evidence for D-20's finding that the "no emitter
    // deployed" before-state cannot be recreated. This spec therefore does
    // NOT assert a `mount is unknown` step (it would be flaky-to-false
    // against a live backend) and instead drives every transition
    // explicitly through the stub from a known, freshly-established
    // baseline, so genuine real-wire frames (which currently only carry
    // `armed:false` in production, same as the disarmed baseline below)
    // cannot make an assertion pass for the wrong reason.
    await expect(horizon, 'horizon element mounted').toBeVisible({ timeout: 15000 });

    // ─── Step 0: ENTER unknown from a non-unknown state via a malformed
    // frame -- establishes a genuine transition INTO unknown (not merely
    // an absence-of-resting reading at mount, which the note above
    // explains is unobservable against this live backend).
    await pushFrame(page, { data: { armed: false } });
    await expect(horizon, 'baseline before the entry probe').toHaveAttribute('data-horizon-state', 'resting', {
      timeout: 5000,
    });
    await pushFrame(page, {});
    await expect(horizon, 'ENTERS unknown on a malformed push (missing data field)').toHaveAttribute(
      'data-horizon-state',
      'unknown',
      { timeout: 5000 },
    );

    // ─── Direction 1: a well-formed disarmed snapshot LEAVES `unknown`
    // (continuing directly from the unknown state Step 0 just entered).
    await pushFrame(page, { data: { armed: false } });
    await expect(horizon, 'well-formed disarmed snapshot leaves unknown').toHaveAttribute(
      'data-horizon-state',
      'resting',
      { timeout: 5000 },
    );

    // ─── Direction 2: a well-formed armed snapshot LEAVES `unknown` too,
    // reaching `critical` (rule 3 outranks the alert overlay entirely) --
    // proves the machine reads the payload's actual content on the way out
    // of unknown, not just its shape.
    await pushFrame(page, {});
    await expect(horizon, 're-enter unknown before the armed probe').toHaveAttribute('data-horizon-state', 'unknown', {
      timeout: 5000,
    });
    await pushFrame(page, { data: { armed: true } });
    await expect(horizon, 'well-formed armed snapshot leaves unknown, into critical').toHaveAttribute(
      'data-horizon-state',
      'critical',
      { timeout: 5000 },
    );

    // ─── Direction 3: malformed shapes. Each is preceded by a fresh
    // well-formed disarmed frame establishing a KNOWN `resting` baseline,
    // so each malformed push is proven to CHANGE the state (resting ->
    // unknown), not merely found already-unknown from a prior push --
    // the same "must actually flip" discipline SignalHorizon.test.tsx's
    // case (d) uses.
    const malformedShapes: Array<{ label: string; payload: Record<string, unknown> }> = [
      { label: 'missing data field entirely', payload: {} },
      { label: 'data: null', payload: { data: null } },
      { label: 'armed as the string "true", not boolean', payload: { data: { armed: 'true' } } },
      { label: 'data: {} (armed absent)', payload: { data: {} } },
    ];

    for (const { label, payload } of malformedShapes) {
      await pushFrame(page, { data: { armed: false } });
      await expect(horizon, `baseline (resting) before malformed push: ${label}`).toHaveAttribute(
        'data-horizon-state',
        'resting',
        { timeout: 5000 },
      );

      await pushFrame(page, payload);
      await expect(horizon, `after malformed push: ${label}`).toHaveAttribute('data-horizon-state', 'unknown', {
        timeout: 5000,
      });

      // eslint-disable-next-line no-console
      console.log(`[estop-wire] malformed shape "${label}" (${JSON.stringify(payload)}) -> data-horizon-state=unknown`);
    }

    // ─── Recovery check: a well-formed frame can still leave `unknown`
    // after a run of malformed pushes -- proves the malformed cases did
    // not latch the machine somewhere it cannot recover from.
    await pushFrame(page, { data: { armed: false } });
    await expect(horizon, 'recovery to resting after the malformed run').toHaveAttribute(
      'data-horizon-state',
      'resting',
      { timeout: 5000 },
    );
  });
});
