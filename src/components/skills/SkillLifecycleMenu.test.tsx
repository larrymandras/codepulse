/**
 * SkillLifecycleMenu test (Phase 98 Plan 04, LIFE-01..06) — jsdom render
 * assertions.
 *
 * Mocks convex/react (useQuery/useMutation) and the generated api module
 * (Skills.test.tsx's established convention) so no ConvexProvider is needed.
 * MoveToProjectDialog/DeleteSkillDialog are stubbed to a marker div (their
 * own behavior is covered by MoveToProjectDialog.test.tsx/DeleteSkillDialog.
 * test.tsx) — this suite only asserts SkillLifecycleMenu opens them with the
 * right props.
 *
 * Covers:
 *  - dormant vs active item sets differ (D-07)
 *  - shadow-blocked Restore is disabled + tooltip, click does not enqueue (D-09)
 *  - multi-scope row disables Archive/Move with the honest reason (Pitfall 1a)
 *  - Archive / Move-to-Global enqueue the correct args, no dialog
 *  - Move-to-Project / Delete Permanently open their dialogs
 *  - an in-flight lifecycle command renders RowStatusBadge
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));
import { TooltipProvider } from "@/components/ui/tooltip";
import { DORMANT_ORIGIN, isShadowing } from "@/lib/skills";
import type { RowSkill } from "./SkillRow";

// isDormant(skill)/isShadowing(skill) are mutually exclusive by construction
// (isDormant requires EVERY origin === DORMANT_ORIGIN; isShadowing requires
// at least one origin that ISN'T) — the real `skills` registry groups all
// origins for a name into ONE row (convex/skillSync.ts groupSkillRowsByName),
// so a row can never be both at once against live data. isShadowing stays a
// real, directly-testable pure function (see src/lib/skills.ts's own test
// suite) — here it's spied so the shadow-disabled-Restore branch can still
// be exercised in isolation as a defensive guard (D-09's client half of the
// two-layer check; the daemon's LAYER-2 re-check is the real backstop for
// any registry-staleness edge case this can't naturally reach).
vi.mock("@/lib/skills", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/skills")>();
  return { ...actual, isShadowing: vi.fn(actual.isShadowing) };
});

// Radix DropdownMenu/Tooltip use Popper internally — jsdom has no ResizeObserver.
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    forge: {
      listHosts: "mock-listHosts",
      listLifecycleCommands: "mock-listLifecycleCommands",
      listWorkspaces: "mock-listWorkspaces",
      enqueueLifecycle: "mock-enqueueLifecycle",
    },
  },
}));

vi.mock("./MoveToProjectDialog", () => ({
  MoveToProjectDialog: (props: {
    skillName: string;
    sourceOrigin: string;
    hostId: string;
    open: boolean;
  }) => (
    <div
      data-testid="move-dialog"
      data-skill={props.skillName}
      data-source={props.sourceOrigin}
      data-host={props.hostId}
      data-open={props.open}
    />
  ),
}));

vi.mock("./DeleteSkillDialog", () => ({
  DeleteSkillDialog: (props: {
    skillName: string;
    sourceOrigin: string;
    hostId: string;
    open: boolean;
  }) => (
    <div
      data-testid="delete-dialog"
      data-skill={props.skillName}
      data-source={props.sourceOrigin}
      data-host={props.hostId}
      data-open={props.open}
    />
  ),
}));

import { SkillLifecycleMenu, resolveHostId } from "./SkillLifecycleMenu";

let lifecycleRows: unknown[] = [];
let enqueueMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  lifecycleRows = [];
  enqueueMock = vi.fn(() => Promise.resolve());
  vi.mocked(useMutation).mockReturnValue(
    enqueueMock as unknown as ReturnType<typeof useMutation>
  );
  (useQuery as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (ref: unknown) => {
      if (ref === "mock-listLifecycleCommands") return lifecycleRows;
      return [];
    }
  );
  // Real behavior by default (matches every fixture below) — overridden to
  // `true` only within the shadow-blocked-Restore tests.
  vi.mocked(isShadowing).mockReturnValue(false);
});

function renderMenu(skill: RowSkill, hostId = "desktop") {
  return render(
    <TooltipProvider>
      <SkillLifecycleMenu skill={skill} hostId={hostId} />
    </TooltipProvider>
  );
}

function openMenu(displayName = "Legal") {
  // Radix's DropdownMenuTrigger opens on pointerdown (not click) — mirror
  // that exact event so the menu content actually mounts.
  fireEvent.pointerDown(
    screen.getByRole("button", { name: `Skill actions for ${displayName}` }),
    { button: 0, ctrlKey: false }
  );
}

const activeGlobal: RowSkill = {
  name: "legal",
  displayName: "Legal",
  description: "desc",
  overrideDescription: null,
  favorite: false,
  origins: ["claude-code"],
};

const activeProject: RowSkill = {
  ...activeGlobal,
  origins: ["claude-code:project:abc1234"],
};

const dormant: RowSkill = {
  ...activeGlobal,
  origins: [DORMANT_ORIGIN],
};

const multiScope: RowSkill = {
  ...activeGlobal,
  origins: ["claude-code", "claude-code:project:abc1234"],
};

describe("SkillLifecycleMenu — always-visible trigger", () => {
  it("renders an icon-only trigger with the aria-label contract", () => {
    renderMenu(activeGlobal);
    expect(
      screen.getByRole("button", { name: "Skill actions for Legal" })
    ).toBeInTheDocument();
  });
});

describe("SkillLifecycleMenu — dormant vs active item sets (D-07)", () => {
  it("dormant row renders Restore + Delete Permanently, not Archive/Move", () => {
    renderMenu(dormant);
    openMenu();
    expect(screen.getByRole("menuitem", { name: /Restore/i })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Delete Permanently/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^Archive$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Move/i })).not.toBeInTheDocument();
  });

  it("active single-scope (global) row renders Archive + Move to Project…, not Restore/Delete", () => {
    renderMenu(activeGlobal);
    openMenu();
    expect(screen.getByRole("menuitem", { name: /^Archive$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Move to Project…/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^Restore$/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /Delete Permanently/i })
    ).not.toBeInTheDocument();
  });

  it("active single-scope (project) row offers Move to Global…", () => {
    renderMenu(activeProject);
    openMenu();
    expect(
      screen.getByRole("menuitem", { name: /Move to Global…/i })
    ).toBeInTheDocument();
  });
});

describe("SkillLifecycleMenu — shadow-blocked Restore (D-09/T-98-09)", () => {
  it("disables Restore and renders a Tooltip (not a native title) when isShadowing is true", () => {
    vi.mocked(isShadowing).mockReturnValue(true);
    renderMenu(dormant);
    openMenu();
    const restoreItem = screen.getByRole("menuitem", { name: /Restore/i });
    expect(restoreItem).toHaveAttribute("data-disabled");
    expect(restoreItem).not.toHaveAttribute("title");
  });

  it("does not call enqueueLifecycle when the shadow-disabled Restore is clicked", () => {
    vi.mocked(isShadowing).mockReturnValue(true);
    renderMenu(dormant);
    openMenu();
    const restoreItem = screen.getByRole("menuitem", { name: /Restore/i });
    fireEvent.click(restoreItem);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("a non-shadowed dormant row's Restore is enabled and enqueues restore/global", () => {
    renderMenu(dormant);
    openMenu();
    const restoreItem = screen.getByRole("menuitem", { name: /Restore/i });
    expect(restoreItem).not.toHaveAttribute("data-disabled");
    fireEvent.click(restoreItem);
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hostId: "desktop",
        action: "restore",
        skillName: "legal",
        sourceOrigin: DORMANT_ORIGIN,
        destination: "global",
        workspaceId: null,
      })
    );
  });
});

describe("SkillLifecycleMenu — self-contained TooltipProvider (98-REVIEW CR-02)", () => {
  // Regression class documented by CodeVaultGraph.tooltip.test.tsx: nothing
  // above the routed Skills page provides a TooltipProvider, so these render
  // with NO ancestor provider — the exact production condition. Without the
  // component's own local provider, opening the menu throws
  // "`Tooltip` must be used within `TooltipProvider`" and the page-level
  // ErrorBoundary blanks the whole Skills page.
  it("multi-scope menu opens with NO ancestor TooltipProvider", () => {
    render(<SkillLifecycleMenu skill={multiScope} hostId="desktop" />);
    openMenu();
    expect(screen.getByRole("menuitem", { name: /Archive/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Move/i })).toBeInTheDocument();
  });

  it("shadow-blocked dormant menu opens with NO ancestor TooltipProvider", () => {
    vi.mocked(isShadowing).mockReturnValue(true);
    render(<SkillLifecycleMenu skill={dormant} hostId="desktop" />);
    openMenu();
    expect(screen.getByRole("menuitem", { name: /Restore/i })).toBeInTheDocument();
  });
});

describe("SkillLifecycleMenu — multi-scope guard (Pitfall 1a / T-98-08)", () => {
  it("disables Archive and Move with the honest multi-scope reason, never guessing origins[0]", () => {
    renderMenu(multiScope);
    openMenu();
    const archiveItem = screen.getByRole("menuitem", { name: /Archive/i });
    const moveItem = screen.getByRole("menuitem", { name: /Move/i });
    expect(archiveItem).toHaveAttribute("data-disabled");
    expect(moveItem).toHaveAttribute("data-disabled");
  });

  it("does not call enqueueLifecycle when a disabled multi-scope item is clicked", () => {
    renderMenu(multiScope);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Archive/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Move/i }));
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});

describe("SkillLifecycleMenu — Archive (no dialog)", () => {
  it("enqueues action archive, destination cold, sourceOrigin the active origin", () => {
    renderMenu(activeGlobal, "host-1");
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /^Archive$/i }));
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hostId: "host-1",
        action: "archive",
        skillName: "legal",
        sourceOrigin: "claude-code",
        destination: "cold",
        workspaceId: null,
      })
    );
    expect(screen.queryByTestId("move-dialog")).not.toBeInTheDocument();
  });
});

describe("SkillLifecycleMenu — LAYER-1 refusal surfaces via toast (98-REVIEW CR-03)", () => {
  it("toasts the stripped refusal reason when enqueueLifecycle rejects", async () => {
    enqueueMock.mockReturnValue(
      Promise.reject(
        new Error(
          "lifecycle-refused:collision:a dormant copy already exists in cold storage"
        )
      )
    );
    renderMenu(activeGlobal);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /^Archive$/i }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "a dormant copy already exists in cold storage"
      )
    );
  });
});

describe("SkillLifecycleMenu — Move to Global (no dialog)", () => {
  it("enqueues action move, destination global, sourceOrigin the project origin", () => {
    renderMenu(activeProject, "host-1");
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Move to Global…/i }));
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hostId: "host-1",
        action: "move",
        skillName: "legal",
        sourceOrigin: "claude-code:project:abc1234",
        destination: "global",
        workspaceId: null,
      })
    );
  });
});

describe("SkillLifecycleMenu — Move to Project… opens the dialog", () => {
  it("opens MoveToProjectDialog with the skill's active origin, no direct enqueue", () => {
    renderMenu(activeGlobal, "host-1");
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Move to Project…/i }));
    const dialog = screen.getByTestId("move-dialog");
    expect(dialog).toHaveAttribute("data-skill", "legal");
    expect(dialog).toHaveAttribute("data-source", "claude-code");
    expect(dialog).toHaveAttribute("data-host", "host-1");
    expect(dialog).toHaveAttribute("data-open", "true");
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});

describe("SkillLifecycleMenu — Delete Permanently opens the AlertDialog", () => {
  it("opens DeleteSkillDialog for a dormant row, no direct enqueue", () => {
    renderMenu(dormant, "host-1");
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete Permanently/i }));
    const dialog = screen.getByTestId("delete-dialog");
    expect(dialog).toHaveAttribute("data-skill", "legal");
    expect(dialog).toHaveAttribute("data-source", DORMANT_ORIGIN);
    expect(dialog).toHaveAttribute("data-host", "host-1");
    expect(dialog).toHaveAttribute("data-open", "true");
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});

describe("SkillLifecycleMenu — in-flight status badge (LIFE-06/D-08)", () => {
  it("renders RowStatusBadge when latestLifecycleForSkill returns a non-done row", () => {
    lifecycleRows = [
      {
        commandId: "cmd-1",
        status: "executing",
        lifecyclePayload: {
          action: "archive",
          skillName: "legal",
          sourceOrigin: "claude-code",
          destination: "cold",
          workspaceId: null,
        },
        error: null,
        createdAt: 1000,
        expiresAt: 2000,
      },
    ];
    renderMenu(activeGlobal);
    expect(screen.getByText("Executing…")).toBeInTheDocument();
  });

  it("renders no badge when the latest command for this skill is done", () => {
    lifecycleRows = [
      {
        commandId: "cmd-1",
        status: "done",
        lifecyclePayload: {
          action: "archive",
          skillName: "legal",
          sourceOrigin: "claude-code",
          destination: "cold",
          workspaceId: null,
        },
        error: null,
        createdAt: 1000,
        expiresAt: 2000,
      },
    ];
    renderMenu(activeGlobal);
    expect(screen.queryByText("Executing…")).not.toBeInTheDocument();
    expect(screen.queryByText("Queued")).not.toBeInTheDocument();
  });
});

describe("resolveHostId (D-08 host resolution helper)", () => {
  it("returns the explicit override when given, ignoring the host list", () => {
    expect(resolveHostId([{ hostId: "a", lastSeenAt: Date.now() }], "explicit")).toBe(
      "explicit"
    );
  });

  it("prefers the most-recently-seen ONLINE host", () => {
    const now = Date.now();
    const hosts = [
      { hostId: "old-online", lastSeenAt: now - 10_000 },
      { hostId: "new-online", lastSeenAt: now - 1_000 },
      { hostId: "offline", lastSeenAt: now - 60_000 },
    ];
    expect(resolveHostId(hosts)).toBe("new-online");
  });

  it("falls back to the newest-seen host overall when none are online", () => {
    const now = Date.now();
    const hosts = [
      { hostId: "offline-old", lastSeenAt: now - 120_000 },
      { hostId: "offline-new", lastSeenAt: now - 60_000 },
    ];
    expect(resolveHostId(hosts)).toBe("offline-new");
  });

  it("returns an empty string when there are no hosts and no explicit override", () => {
    expect(resolveHostId([])).toBe("");
  });
});
