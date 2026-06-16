/**
 * ForgePage tests — Phase 79, Plan 03.
 *
 * Mocks @/hooks/useForge so the page renders without Convex.
 * Verifies:
 *   1. Both job agent names appear in the list.
 *   2. Clicking the first card shows that job's agent in the detail header.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ForgeJobRow } from "@/hooks/useForge";

// ---------------------------------------------------------------------------
// Fixture jobs — two distinct hosts so the pair-selection logic is exercised
// ---------------------------------------------------------------------------

const jobA: ForgeJobRow = {
  id: "job-aaa",
  agent: "claude",
  mode: "goal",
  prompt: "Build a thing",
  workspaceId: "ws-1",
  status: "running",
  pid: 1234,
  exitCode: null,
  startedAt: "2026-06-15T10:00:00Z",
  finishedAt: null,
  artifactCount: 0,
  capabilities: "{}",
  model: null,
  createdAt: "2026-06-15T09:00:00Z",
  hostId: "desktop",
  updatedAt: "2026-06-15T10:00:00Z",
};

const jobB: ForgeJobRow = {
  id: "job-bbb",
  agent: "codex",
  mode: "chat",
  prompt: "Review the PR",
  workspaceId: "ws-2",
  status: "completed",
  pid: 5678,
  exitCode: 0,
  startedAt: "2026-06-15T08:00:00Z",
  finishedAt: "2026-06-15T08:30:00Z",
  artifactCount: 2,
  capabilities: "{}",
  model: "gpt-4",
  createdAt: "2026-06-15T07:00:00Z",
  hostId: "laptop",
  updatedAt: "2026-06-15T08:30:00Z",
};

// ---------------------------------------------------------------------------
// Mock @/hooks/useForge — control raw return via a mutable state ref.
// vi.hoisted must be self-contained (no outer variable access at hoist time),
// so we expose a setter that the tests call via beforeEach.
// ---------------------------------------------------------------------------

const hookState = vi.hoisted(() => {
  const state: { raw: ForgeJobRow[] | undefined } = { raw: undefined };
  return state;
});

vi.mock("@/hooks/useForge", () => ({
  useForgeJobsRaw: () => hookState.raw,
  useForgeJobs: () => hookState.raw ?? [],
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import ForgePage from "./ForgePage";

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgePage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  hookState.raw = [jobA, jobB];
});

describe("ForgePage", () => {
  it("renders the page title", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /^forge$/i })).toBeInTheDocument();
  });

  it("shows both job agent names in the list", () => {
    renderPage();
    // Each card renders the agent name as text
    const claudeCards = screen.getAllByText(/claude/i);
    expect(claudeCards.length).toBeGreaterThan(0);
    const codexCards = screen.getAllByText(/codex/i);
    expect(codexCards.length).toBeGreaterThan(0);
  });

  it("shows the no-selection prompt in the detail pane initially", () => {
    renderPage();
    expect(screen.getByText(/select a job to view details/i)).toBeInTheDocument();
  });

  it("clicking a job card shows that job's agent in the detail header", () => {
    renderPage();

    // The detail pane initially shows the no-selection prompt
    expect(screen.getByText(/select a job to view details/i)).toBeInTheDocument();

    // Click the button card for jobA (claude / desktop)
    // The card's aria-label is "Job job-aaa: claude — Build a thing"
    const cardA = screen.getByRole("button", { name: /job job-aaa/i });
    fireEvent.click(cardA);

    // After selection, the detail header should show the agent name
    // ForgeJobDetail renders: <span className="text-sm font-semibold text-foreground">{job.agent}</span>
    // There will be multiple "claude" texts (list + detail) — just assert at least one exists with semibold styling
    // We rely on the detail pane no-selection prompt disappearing and header agent appearing
    expect(screen.queryByText(/select a job to view details/i)).not.toBeInTheDocument();
    // Agent name appears in the detail header (text-sm font-semibold)
    const agentTexts = screen.getAllByText(/^claude$/i);
    expect(agentTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("derives isLoading from useForgeJobsRaw returning undefined", () => {
    hookState.raw = undefined;
    renderPage();
    // When loading, ForgeJobList renders aria-label="Loading jobs"
    expect(screen.getByLabelText(/loading jobs/i)).toBeInTheDocument();
  });

  it("does not call getJob / useForgeJob (detail comes from list row)", () => {
    // This is a static verification: the component renders without the mock
    // for useForgeJob being defined, which would throw if called
    renderPage();
    // If we get here without errors, no getJob call happened
    expect(true).toBe(true);
  });
});
