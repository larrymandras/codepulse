import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WarRoomLaunchDialog } from "./WarRoomLaunchDialog";

// The dialog pulls roster + team-preset data from convex-backed hooks and posts
// via astridrApi. Mock all three so the component renders in isolation.
vi.mock("@/hooks/useRosterAgents", () => ({
  useRosterAgents: () => ({
    agents: [
      { id: "astridr", name: "Ástríðr", tier: "elite" },
      { id: "freya", name: "Freya", tier: "elite" },
    ],
  }),
}));

vi.mock("@/hooks/useTeamPresets", () => ({
  useTeamPresets: () => ({ incrementUsage: vi.fn(), create: vi.fn() }),
}));

vi.mock("@/lib/astridrApi", () => ({
  createWarRoom: vi.fn().mockResolvedValue({ room_name: "war-room-x", participants: [] }),
}));

describe("WarRoomLaunchDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("seeds participants from initialParticipantIds when opened", () => {
    render(
      <WarRoomLaunchDialog
        open
        onOpenChange={vi.fn()}
        initialParticipantIds={["astridr"]}
      />,
    );
    expect(screen.getByText("Participants (1)")).toBeInTheDocument();
  });

  it("does NOT wipe participants when the parent re-renders with a fresh initialParticipantIds array (regression)", () => {
    // Parents pass an inline `[]`/array literal, so its identity changes every
    // render. The reset effect must key on `open` alone — otherwise each parent
    // re-render re-fires it and clears the form the operator is filling in,
    // which also keeps the Launch button disabled.
    const { rerender } = render(
      <WarRoomLaunchDialog
        open
        onOpenChange={vi.fn()}
        initialParticipantIds={["astridr"]}
      />,
    );
    expect(screen.getByText("Participants (1)")).toBeInTheDocument();

    // Simulate a parent re-render handing down a brand-new array reference
    // while the dialog stays open (e.g. a live listRooms subscription update).
    rerender(
      <WarRoomLaunchDialog
        open
        onOpenChange={vi.fn()}
        initialParticipantIds={[]}
      />,
    );

    // Participants must persist — not reset to 0.
    expect(screen.getByText("Participants (1)")).toBeInTheDocument();
    expect(screen.queryByText("Participants (0)")).not.toBeInTheDocument();
  });
});
