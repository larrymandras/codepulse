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

const mockGetCatalogue = vi.fn();
let stubActive = false;

vi.mock("../lib/brainsApi", () => ({
  brainsApi: {
    isStub: true,
    getCatalogue: (...args: unknown[]) => mockGetCatalogue(...args),
    dispatchSwap: vi.fn(),
    getDefaultProfileId: vi.fn(),
  },
  get BRAINS_STUB_ACTIVE() {
    return stubActive;
  },
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
  mockGetCatalogue.mockReset();
  mockGetCatalogue.mockResolvedValue([]);
  stubActive = false;
  lastPickerProps = null;
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

describe("AgentProfileRows — stub indicator (D-16)", () => {
  it("renders the STUB chip on the row when the stub adapter is active", () => {
    stubActive = true;
    mockActiveEngineMap = { personal: { model: "claude-sonnet-5", mode: "inherited" } };
    renderRows({ profileConfigs: [makeConfig("personal")] });

    expect(screen.getByTestId("settings-engine-stub-personal")).toBeInTheDocument();
  });

  it("omits the STUB chip when the stub adapter is not active", () => {
    stubActive = false;
    mockActiveEngineMap = { personal: { model: "claude-sonnet-5", mode: "inherited" } };
    renderRows({ profileConfigs: [makeConfig("personal")] });

    expect(screen.queryByTestId("settings-engine-stub-personal")).not.toBeInTheDocument();
  });
});
