/**
 * Settings.test.tsx — 103-07-T1.
 *
 * Tests `AgentProfileRows` (the Agent Profiles section rebuilt under D-06) directly, rather than
 * mounting the full `Settings` page — the full page also pulls in Privacy/Ambient contexts, Tabs,
 * the avatar uploader, LLM provider config, notification settings, etc., all orthogonal to this
 * task. `AgentProfileRows` is exported from `Settings.tsx` specifically so this file can exercise
 * it in isolation, matching the "test the component that owns the behavior" idiom this codebase
 * already uses for other page-embedded sections.
 *
 * Proves BSC-01's stale-read removal is REAL, not shadowed: the decisive fixture in the first
 * describe block sets the `agentProfiles` config's `model` field and the live reported engine to
 * DIFFERENT values and asserts only the live value ever renders — a fixture where they happened to
 * agree could not prove the stale read was actually gone (103-07-PLAN.md's own framing).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { AgentProfileRows } from "./Settings";

// ─── Mocks ────────────────────────────────────────────────────────────────────

let mockActiveEngineMap: Record<
  string,
  { model: string; mode: "session" | "pinned" | "inherited"; expiresAt?: number } | null
> = {};

vi.mock("../hooks/useActiveEngine", () => ({
  useActiveEngine: () => mockActiveEngineMap,
}));

// Phase 109 D-06/D-14: the two live override axes, mocked alongside `useActiveEngine`; the pure
// `resolveActiveBrain` is kept REAL via importOriginal so `AgentProfileRows`' actual precedence
// derivation runs.
let mockGlobalOverride: { modelOverride: string | null; voiceOverride: string | null } = {
  modelOverride: null,
  voiceOverride: null,
};
let mockProfileOverrides: Record<string, { model: string; source: string | null }> = {};
vi.mock("../hooks/useResolvedBrain", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks/useResolvedBrain")>();
  return {
    ...actual,
    useGlobalBrainOverride: () => mockGlobalOverride,
    useProfileBrainOverrides: () => mockProfileOverrides,
  };
});

// Phase 109 D-01/D-02: the ONE swap.catalogue fetcher, mocked directly — replaces the
// pre-Phase-109 per-profile adapter and build-time stub flag mocks.
let mockCatalogueEntries: { id: string; name: string; vendor?: string }[] | null = [];
vi.mock("../hooks/useBrainCatalogue", () => ({
  useBrainCatalogue: () => ({
    entries: mockCatalogueEntries,
    defaultProfileId: "",
    error: false,
    refetch: vi.fn(),
  }),
}));

let lastPickerProps: { profileId: string; trigger?: ReactNode } | null = null;
vi.mock("../components/brains/BrainPicker", () => ({
  BrainPicker: (props: { profileId: string; trigger?: ReactNode }) => {
    lastPickerProps = props;
    return <div data-testid={`mock-brain-picker-${props.profileId}`}>{props.trigger}</div>;
  },
}));

beforeEach(() => {
  mockActiveEngineMap = {};
  mockCatalogueEntries = [];
  lastPickerProps = null;
  mockGlobalOverride = { modelOverride: null, voiceOverride: null };
  mockProfileOverrides = {};
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeConfig(profileId: string): any {
  return { _id: profileId, profileId, updatedAt: Date.now() };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeAgentProfile(profileId: string, overrides: Record<string, unknown> = {}): any {
  return {
    _id: profileId,
    profileId,
    name: profileId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function renderRows(
  props: Partial<{
    profiles: ReturnType<typeof makeAgentProfile>[];
    profileConfigs: ReturnType<typeof makeConfig>[];
  }> = {}
) {
  const onEdit = vi.fn();
  const getAvatar = vi.fn().mockReturnValue(null);
  render(
    <AgentProfileRows
      profiles={props.profiles ?? []}
      profileConfigs={props.profileConfigs ?? []}
      getAvatar={getAvatar}
      onEdit={onEdit}
    />
  );
  return { onEdit, getAvatar };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AgentProfileRows — live engine wins over stale config (D-06/BSC-01)", () => {
  it("renders the LIVE reported engine, not the agentProfiles config model field", () => {
    mockActiveEngineMap = { personal: { model: "claude-sonnet-5", mode: "inherited" } };
    renderRows({
      profileConfigs: [makeConfig("personal")],
      profiles: [makeAgentProfile("personal", { model: "gpt-4o" })],
    });

    expect(screen.getByTestId("settings-engine-name-personal")).toHaveTextContent(
      "claude-sonnet-5"
    );
    expect(screen.queryByText("gpt-4o")).not.toBeInTheDocument();
    expect(screen.queryByText(/gpt-4o/)).not.toBeInTheDocument();
  });

  it("renders an honest unknown state, never the config model, when no engine has been reported", () => {
    mockActiveEngineMap = { personal: null };
    renderRows({
      profileConfigs: [makeConfig("personal")],
      profiles: [makeAgentProfile("personal", { model: "gpt-4o" })],
    });

    expect(screen.getByTestId("settings-engine-name-personal")).toHaveTextContent("Not reported");
    expect(screen.queryByText(/gpt-4o/)).not.toBeInTheDocument();
  });

  it("sources the row list from profileConfigs (populated), not agentProfiles (empty in production)", () => {
    mockActiveEngineMap = { personal: { model: "claude-sonnet-5", mode: "inherited" } };
    renderRows({
      profileConfigs: [makeConfig("personal")],
      profiles: [], // agentProfiles empty, matching production reality (convex/profiles.ts:113)
    });

    expect(screen.getByTestId("settings-engine-name-personal")).toHaveTextContent(
      "claude-sonnet-5"
    );
  });

  it("renders an honest empty state when there are no configured profiles", () => {
    renderRows({ profileConfigs: [] });
    expect(screen.getByText("No profiles configured.")).toBeInTheDocument();
  });
});

describe("AgentProfileRows — engine label reads useResolvedBrain's full chain (109-04, D-06/D-14)", () => {
  it("shows the OVERRIDE's model for a profile with an active live override, paired with a control profile (same fixture, telemetry only) showing the telemetry model", () => {
    mockActiveEngineMap = {
      personal: { model: "claude-sonnet-5", mode: "inherited" },
      consulting: { model: "claude-sonnet-5", mode: "inherited" },
    };
    mockProfileOverrides = {
      personal: { model: "claude-opus-4-8", source: "operator" },
    };
    renderRows({
      profileConfigs: [makeConfig("personal"), makeConfig("consulting")],
      profiles: [makeAgentProfile("personal"), makeAgentProfile("consulting")],
    });

    expect(screen.getByTestId("settings-engine-name-personal")).toHaveTextContent(
      "claude-opus-4-8"
    );
    expect(screen.getByTestId("settings-engine-name-consulting")).toHaveTextContent(
      "claude-sonnet-5"
    );
  });

  it("a freshly-pinned profile's label updates immediately from the live override — never disagrees with a swap-history section mounted beneath it (the D-06 two-surface-disagreement class D-14 exists to remove)", () => {
    mockActiveEngineMap = { personal: { model: "claude-sonnet-5", mode: "inherited" } };
    mockProfileOverrides = { personal: { model: "claude-opus-4-8", source: "operator" } };
    renderRows({
      profileConfigs: [makeConfig("personal")],
      profiles: [makeAgentProfile("personal")],
    });

    // The row shows the PIN, not the pre-pin telemetry reading — and per D-06's rendering rule it
    // reads through the same "pinned" branch as a telemetry-sourced pinned reading (Pin icon).
    expect(screen.getByTestId("settings-engine-name-personal")).toHaveTextContent(
      "claude-opus-4-8"
    );
    expect(screen.getByTestId("settings-engine-pinned-personal")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-engine-session-personal")).not.toBeInTheDocument();
  });
});

describe("AgentProfileRows — session override vs pinned default (D-02)", () => {
  it("renders the session secondary line, never the pinned line, for a session-override reading", () => {
    mockActiveEngineMap = {
      personal: {
        model: "claude-sonnet-5",
        mode: "session",
        expiresAt: Math.floor(Date.now() / 1000) + 1800,
      },
    };
    renderRows({ profileConfigs: [makeConfig("personal")] });

    expect(screen.getByTestId("settings-engine-session-personal")).toHaveTextContent(
      /session override/
    );
    expect(screen.queryByTestId("settings-engine-pinned-personal")).not.toBeInTheDocument();
  });

  it("renders the pinned secondary line, never the session line, for a pinned-default reading", () => {
    mockActiveEngineMap = { personal: { model: "claude-sonnet-5", mode: "pinned" } };
    renderRows({ profileConfigs: [makeConfig("personal")] });

    expect(screen.getByTestId("settings-engine-pinned-personal")).toHaveTextContent(
      "pinned default"
    );
    expect(screen.queryByTestId("settings-engine-session-personal")).not.toBeInTheDocument();
  });
});

describe("AgentProfileRows — Swap affordance is distinct from Edit (103-07-T1)", () => {
  it("renders both a Swap control (opening the picker) and a separate Edit control", () => {
    mockActiveEngineMap = { personal: { model: "claude-sonnet-5", mode: "inherited" } };
    const ap = makeAgentProfile("personal");
    const { onEdit } = renderRows({
      profileConfigs: [makeConfig("personal")],
      profiles: [ap],
    });

    const swapButton = screen.getByTestId("settings-swap-personal");
    const editButton = screen.getByRole("button", { name: "Edit" });
    expect(swapButton).toBeInTheDocument();
    expect(editButton).toBeInTheDocument();
    expect(swapButton).not.toBe(editButton);

    fireEvent.click(editButton);
    expect(onEdit).toHaveBeenCalledWith(ap);
    // Clicking Edit must never touch the swap picker's own scope.
    expect(lastPickerProps?.profileId).toBe("personal");
  });

  it("scopes the picker's per-profile branch to the row's own profileId", () => {
    mockActiveEngineMap = { consulting: { model: "codex-cli", mode: "inherited" } };
    renderRows({ profileConfigs: [makeConfig("consulting")] });

    expect(screen.getByTestId("mock-brain-picker-consulting")).toBeInTheDocument();
    expect(lastPickerProps?.profileId).toBe("consulting");
  });

  it("passes the row's own Swap button as the picker's trigger, not a second hand-rolled affordance", () => {
    mockActiveEngineMap = { personal: { model: "claude-sonnet-5", mode: "inherited" } };
    renderRows({ profileConfigs: [makeConfig("personal")] });

    const picker = screen.getByTestId("mock-brain-picker-personal");
    expect(picker.querySelector('[data-testid="settings-swap-personal"]')).toBeInTheDocument();
  });
});

describe("AgentProfileRows — no stub chrome anywhere (Phase 109 D-01)", () => {
  it("never renders a build-time-stub indicator on any row, under any condition", () => {
    mockActiveEngineMap = { personal: { model: "claude-sonnet-5", mode: "inherited" } };
    renderRows({ profileConfigs: [makeConfig("personal")] });

    expect(screen.queryByTestId("settings-engine-stub-personal")).not.toBeInTheDocument();
  });
});
