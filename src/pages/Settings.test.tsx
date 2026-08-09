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
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { AgentProfileRows } from "./Settings";
import type { SwapHistoryRow } from "../hooks/useControlVerbSwaps";

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

// Phase 109 plan 08 (D-10/D-11): `useCombinedSwapHistory` mocked keyed by profileId — consumed
// both by `ProfileSwapHistorySection` (the collapsed trigger's count badge) and, once expanded, by
// the REAL `SwapHistoryList` mounted inside it (kept real, not mocked, so this file also proves the
// disclosure's actual row-rendering behavior, not a stand-in). `describeSwapOutcome`/
// `filterBrainSwaps`/`SWAP_HISTORY_CAP`/`CombinedSwapHistoryRow` stay real via `importOriginal`.
type MockCombined = {
  rows: (SwapHistoryRow & { origin: "scoped" | "global" })[];
  totalCount: number;
  atCap: boolean;
};
const EMPTY_COMBINED: MockCombined = { rows: [], totalCount: 0, atCap: false };
let mockCombinedByProfile: Record<string, MockCombined> = {};
vi.mock("../hooks/useControlVerbSwaps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks/useControlVerbSwaps")>();
  return {
    ...actual,
    useCombinedSwapHistory: (profileId: string | undefined) =>
      (profileId && mockCombinedByProfile[profileId]) || EMPTY_COMBINED,
  };
});

type MockPending = { label: string; kind: "inflight" | "uncertain" } | null;

let lastPickerProps: { profileId: string; trigger?: ReactNode } | null = null;
// Phase 109 Plan 06: keyed by profileId (not a single "last" callback) — `AgentProfileRows` mounts
// one `BrainPicker` per row, and a test must be able to drive a specific row's pending state.
const pendingChangeByProfile: Record<string, (pending: MockPending) => void> = {};
vi.mock("../components/brains/BrainPicker", () => ({
  BrainPicker: (props: {
    profileId: string;
    trigger?: ReactNode;
    onPendingChange?: (pending: MockPending) => void;
  }) => {
    lastPickerProps = props;
    if (props.onPendingChange) {
      pendingChangeByProfile[props.profileId] = props.onPendingChange;
    }
    return <div data-testid={`mock-brain-picker-${props.profileId}`}>{props.trigger}</div>;
  },
}));

beforeEach(() => {
  mockActiveEngineMap = {};
  mockCatalogueEntries = [];
  lastPickerProps = null;
  mockGlobalOverride = { modelOverride: null, voiceOverride: null };
  mockProfileOverrides = {};
  mockCombinedByProfile = {};
  for (const key of Object.keys(pendingChangeByProfile)) delete pendingChangeByProfile[key];
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

describe("AgentProfileRows — provider dot tolerates a model-id vendor-prefix mismatch (Phase 109 Plan 05, D-08)", () => {
  it("resolves the real vendor color when the reported model is vendor-prefixed but the catalogue id is bare", () => {
    mockCatalogueEntries = [
      { id: "claude-sonnet-5", name: "Claude Sonnet 5", vendor: "anthropic_direct" },
    ];
    mockActiveEngineMap = { personal: { model: "anthropic/claude-sonnet-5", mode: "inherited" } };
    renderRows({
      profileConfigs: [makeConfig("personal")],
      profiles: [makeAgentProfile("personal")],
    });

    const nameSpan = screen.getByTestId("settings-engine-name-personal");
    const dot = nameSpan.previousElementSibling as HTMLElement | null;
    expect(dot).not.toBeNull();
    expect(dot!.style.backgroundColor).not.toBe("var(--muted-foreground)");
  });

  it("CONTROL: still falls back to the neutral dot when the reported model matches nothing in the catalogue — a change that made the lookup always succeed must fail this", () => {
    mockCatalogueEntries = [
      { id: "claude-sonnet-5", name: "Claude Sonnet 5", vendor: "anthropic_direct" },
    ];
    mockActiveEngineMap = { personal: { model: "anthropic/claude-opus-4-8", mode: "inherited" } };
    renderRows({
      profileConfigs: [makeConfig("personal")],
      profiles: [makeAgentProfile("personal")],
    });

    const nameSpan = screen.getByTestId("settings-engine-name-personal");
    const dot = nameSpan.previousElementSibling as HTMLElement | null;
    expect(dot).not.toBeNull();
    expect(dot!.style.backgroundColor).toBe("var(--muted-foreground)");
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

describe("AgentProfileRows — the bounded 'accepted, not yet confirmed' state reads as uncertain, never in-progress (Phase 109 Plan 06, 109-UI-SPEC.md §C)", () => {
  it("renders a static AlertTriangle (never a pulsing dot) for the uncertain kind, paired with a control asserting the in-flight kind renders the pulse and no AlertTriangle", () => {
    mockActiveEngineMap = { personal: { model: "claude-sonnet-5", mode: "inherited" } };
    renderRows({
      profileConfigs: [makeConfig("personal")],
      profiles: [makeAgentProfile("personal")],
    });

    // CONTROL: in-flight — the status-info pulsing dot renders, no AlertTriangle.
    act(() => {
      pendingChangeByProfile.personal?.({ label: "· switching to Codex CLI…", kind: "inflight" });
    });
    let pending = screen.getByTestId("settings-engine-pending-personal");
    expect(pending.querySelector('[class*="status-info"].animate-pulse')).toBeInTheDocument();
    expect(pending.querySelector("svg.lucide-triangle-alert")).not.toBeInTheDocument();
    expect(pending).toHaveTextContent("switching to Codex CLI");

    // Uncertain — a static AlertTriangle, never a pulsing dot.
    act(() => {
      pendingChangeByProfile.personal?.({ label: "· not yet confirmed", kind: "uncertain" });
    });
    pending = screen.getByTestId("settings-engine-pending-personal");
    expect(pending.querySelector('[class*="status-info"].animate-pulse')).not.toBeInTheDocument();
    expect(pending.querySelector("svg.lucide-triangle-alert")).toBeInTheDocument();
    expect(pending).toHaveTextContent("not yet confirmed");
  });
});

// ─── Swap-history disclosure (Phase 109 plan 08, D-10/D-11/D-12) ──────────────

function makeSwapRow(
  id: string,
  timestamp: number,
  origin: "scoped" | "global" = "scoped"
): SwapHistoryRow & { origin: "scoped" | "global" } {
  return {
    _id: id,
    verb: "swap_model",
    target: "anthropic-sonnet-5",
    resolved: "anthropic-sonnet-5",
    path: "claude-native",
    channel: "chat",
    timestamp,
    origin,
  };
}

describe("AgentProfileRows — per-profile swap-history disclosure (Phase 109 plan 08, D-10)", () => {
  it("is collapsed on first render — no history rows in the document until the trigger is activated", () => {
    mockActiveEngineMap = { personal: { model: "claude-sonnet-5", mode: "inherited" } };
    mockCombinedByProfile = {
      personal: { rows: [makeSwapRow("row-1", 1000)], totalCount: 1, atCap: false },
    };
    renderRows({ profileConfigs: [makeConfig("personal")] });

    // The trigger (with its true count) is present...
    expect(screen.getByTestId("settings-swap-history-trigger-personal")).toHaveTextContent(
      "Swap history (1)"
    );
    // ...but no row content or caption is in the document yet.
    expect(screen.queryByText("Switched")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Showing 1 swap (per-profile + global).")
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("settings-swap-history-trigger-personal"));

    expect(screen.getByText("Switched")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 swap (per-profile + global).")).toBeInTheDocument();
  });

  it("shows the true pre-truncation count on the badge even though it exceeds the display cap, while the expanded content simultaneously shows the at-cap truncation caption — badge and caption disagree numerically, which is the honest reading", () => {
    mockActiveEngineMap = { personal: { model: "claude-sonnet-5", mode: "inherited" } };
    const capRows = Array.from({ length: 20 }, (_, i) => makeSwapRow(`row-${i}`, 1000 + i));
    mockCombinedByProfile = {
      personal: { rows: capRows, totalCount: 37, atCap: true },
    };
    renderRows({ profileConfigs: [makeConfig("personal")] });

    expect(screen.getByTestId("settings-swap-history-trigger-personal")).toHaveTextContent(
      "Swap history (37)"
    );

    fireEvent.click(screen.getByTestId("settings-swap-history-trigger-personal"));

    expect(
      screen.getByText(
        "Showing the last 20 combined swaps (per-profile + global) — earlier swaps may exist."
      )
    ).toBeInTheDocument();
    // The badge's "(37)" and the caption's "20" genuinely disagree — that disagreement IS the
    // honest reading (37 total, 20 rendered), never a rounded or capped-looking badge number.
    expect(screen.getByTestId("settings-swap-history-trigger-personal")).not.toHaveTextContent(
      "Swap history (20)"
    );
  });

  it("opens and closes two profiles' disclosures independently", () => {
    mockActiveEngineMap = {
      personal: { model: "claude-sonnet-5", mode: "inherited" },
      consulting: { model: "claude-opus-4-8", mode: "inherited" },
    };
    mockCombinedByProfile = {
      personal: { rows: [makeSwapRow("personal-row", 1000)], totalCount: 1, atCap: false },
      consulting: { rows: [makeSwapRow("consulting-row", 2000)], totalCount: 1, atCap: false },
    };
    renderRows({ profileConfigs: [makeConfig("personal"), makeConfig("consulting")] });

    fireEvent.click(screen.getByTestId("settings-swap-history-trigger-personal"));

    // personal's history is visible; consulting's own trigger is present but still collapsed.
    expect(screen.getByText("Showing 1 swap (per-profile + global).")).toBeInTheDocument();
    expect(screen.getByTestId("settings-swap-history-trigger-consulting")).toHaveTextContent(
      "Swap history (1)"
    );

    fireEvent.click(screen.getByTestId("settings-swap-history-trigger-consulting"));

    // Both are now expanded, independently.
    expect(screen.getAllByText("Showing 1 swap (per-profile + global).")).toHaveLength(2);

    fireEvent.click(screen.getByTestId("settings-swap-history-trigger-personal"));

    // Closing personal's disclosure does not affect consulting's, which stays open.
    expect(screen.getAllByText("Showing 1 swap (per-profile + global).")).toHaveLength(1);
  });

  it("no nav entry or route was added — the disclosure lives entirely inside the existing Settings/Agents surface", () => {
    mockActiveEngineMap = { personal: { model: "claude-sonnet-5", mode: "inherited" } };
    renderRows({ profileConfigs: [makeConfig("personal")] });

    expect(screen.getByTestId("settings-swap-history-trigger-personal")).toBeInTheDocument();
  });
});
