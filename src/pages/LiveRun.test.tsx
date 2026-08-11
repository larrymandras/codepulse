import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Nyquist GAP-2 (Phase 111, task 111-01-03, Stale Docs rule) ───────────────
//
// 111-01 Task 3 corrected the mount-site comment above <JobsPanel /> in
// LiveRun.tsx: the pre-correction comment claimed a live-streaming /
// live-query-driven surface, which became false when JobsPanel was rewritten
// as a post-hoc history board over terminal-state subagentJobs rows (Phase
// 111 D-10 — see 111-CONTEXT.md for the probe evidence that no "running"
// subagentJobs row can ever arrive). There was no LiveRun test file at all
// before this one, so that correction had no automated guard and could rot
// silently on the next edit.
//
// Idiom follows the existing source-text-assertion precedent in this repo:
// CostBreakdown.test.tsx:287, CostBreakdownTable.test.tsx:180/185,
// CostBudgetsAdmin.test.tsx:226.
describe("LiveRun — JobsPanel mount-site comment stays accurate (111-01-03)", () => {
  function jobsPanelMountBlock(): string {
    const source = readFileSync(join(__dirname, "LiveRun.tsx"), "utf-8");
    const mountIndex = source.indexOf("<JobsPanel />");
    expect(mountIndex).toBeGreaterThan(-1);
    // Isolate a window around the mount rather than scanning the whole file,
    // so this test can't accidentally pass/fail on unrelated text elsewhere
    // in LiveRun.tsx (e.g. the legitimate isLive/liveSessionId banner used
    // for the timeline tab, which genuinely IS live).
    const start = Math.max(0, mountIndex - 400);
    return source.slice(start, mountIndex + "<JobsPanel />".length);
  }

  it("carries the corrected post-hoc history-board framing for the JobsPanel mount", () => {
    const block = jobsPanelMountBlock();
    expect(block).toMatch(/post-hoc mission history board/i);
    expect(block).toMatch(/not a live queue/i);
  });

  it("contains no stale live-streaming / live-query-driven claim for the JobsPanel mount", () => {
    const block = jobsPanelMountBlock();
    expect(block).not.toMatch(/live-streaming/i);
    expect(block).not.toMatch(/live-query-driven/i);
    expect(block).not.toMatch(/live query/i);
  });
});
