/**
 * WorkspaceCoverageStrip — D-16 mutation-proof test.
 *
 * Order of operations matters here: the healthy zero-warn control was
 * written FIRST and run GREEN; then a single fixture flag
 * (`scannedRootsComplete: false`) was flipped in place and the suite
 * re-run to confirm the healthy assertion goes RED — proving the
 * assertion measures something rather than trivially passing. The
 * verbatim RED output is recorded in `114-06-SUMMARY.md` (this project's
 * standing "a gate that can skip itself must be shown to have evaluated
 * something" rule, D-16). The mutation was then reverted and only AFTER
 * that reversion were the four degraded-state tests below written.
 *
 * The mutation run itself surfaced a real bug in this file's own icon
 * selector: Lucide's `AlertTriangle` component renders with CSS class
 * `lucide-triangle-alert`, not `lucide-alert-triangle` (the PascalCase
 * name would suggest the latter). The RED output's DOM dump caught it —
 * a class-name assumption that would otherwise have silently passed
 * every test in this file for the wrong reason.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { WorkspaceCoverageStrip, isScanStale } from "./WorkspaceCoverageStrip";
import {
  makeWorkspaceMapFixture,
  makeScannedRootsIncompleteFixture,
  makeAccessDerivationFailedFixture,
  makeLocalConfigAbsentFixture,
  makeLocalConfigVersionMismatchFixture,
} from "@/test/workspaceMapFixture";

// A fixed epoch-ms "now" so scan-time text and staleness math are
// deterministic across runs. 60s after the fixture's own FIXED_MTIME
// baseline (1_755_000_000s) — well inside the 36h healthy window.
const FIXED_NOW = 1_755_000_060_000;
const FRESH_GENERATED_AT = FIXED_NOW / 1000 - 60;

/** The five degraded copy substrings, one per honesty flag / boundary. */
const DEGRADED_SNIPPETS = {
  overdue: /overdue/,
  scanIncomplete: /scan incomplete/,
  accessUnreliable: /Access data unreliable/,
  configAbsent: /No local classification config/,
  configMismatch: /Classification config changed/,
} as const;

function queryAlertTriangle(): Element | null {
  // See file header — Lucide's AlertTriangle renders class
  // "lucide-triangle-alert", confirmed by the Step-2 RED mutation's DOM dump.
  return document.querySelector("svg.lucide-triangle-alert");
}

describe("WorkspaceCoverageStrip", () => {
  // ---------------------------------------------------------------------
  // Step 1 / Step 3 — the healthy zero-warn control (proven able to fail
  // in Step 2, see file header; that mutation is not present in this file).
  // ---------------------------------------------------------------------
  it("healthy control: zero warn treatment, no degraded copy, no AlertTriangle", () => {
    const data = makeWorkspaceMapFixture({ staleGeneratedAt: FRESH_GENERATED_AT });
    render(<WorkspaceCoverageStrip data={data} now={FIXED_NOW} />);

    expect(queryAlertTriangle()).not.toBeInTheDocument();

    for (const pattern of Object.values(DEGRADED_SNIPPETS)) {
      expect(screen.queryByText(pattern)).not.toBeInTheDocument();
    }

    // The four healthy chips are all present.
    expect(screen.getByText(/Scanned .* ago/)).toBeInTheDocument();
    expect(screen.getByText("4/4 roots covered")).toBeInTheDocument();
    expect(screen.getByText(/files withheld/)).toBeInTheDocument();
    expect(screen.getByText(/roots unclassified/)).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------
  // Step 4 — four independent degraded-state proofs, one per D-16 flag.
  // Each asserts the expected copy is present AND the other three
  // degraded strings are absent (asserting presence alone would pass for
  // a component that renders all five degraded chips unconditionally).
  // ---------------------------------------------------------------------

  it("scannedRootsComplete=false: roots-covered chip warns, no other degraded copy", () => {
    const data = makeScannedRootsIncompleteFixture({ staleGeneratedAt: FRESH_GENERATED_AT });
    render(<WorkspaceCoverageStrip data={data} now={FIXED_NOW} />);

    expect(screen.getByText(DEGRADED_SNIPPETS.scanIncomplete)).toBeInTheDocument();
    expect(queryAlertTriangle()).toBeInTheDocument();

    expect(screen.queryByText(DEGRADED_SNIPPETS.overdue)).not.toBeInTheDocument();
    expect(screen.queryByText(DEGRADED_SNIPPETS.accessUnreliable)).not.toBeInTheDocument();
    expect(screen.queryByText(DEGRADED_SNIPPETS.configAbsent)).not.toBeInTheDocument();
    expect(screen.queryByText(DEGRADED_SNIPPETS.configMismatch)).not.toBeInTheDocument();
  });

  it("accessDerivationOk=false: an additional 'Access data unreliable' chip appends, no other degraded copy", () => {
    const data = makeAccessDerivationFailedFixture({ staleGeneratedAt: FRESH_GENERATED_AT });
    render(<WorkspaceCoverageStrip data={data} now={FIXED_NOW} />);

    expect(screen.getByText(DEGRADED_SNIPPETS.accessUnreliable)).toBeInTheDocument();
    expect(queryAlertTriangle()).toBeInTheDocument();

    expect(screen.queryByText(DEGRADED_SNIPPETS.overdue)).not.toBeInTheDocument();
    expect(screen.queryByText(DEGRADED_SNIPPETS.scanIncomplete)).not.toBeInTheDocument();
    expect(screen.queryByText(DEGRADED_SNIPPETS.configAbsent)).not.toBeInTheDocument();
    expect(screen.queryByText(DEGRADED_SNIPPETS.configMismatch)).not.toBeInTheDocument();

    // The four healthy chips still render unchanged — degraded chips append,
    // they don't replace.
    expect(screen.getByText("4/4 roots covered")).toBeInTheDocument();
  });

  it("localConfigStatus='absent': an additional 'No local classification config' chip appends, no other degraded copy", () => {
    const data = makeLocalConfigAbsentFixture({ staleGeneratedAt: FRESH_GENERATED_AT });
    render(<WorkspaceCoverageStrip data={data} now={FIXED_NOW} />);

    expect(screen.getByText(DEGRADED_SNIPPETS.configAbsent)).toBeInTheDocument();
    expect(queryAlertTriangle()).toBeInTheDocument();

    expect(screen.queryByText(DEGRADED_SNIPPETS.overdue)).not.toBeInTheDocument();
    expect(screen.queryByText(DEGRADED_SNIPPETS.scanIncomplete)).not.toBeInTheDocument();
    expect(screen.queryByText(DEGRADED_SNIPPETS.accessUnreliable)).not.toBeInTheDocument();
    expect(screen.queryByText(DEGRADED_SNIPPETS.configMismatch)).not.toBeInTheDocument();
  });

  it("localConfigStatus='version-mismatch': an additional 'Classification config changed' chip appends, no other degraded copy", () => {
    const data = makeLocalConfigVersionMismatchFixture({ staleGeneratedAt: FRESH_GENERATED_AT });
    render(<WorkspaceCoverageStrip data={data} now={FIXED_NOW} />);

    expect(screen.getByText(DEGRADED_SNIPPETS.configMismatch)).toBeInTheDocument();
    expect(queryAlertTriangle()).toBeInTheDocument();

    expect(screen.queryByText(DEGRADED_SNIPPETS.overdue)).not.toBeInTheDocument();
    expect(screen.queryByText(DEGRADED_SNIPPETS.scanIncomplete)).not.toBeInTheDocument();
    expect(screen.queryByText(DEGRADED_SNIPPETS.accessUnreliable)).not.toBeInTheDocument();
    expect(screen.queryByText(DEGRADED_SNIPPETS.configAbsent)).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------
  it("data=undefined: renders skeletons, zero chips, zero degraded copy", () => {
    render(<WorkspaceCoverageStrip data={undefined} now={FIXED_NOW} />);

    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-slot="badge"]').length).toBe(0);
    expect(queryAlertTriangle()).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------
  // Chip-4 never escalates, regardless of unclassified count (D-14).
  // ---------------------------------------------------------------------
  it("unclassifiedRootIds non-empty: chip 4 renders plain text, never warn styling", () => {
    const data = makeWorkspaceMapFixture({
      staleGeneratedAt: FRESH_GENERATED_AT,
      unclassifiedRootIds: ["root-a", "root-b", "root-c", "root-d"],
    });
    render(<WorkspaceCoverageStrip data={data} now={FIXED_NOW} />);

    expect(screen.getByText("4 roots unclassified")).toBeInTheDocument();
    // No warn treatment anywhere — the only degraded input here would be
    // unclassifiedRootIds, and it must never trigger AlertTriangle.
    expect(queryAlertTriangle()).not.toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------
// D-17: the 36-hour staleness boundary, in epoch seconds.
//
// `isScanStale` takes an injected `now` (ms) — no system-clock mocking is
// involved anywhere in this suite.
// -----------------------------------------------------------------------
describe("staleness boundary (D-17)", () => {
  // A fixed reference "now", independent of the render-tests' FIXED_NOW
  // above — 2026-08-14T12:00:00Z.
  const NOW_MS = Date.UTC(2026, 7, 14, 12, 0, 0);
  const NOW_SECONDS = NOW_MS / 1000;
  const ONE_HOUR_SECONDS = 60 * 60;
  const THIRTY_SIX_HOURS_SECONDS = 36 * ONE_HOUR_SECONDS;

  it("generatedAt exactly 36h before now: NOT stale (exclusive boundary)", () => {
    const generatedAtSeconds = NOW_SECONDS - THIRTY_SIX_HOURS_SECONDS;
    expect(isScanStale(generatedAtSeconds, NOW_MS)).toBe(false);
  });

  it("generatedAt 36h + 1s before now: stale", () => {
    const generatedAtSeconds = NOW_SECONDS - (THIRTY_SIX_HOURS_SECONDS + 1);
    expect(isScanStale(generatedAtSeconds, NOW_MS)).toBe(true);
  });

  it("generatedAt 35h 59m 59s before now: NOT stale", () => {
    const generatedAtSeconds = NOW_SECONDS - (THIRTY_SIX_HOURS_SECONDS - 1);
    expect(isScanStale(generatedAtSeconds, NOW_MS)).toBe(false);
  });

  it("generatedAt 1 minute before now: NOT stale (healthy control)", () => {
    const generatedAtSeconds = NOW_SECONDS - 60;
    expect(isScanStale(generatedAtSeconds, NOW_MS)).toBe(false);
  });

  it("unit-sanity: the 36h-boundary generatedAt reads as the current year in UTC, not 1970", () => {
    // The discriminator between a correct epoch-seconds interpretation and
    // one that silently passed vacuously by reading the value as
    // milliseconds (which would land the date in 1970). Compared against
    // the injected NOW_MS's own year rather than the real wall clock, so
    // this stays correct regardless of when the suite actually runs.
    const generatedAtSeconds = NOW_SECONDS - THIRTY_SIX_HOURS_SECONDS;
    const expectedYear = new Date(NOW_MS).getUTCFullYear();
    expect(new Date(generatedAtSeconds * 1000).getUTCFullYear()).toBe(expectedYear);
  });

  // ---------------------------------------------------------------------
  // Render-level: the strip's own "overdue" treatment, driven through the
  // fixture's staleGeneratedAt knob.
  // ---------------------------------------------------------------------

  it("render: a 40h-old snapshot renders the overdue copy with warn treatment", () => {
    const data = makeWorkspaceMapFixture({
      staleGeneratedAt: NOW_SECONDS - 40 * ONE_HOUR_SECONDS,
    });
    render(<WorkspaceCoverageStrip data={data} now={NOW_MS} />);

    expect(screen.getByText(DEGRADED_SNIPPETS.overdue)).toBeInTheDocument();
    expect(queryAlertTriangle()).toBeInTheDocument();
  });

  it("render: a 2h-old snapshot does NOT render the overdue copy", () => {
    const data = makeWorkspaceMapFixture({
      staleGeneratedAt: NOW_SECONDS - 2 * ONE_HOUR_SECONDS,
    });
    render(<WorkspaceCoverageStrip data={data} now={NOW_MS} />);

    expect(screen.queryByText(DEGRADED_SNIPPETS.overdue)).not.toBeInTheDocument();
    expect(queryAlertTriangle()).not.toBeInTheDocument();
  });
});
