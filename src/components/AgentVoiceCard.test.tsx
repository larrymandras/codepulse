/**
 * AgentVoiceCard.test.tsx — Phase 90 Wave-0 RED gate (ROOM-01).
 *
 * Tests resolveParticipant identity resolution + AgentVoiceCard smoke renders.
 * All tests are EXPECTED to fail RED until Plan 05 implements warRoomIdentity.ts.
 *
 * RED condition: resolveParticipant throws "not implemented (Plan 05)".
 *
 * Contract under test (ROOM-01, Surface C):
 *   KNOWN participant  → agent.name, agent.avatarData, tier as roleBadge
 *   UNKNOWN participant → "Agent #" + pid.slice(-4), { name: pid } avatar, "Agent" roleBadge
 *   Display name must NEVER equal the raw pid string.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { resolveParticipant } from "@/lib/warRoomIdentity";
import { AgentVoiceCard } from "@/components/AgentVoiceCard";
import type { RosterAgent } from "@/hooks/useRosterAgents";

// Mock convex/react — AgentAvatar (via AgentVoiceCard) imports useQuery but
// our test data never sets imageStorageId, so useQuery is never called.
// Mock is included for safety and to follow project test conventions.
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

// Mock the generated API module that AgentAvatar imports.
vi.mock("../../convex/_generated/api", () => ({
  api: {
    avatars: { getImageUrl: "avatars:getImageUrl" },
  },
}));

// ─── Test fixtures ────────────────────────────────────────────────────────────

const MOCK_AGENTS: RosterAgent[] = [
  {
    id: "agent-lyra-001",
    name: "Lyra",
    tier: "command",
    active: true,
    budget_fraction: 0.5,
    status: "active",
    avatarData: { name: "Lyra", emoji: "🌟", color: "#6366f1" },
  },
  {
    id: "agent-echo-002",
    name: "Echo",
    tier: "domain",
    active: true,
    budget_fraction: 0.3,
    status: "active",
    // No avatarData — resolved to name-based avatar in Plan 05
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("resolveParticipant — ROOM-01 identity resolution (RED gate, Plan 05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Known participant ────────────────────────────────────────────────────────

  it("KNOWN participant resolves to agent.name (not raw pid)", () => {
    // RED: resolveParticipant throws "not implemented (Plan 05)"
    const props = resolveParticipant("agent-lyra-001", MOCK_AGENTS, false);

    expect(props.name).toBe("Lyra");
    expect(props.name).not.toBe("agent-lyra-001"); // never raw pid
  });

  it("KNOWN participant resolves to agent.avatarData", () => {
    // RED: resolveParticipant throws "not implemented (Plan 05)"
    const props = resolveParticipant("agent-lyra-001", MOCK_AGENTS, false);

    expect(props.avatar).toEqual({ name: "Lyra", emoji: "🌟", color: "#6366f1" });
  });

  it("KNOWN participant roleBadge reflects agent.tier", () => {
    // RED: resolveParticipant throws "not implemented (Plan 05)"
    const props = resolveParticipant("agent-lyra-001", MOCK_AGENTS, false);

    expect(props.roleBadge).toBe("command");
  });

  // ── Unknown participant ──────────────────────────────────────────────────────

  it("UNKNOWN participant name is 'Agent #' + last-4 of pid (not raw pid)", () => {
    const pid = "unknown-participant-abcd";

    // RED: resolveParticipant throws "not implemented (Plan 05)"
    const props = resolveParticipant(pid, MOCK_AGENTS, false);

    expect(props.name).toBe("Agent #abcd");
    expect(props.name).not.toBe(pid); // NEVER render raw pid as display name
  });

  it("UNKNOWN participant avatar carries { name: pid } for deterministic color hash", () => {
    const pid = "unknown-xyz-1234";

    // RED: resolveParticipant throws "not implemented (Plan 05)"
    const props = resolveParticipant(pid, MOCK_AGENTS, false);

    // avatar.name = pid so getColor(pid) can produce a deterministic color;
    // this is different from the display name which is "Agent #1234"
    expect(props.avatar).toEqual({ name: pid });
  });

  it("UNKNOWN participant roleBadge is 'Agent'", () => {
    const pid = "totally-unknown-zzzz";

    // RED: resolveParticipant throws "not implemented (Plan 05)"
    const props = resolveParticipant(pid, MOCK_AGENTS, false);

    expect(props.roleBadge).toBe("Agent");
  });

  // ── Smoke renders ────────────────────────────────────────────────────────────

  it("smoke — AgentVoiceCard renders known participant props without error", () => {
    // RED: resolveParticipant throws before render is attempted
    const props = resolveParticipant("agent-lyra-001", MOCK_AGENTS, false);

    render(
      <AgentVoiceCard
        profileId={props.profileId}
        name={props.name}
        avatar={props.avatar}
        roleBadge={props.roleBadge}
        isSpeaking={false}
      />
    );

    expect(screen.getByText("Lyra")).toBeInTheDocument();
    expect(screen.getByText("command")).toBeInTheDocument();
  });

  it("smoke — AgentVoiceCard renders unknown participant props without error", () => {
    const pid = "unknown-smoke-5678";

    // RED: resolveParticipant throws before render is attempted
    const props = resolveParticipant(pid, MOCK_AGENTS, false);

    render(
      <AgentVoiceCard
        profileId={props.profileId}
        name={props.name}
        avatar={props.avatar}
        roleBadge={props.roleBadge}
        isSpeaking={false}
      />
    );

    expect(screen.getByText("Agent #5678")).toBeInTheDocument();
  });
});
