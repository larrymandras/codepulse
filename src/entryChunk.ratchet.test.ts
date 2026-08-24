/**
 * entryChunk.ratchet.test.ts — D-10/D-18 (Phase 125, plan 01) entry-chunk
 * byte-budget ratchet.
 *
 * Turns success criterion 2's prose clause ("the entry-chunk budget holds")
 * into an executable ceiling. F-3 (125-CONTEXT.md) measured that no byte
 * budget existed anywhere in this repo before this file. Same shape as
 * `src/tokenSweep.ratchet.test.ts`'s own `existsSync` -> `null` sentinel ->
 * `it.skipIf(...)` -> `console.warn(...)` discipline (:305-341,:390-401) --
 * a missing build must show up as SKIPPED-with-reason, never as a pass.
 *
 * The entry file is resolved by READING `dist/index.html`'s
 * `<script type="module">` src and `<link rel="stylesheet">` href -- never
 * by globbing the hashed entry filename convention (e.g. `index-<hash>.js`),
 * which is a Vite build-hash default, not a contract (125-RESEARCH.md R-3).
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const DIST_INDEX_HTML = join(REPO_ROOT, "dist", "index.html");

// D-18: measured twice, deterministic, at repo HEAD on 2026-08-21 BEFORE any
// Phase 125 code landed (125-RESEARCH.md R-3, 125-CONTEXT.md D-18). A
// percentage allowance, not a fixed-byte figure, so ordinary dependency
// drift does not fail this ratchet for reasons unrelated to this phase.
const BASELINE_JS_BYTES = 583049;
const BASELINE_CSS_BYTES = 237359;
// D-18's own stated honesty: 2% (~11.7 KB on JS) was chosen as drift-tolerant
// against ordinary dependency bumps, NOT fitted to a known component size --
// the Signal Horizon did not exist when this number was picked, so this is a
// budget, not a prediction.
const ALLOWANCE = 1.02;

interface EntryAssets {
  jsPath: string;
  cssPath: string;
  jsBytes: number;
  cssBytes: number;
}

/** Extracts the entry `<script type="module" src="...">` and
 *  `<link rel="stylesheet" ... href="...">` from `dist/index.html`'s raw
 *  source text, maps each `/assets/...` URL to a path under `dist/`, and
 *  `statSync`s it. Returns `null` -- the discipline this file's whole
 *  design exists to prove -- when `dist/index.html` is absent, either tag
 *  is absent, or either resolved file is missing on disk. Never throws. */
function resolveEntryAssets(): EntryAssets | null {
  if (!existsSync(DIST_INDEX_HTML)) return null;
  const html = readFileSync(DIST_INDEX_HTML, "utf8");

  const scriptMatch = html.match(/<script[^>]*type="module"[^>]*\ssrc="([^"]+)"/);
  const linkMatch = html.match(/<link[^>]*rel="stylesheet"[^>]*\shref="([^"]+)"/);
  if (!scriptMatch || !linkMatch) return null;

  const jsUrl = scriptMatch[1];
  const cssUrl = linkMatch[1];
  // /assets/index-XXXX.js -> dist/assets/index-XXXX.js
  const jsPath = join(REPO_ROOT, "dist", jsUrl.replace(/^\//, ""));
  const cssPath = join(REPO_ROOT, "dist", cssUrl.replace(/^\//, ""));
  if (!existsSync(jsPath) || !existsSync(cssPath)) return null;

  return {
    jsPath,
    cssPath,
    jsBytes: statSync(jsPath).size,
    cssBytes: statSync(cssPath).size,
  };
}

const ENTRY = resolveEntryAssets();
const ENTRY_SKIP_REASON =
  "no dist/index.html (or its module-script/stylesheet tags, or the files they point at) was found " +
  "-- run `npm run build` to produce one before trusting this ratchet's positive half. A skip that " +
  "says why beats a pass that measured nothing.";

describe("entry-chunk byte-budget ratchet (D-10/D-18)", () => {
  // Always runs, even when ENTRY is null -- a resolver that silently
  // returned 0 must not be able to pass as "under budget".
  it("self-check: resolveEntryAssets() either returns null or a positive integer byte count", () => {
    expect(ENTRY === null || (Number.isInteger(ENTRY.jsBytes) && ENTRY.jsBytes > 0)).toBe(true);
  });

  it.skipIf(ENTRY === null)("entry JS stays within the D-18 baseline + 2% allowance", () => {
    if (ENTRY === null) return; // narrowing for TS; skipIf already prevents this branch
    const ceiling = Math.floor(BASELINE_JS_BYTES * ALLOWANCE);
    const delta = ENTRY.jsBytes - ceiling;
    expect(
      ENTRY.jsBytes,
      `entry JS is ${ENTRY.jsBytes} bytes, ceiling is ${ceiling} bytes (baseline ${BASELINE_JS_BYTES} * ${ALLOWANCE}), delta ${delta} bytes`,
    ).toBeLessThanOrEqual(ceiling);
  });

  it.skipIf(ENTRY === null)("entry CSS stays within the D-18 baseline + 2% allowance", () => {
    if (ENTRY === null) return;
    const ceiling = Math.floor(BASELINE_CSS_BYTES * ALLOWANCE);
    const delta = ENTRY.cssBytes - ceiling;
    expect(
      ENTRY.cssBytes,
      `entry CSS is ${ENTRY.cssBytes} bytes, ceiling is ${ceiling} bytes (baseline ${BASELINE_CSS_BYTES} * ${ALLOWANCE}), delta ${delta} bytes`,
    ).toBeLessThanOrEqual(ceiling);
  });

  if (ENTRY === null) {
    // eslint-disable-next-line no-console
    console.warn(`[entry-chunk ratchet] SKIPPED: ${ENTRY_SKIP_REASON}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(
      `[entry-chunk ratchet] measured entry JS=${ENTRY.jsBytes} bytes (ceiling ${Math.floor(BASELINE_JS_BYTES * ALLOWANCE)}), ` +
        `entry CSS=${ENTRY.cssBytes} bytes (ceiling ${Math.floor(BASELINE_CSS_BYTES * ALLOWANCE)})`,
    );
  }
});
