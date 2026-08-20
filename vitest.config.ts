import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Do NOT inherit a real Clerk key from .env.local into the test runtime.
    // When the key is set, Clerk-gated code paths (e.g. ForgePage's ClerkAuthProbe)
    // mount and call useUser()/useAuth(), which throw outside a <ClerkProvider/>.
    // Tests are written for the unconfigured "dev mode" path; force it here.
    //
    // VITE_ASTRIDR_API_KEY: set a sentinel value so authHeaders() includes the
    // Authorization: Bearer header in tests (required by T-90-AUTH assertions in
    // useWarRoomVoice.test.ts). The value is not a real credential.
    env: {
      VITE_CLERK_PUBLISHABLE_KEY: '',
      VITE_ASTRIDR_API_KEY: 'test-api-key',
    },
    // Vitest 4 treats `projects` as AUTHORITATIVE once it is non-empty: the
    // root `test` block above stops selecting tests on its own, and only the
    // projects listed here run. The `unit` entry below therefore is not
    // redundant — without it the entire existing jsdom suite silently stops
    // running while `vitest run` still exits 0.
    //
    // THE ROOT `test` BLOCK MUST NOT DECLARE `include`. That is not tidiness,
    // it is load-bearing: with inheritance on, a root-level `include` does not
    // merge with a project's own — it OVERRIDES it. Measured 2026-08-20 with a
    // throwaway third project whose glob matched nothing: it still collected
    // all 364 files, and the `browser` project below ran the entire jsdom
    // suite in Chromium. It also makes a zero-match project impossible, which
    // silently removes the run's only protection against a browser spec that
    // has quietly stopped being collected. The globs live on the projects
    // instead, where they are honoured (same probe, root `include` removed:
    // 0 files, with the `unit` project still collecting 363 as the control).
    //
    // The inheritance flag set on each entry below is what makes the projects
    // pick up the plugins, the '@' alias, setupFiles and the Clerk-key
    // sentinel env. Vitest 4 does NOT inherit any of those by default;
    // dropping the flag breaks '@/assets/avatar/...' resolution and
    // reintroduces the Clerk-gate mounting failure the comment above exists to
    // prevent. (Deliberately not spelled out verbatim here: 192-02's own
    // acceptance greps count occurrences of that flag and a prose mention
    // would be indistinguishable from a third project entry.)
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}', 'convex/**/*.test.ts', 'hooks/**/*.test.mjs'],
          // '*.browser.test.tsx' also matches '*.test.tsx' — the leading '*'
          // happily eats '.browser'. Verified with `vitest list --project
          // unit`, which collected both browser specs into this jsdom project
          // before this exclude existed. Without it the cadence guard runs in
          // jsdom, which is the exact environment it was written because
          // jsdom cannot see. Spread the defaults rather than replacing them:
          // setting `exclude` overrides node_modules/.git wholesale.
          exclude: [...configDefaults.exclude, 'src/**/*.browser.test.tsx'],
        },
      },
      // Real headless Chromium. This project exists because jsdom cannot see
      // rAF CADENCE: AvatarAura.test.tsx hand-drives the rAF callback, so it
      // passes identically at 1 draw or 200. See AvatarAura.browser.test.tsx.
      //
      // Version lockstep: @vitest/browser-playwright's own peer dependency on
      // `vitest` is an EXACT string with no caret ('4.1.11' for the version
      // installed here), so a future `vitest` bump must move this package in
      // the same commit or npm will refuse the tree / silently resolve a
      // mismatched provider.
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.tsx'],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium', headless: true }],
          },
        },
      },
    ],
  },
});
