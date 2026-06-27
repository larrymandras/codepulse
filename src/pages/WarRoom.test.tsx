/**
 * WarRoom.test.tsx — Phase 90 Wave-0 RED gate (ROOM-04).
 *
 * Tests the WarRoom page behavioral contracts:
 *   deeplink-select: /war-room/:roomId auto-selects the matching room on load
 *   deeplink-closed: closed/non-existent roomId shows "Room Ended" banner
 *                    with a disabled Join control (ROOM-04, Surface D)
 *
 * All tests are EXPECTED to fail RED until Plan 06 implements the deep-link
 * logic (useParams + auto-select + closed-room banner) in WarRoom.tsx.
 *
 * RED condition:
 *   deeplink-select — WarRoom.tsx does not call useParams; room never auto-
 *                     selects from URL; "Select a room" placeholder remains.
 *   deeplink-closed — No "Room Ended" banner exists; Join button is not
 *                     disabled for closed rooms.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ─── Module mocks ─────────────────────────────────────────────────────────────
// Declared before component import (Vitest hoisting requirement).

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    warRoom: {
      listRooms: "warRoom:listRooms",
      getRoomEvents: "warRoom:getRoomEvents",
    },
    v6Mutations: { deleteWarRoom: "v6Mutations:deleteWarRoom" },
    avatars: { getImageUrl: "avatars:getImageUrl" },
  },
}));

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({
    subscribeEvent: vi.fn(() => () => {
      // returns unsubscribe no-op
    }),
    status: "disconnected",
  }),
}));

// useParams — returns {} by default (overridden per-test for deep-link cases).
// WarRoom.tsx does not currently call useParams, so this mock is the contract
// for Plan 06 to satisfy.
vi.mock("react-router-dom", () => ({
  useParams: vi.fn().mockReturnValue({}),
}));

// Stub complex child components so the page renders in jsdom without issues.

vi.mock("@/components/RoomListItem", () => ({
  RoomListItem: ({ room, onSelect, isSelected }: any) => (
    <div
      data-testid={`room-${room.roomId}`}
      data-selected={String(isSelected)}
      role="button"
      onClick={onSelect}
    >
      {room.name}
    </div>
  ),
}));

vi.mock("@/components/AgentVoiceCard", () => ({
  AgentVoiceCard: ({ name }: any) => (
    <div data-testid="agent-voice-card">{name}</div>
  ),
}));

// VoiceControlBar stub — disabled reflects isJoined prop (current behaviour).
// The test asserts Join is disabled for closed rooms → RED because the current
// implementation does not pass a disabled/closed-room signal.
vi.mock("@/components/VoiceControlBar", () => ({
  VoiceControlBar: ({ onJoin, isJoined }: any) => (
    <button data-testid="join-btn" onClick={onJoin} disabled={!!isJoined}>
      Join Voice
    </button>
  ),
}));

vi.mock("@/components/TranscriptPanel", () => ({
  TranscriptPanel: () => null,
}));

vi.mock("@/components/hr/WarRoomLaunchDialog", () => ({
  WarRoomLaunchDialog: () => null,
}));

// ─── Component import (after mocks) ──────────────────────────────────────────

import WarRoom from "./WarRoom";
import { useQuery } from "convex/react";
import { useParams } from "react-router-dom";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

type MockRoom = {
  _id: string;
  roomId: string;
  name: string;
  status: string;
  participantIds: string[];
};

const MOCK_ROOMS: MockRoom[] = [
  {
    _id: "id1",
    roomId: "active-room-1",
    name: "Active Room",
    status: "active",
    participantIds: [],
  },
  {
    _id: "id2",
    roomId: "closed-room-1",
    name: "Old Mission",
    status: "closed",
    participantIds: [],
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WarRoom — ROOM-04 deep-link + closed-room (RED gate, Plan 06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default useQuery behaviour: listRooms returns the mock rooms array.
    vi.mocked(useQuery).mockImplementation((query: any, ..._args: any[]) => {
      if (query === "warRoom:listRooms") return MOCK_ROOMS;
      return []; // getRoomEvents
    });

    // Default useParams: no roomId in URL (bare /war-room route).
    vi.mocked(useParams).mockReturnValue({});
  });

  // ── Deep-link auto-select (deeplink-select) ───────────────────────────────

  it("auto-selects the room matching URL roomId once rooms load (deeplink-select)", () => {
    // Simulate navigating to /war-room/active-room-1
    vi.mocked(useParams).mockReturnValue({ roomId: "active-room-1" });

    render(<WarRoom />);

    // RED: WarRoom.tsx does not call useParams; room is never auto-selected.
    // Without auto-select, the placeholder text is shown instead of the detail.
    //
    // When Plan 06 implements useParams + auto-select effect, this selector
    // will return null (placeholder gone) and the assertion will PASS.
    expect(
      screen.queryByText("Select a room to view details.")
    ).not.toBeInTheDocument();
  });

  it("detail panel shows room name when deep-link room is auto-selected", () => {
    vi.mocked(useParams).mockReturnValue({ roomId: "active-room-1" });

    render(<WarRoom />);

    // RED: room not auto-selected → detail panel h2 "Active Room" never renders.
    // Exact match: "Active Room" ≠ "Active Rooms" (sidebar SectionHeader), so
    // the only match is the detail panel h2 which only renders when selected.
    // getByRole throws when element not found (strict RED failure).
    expect(
      screen.getByRole("heading", { name: "Active Room" })
    ).toBeInTheDocument();
  });

  // ── Closed / non-existent room (deeplink-closed) ──────────────────────────

  it("shows 'Room Ended' banner when a closed room is selected (deeplink-closed)", () => {
    render(<WarRoom />);

    // Click the closed room in the sidebar to select it.
    fireEvent.click(screen.getByTestId("room-closed-room-1"));

    // RED: no "Room Ended" banner in current WarRoom.tsx — assertion fails.
    expect(screen.getByText("Room Ended")).toBeInTheDocument();
  });

  it("Join button is disabled for a closed room (deeplink-closed, Surface D)", () => {
    render(<WarRoom />);

    // Select the closed room.
    fireEvent.click(screen.getByTestId("room-closed-room-1"));

    // RED: current implementation does not disable Join for closed rooms.
    // VoiceControlBar stub: disabled={!!isJoined} — isJoined is false → not disabled.
    const joinBtn = screen.getByTestId("join-btn");
    expect(joinBtn).toBeDisabled();
  });

  // ── Non-existent roomId ────────────────────────────────────────────────────

  it("shows 'Room Ended' when deep-linked roomId does not match any room", () => {
    vi.mocked(useParams).mockReturnValue({ roomId: "nonexistent-xyz" });

    render(<WarRoom />);

    // RED: WarRoom.tsx does not have closed/missing room error handling.
    // When Plan 06 implements this, the banner should appear immediately on render.
    expect(screen.getByText("Room Ended")).toBeInTheDocument();
  });
});
