import { clerkSetup } from "@clerk/testing/playwright";
import dotenv from "dotenv";
import path from "node:path";
import { existsSync, unlinkSync } from "node:fs";

/**
 * Playwright global setup — fetches a Clerk Testing Token once per run.
 *
 * Closes the gap filed at astridr-repo
 * `.planning/todos/pending/2026-08-10-playwright-clerk-auth-fixture.md`: before
 * this, NO spec in the suite exercised authentication at all. 188.4-03 routed
 * the 7 Clerk-gated specs AROUND the gate via a keyless server, which is the
 * right fix for those specs (they test navigation) but left sign-in, sign-out
 * and protected-route redirect completely uncovered.
 *
 * The Testing Token is what makes a scripted sign-in possible: Clerk's bot
 * detection would otherwise challenge it. Hand-rolled cookie replay is NOT an
 * alternative — Clerk session JWTs refresh on a short interval.
 *
 * `clerkSetup` throws if the secret key belongs to a PRODUCTION instance, which
 * is a guard worth keeping rather than working around: these tests create and
 * destroy sessions for a dedicated test user and have no business touching a
 * production Clerk app.
 */

export default async function globalSetup() {
  // D-11: truncate the contrast matrix's skip-log FIRST, before anything that
  // can throw (the CLERK_SECRET_KEY check below) or short-circuit this
  // function. A stale log left over from a previous failing run would
  // otherwise fail the next clean run, and a machine with no .env.local
  // would never reach a truncation placed after the throw below.
  const skipLogPath = "e2e/.a11y-skip-log.txt";
  if (existsSync(skipLogPath)) unlinkSync(skipLogPath);

  // .env.local is gitignored and holds CLERK_SECRET_KEY. Loaded here rather
  // than relying on the ambient shell so `npx playwright test` behaves the same
  // whether it is run from a terminal that happens to have exported it or not.
  //
  // process.cwd(), NOT import.meta.url: Playwright loads this file as CommonJS,
  // where import.meta is a syntax error ("Cannot use 'import.meta' outside a
  // module") — hit and fixed on the first run, not theorized.
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error(
      "CLERK_SECRET_KEY is not set. Add it to codepulse/.env.local (Clerk Dashboard " +
        "> Configure > Instance > API keys > Secret key, the sk_test_ value). " +
        "The authed Playwright project cannot run without it.",
    );
  }

  // The app's own key is VITE_-prefixed for Vite's client bundle, so it is not
  // discoverable under the bare CLERK_PUBLISHABLE_KEY name clerkSetup looks for
  // by default. Passed explicitly rather than duplicating the value under a
  // second name in .env.local — one source of truth for the publishable key.
  await clerkSetup({
    publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
  });
}
