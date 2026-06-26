# Phase 90: Agent Room / War Room — Pattern Map

**Mapped:** 2026-06-26
**Files analyzed:** 8 (5 modify, 2 create, 1 astridr-repo modify)
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/pages/WarRoom.tsx` | page | event-driven + CRUD | `src/pages/hr/Roster.tsx` (useParams); self (existing body) | exact (self-modify) |
| `convex/warRoom.ts` | query module | CRUD | self `getRoomEvents` (lines 13-21) + `convex/schema.ts by_status` | exact |
| `convex/warRoomIngest.ts` | httpAction | event-driven | self (ingest shape); `convex/v6Mutations.ts insertWarRoomEvent` | exact (self-modify) |
| `convex/schema.ts` | schema / config | — | `convex/schema.ts` `forgeLogChunks` (lines 1541-1549) | exact |
| `src/App.tsx` | router config | request-response | self lines 131-134 (`/hr/roster/:agentId` pattern) | exact |
| `src/hooks/useWarRoomVoice.ts` | hook | request-response + event-driven | `src/hooks/useTtsPlayback.ts` | role-match |
| `src/__mocks__/livekit-client.ts` | test mock | — | `src/test/setup.ts` (vi.fn class stubs) | role-match |
| `astridr/api/war_room_routes.py` | route handler | request-response | self (existing POST / DELETE endpoints) | exact (self-modify) |

---

## Pattern Assignments

### `src/pages/WarRoom.tsx` (page, event-driven + CRUD — MODIFY)

**Self-analog:** existing file at `src/pages/WarRoom.tsx`
**Route-param analog:** `src/pages/hr/Roster.tsx` lines 1-25

**Imports to add** (based on Roster.tsx line 2 and RESEARCH):
```typescript
import { useParams } from "react-router-dom";
import { useRosterAgents } from "@/hooks/useRosterAgents";
```

**useParams pattern** (`src/pages/hr/Roster.tsx` lines 24-25):
```typescript
export default function Roster() {
  const { agentId } = useParams<{ agentId?: string }>();
```
Apply same shape in `WarRoom()`:
```typescript
const { roomId: deepLinkRoomId } = useParams<{ roomId?: string }>();
```

**Deep-link auto-select** (RESEARCH Pattern 6 / Pitfall 6):
```typescript
useEffect(() => {
  if (deepLinkRoomId && rooms.length > 0 && !selectedRoomId) {
    setSelectedRoomId(deepLinkRoomId);
  }
}, [deepLinkRoomId, rooms.length, selectedRoomId]);
```
Guard on `rooms.length > 0` — prevents early fire before Convex resolves.

**Current hardcoded identity props** (`WarRoom.tsx` lines 190-199 — to replace):
```typescript
{(selectedRoom.participantIds ?? []).map((pid) => (
  <AgentVoiceCard
    key={pid}
    profileId={pid}
    name={pid}          // ← hardcoded raw pid
    avatar={null}       // ← hardcoded null
    roleBadge="Agent"   // ← hardcoded
    isSpeaking={speakingAgents.has(pid)}
  />
))}
```
Replace using `resolveParticipant()` utility (RESEARCH Pattern 6):
```typescript
function resolveParticipant(
  pid: string,
  agents: RosterAgent[],
  isOperatorSelf: boolean,
): AgentVoiceCardProps {
  if (isOperatorSelf) {
    return { profileId: pid, name: "You", avatar: { name: "You", color: "var(--primary)" }, roleBadge: "Operator", isSpeaking: false };
  }
  const agent = agents.find(a => a.id === pid || a.name === pid);
  if (agent) {
    return {
      profileId: pid,
      name: agent.name,
      avatar: agent.avatarData ?? { name: agent.name },
      roleBadge: agent.tier ?? "Agent",
      isSpeaking: speakingAgents.has(pid),
    };
  }
  // D-05: unknown participant — deterministic avatar from getColor hash
  return {
    profileId: pid,
    name: "Agent #" + pid.slice(-4),
    avatar: { name: pid },
    roleBadge: "Agent",
    isSpeaking: speakingAgents.has(pid),
  };
}
```

**agentColor (currently `undefined` at line 63):** Wire by calling `getColor(pid)` exported from `AgentAvatar.tsx` (see Shared Patterns — `getColor` must be exported first).

**Room reset effect — must trigger `leave()`** (`WarRoom.tsx` lines 43-47 — current):
```typescript
useEffect(() => {
  setLiveChunks([]);
  setIsJoined(false);
  setIsMuted(false);
}, [selectedRoomId]);
```
Extend to call `voice.leave()` if connected (Pitfall 1):
```typescript
useEffect(() => {
  setLiveChunks([]);
  void voice.leave();    // disconnect LiveKit if joined
}, [selectedRoomId]);
```

**Bounded room listing state** (RESEARCH Pattern 5):
```typescript
const [closedLimit, setClosedLimit] = useState(20);
const roomsData = useQuery(api.warRoom.listRooms, { closedLimit }) ?? { active: [], closed: [], hasMore: false };
const activeRooms = roomsData.active;
const closedRooms = roomsData.closed;
const hasMore = roomsData.hasMore;
const handleShowMore = () => setClosedLimit(prev => prev + 20);
```
Replace the existing lines 26 and 108-109:
```typescript
// current (lines 26, 108-109) — to replace:
const rooms = useQuery(api.warRoom.listRooms) ?? [];
const activeRooms = rooms.filter((r) => r.status === "active");
const closedRooms = rooms.filter((r) => r.status !== "active");
```

**Transcript merge with seq** (RESEARCH Code Examples — replaces lines 93-105):
```typescript
const transcriptChunks: TranscriptChunk[] = [
  ...roomEvents
    .filter((e) => e.eventType === "transcript.chunk")
    .map((e) => ({
      id: e._id,
      speaker: (e as Record<string, unknown>).speakerName as string ?? "Unknown",
      speakerId: (e as Record<string, unknown>).speakerId as string | undefined,
      text: (e as Record<string, unknown>).text as string ?? "",
      timestamp: e.timestamp,
      seq: e.seq,
      isUser: (e as Record<string, unknown>).speakerId === "user",
      agentColor: resolveAgentColor((e as Record<string, unknown>).speakerId as string, agents),
    })),
  ...liveChunks.filter(lc =>
    !roomEvents.some(e => e.timestamp === lc.timestamp && (e as any).speakerId === lc.speakerId)
  ),
];
```

**Closed-room read-only state (D-06):** When `selectedRoom?.status !== "active"`, render a banner and disable `VoiceControlBar` Join. Pattern: conditional render before the detail body, analogous to the "No active rooms" empty state at WarRoom.tsx line 150-153.

---

### `convex/warRoom.ts` (query module, CRUD — MODIFY)

**Self-analog (bounded read pattern):** `convex/warRoom.ts` `getRoomEvents` lines 13-21
```typescript
export const getRoomEvents = query({
  args: { roomId: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, { roomId, limit }) => {
    return await ctx.db.query("warRoomEvents")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("asc")
      .take(limit ?? 500);
  },
});
```
Copy `.withIndex(...).order(...).take(N)` — that is the bounded-read idiom to apply to `listRooms`.

**Replacement `listRooms`** (RESEARCH Pattern 5 — replaces lines 4-11):
```typescript
export const listRooms = query({
  args: {
    closedLimit: v.optional(v.float64()),
  },
  handler: async (ctx, { closedLimit = 20 }) => {
    const limit = Math.min(closedLimit, 200);

    const active = await ctx.db
      .query("warRooms")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .collect();   // active rooms always fully listed (expected < 20 concurrent)

    const closedRaw = await ctx.db
      .query("warRooms")
      .withIndex("by_status", (q) => q.eq("status", "closed"))
      .order("desc")
      .take(limit + 1);

    const hasMore = closedRaw.length > limit;
    const closed = hasMore ? closedRaw.slice(0, limit) : closedRaw;

    return { active, closed, hasMore };
  },
});
```
Note: `by_status: ["status","createdAt"]` index already exists (`schema.ts` line 1288). Idle rooms (`status="idle"`) should be treated as closed — add a second bounded query for `"idle"` and merge into `closed`, or query closed as non-`"active"` (planner decides per Pitfall 4 / Open Question 2).

**Updated `getRoomEvents` to use seq index** (RESEARCH Code Examples):
```typescript
export const getRoomEvents = query({
  args: { roomId: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, { roomId, limit }) => {
    return await ctx.db.query("warRoomEvents")
      .withIndex("by_room_seq", (q) => q.eq("roomId", roomId))
      .order("asc")
      .take(limit ?? 500);
  },
});
```
Switch from `"by_room"` to `"by_room_seq"` after the schema adds that index.

---

### `convex/warRoomIngest.ts` + `convex/v6Mutations.ts` (httpAction + mutation — MODIFY)

**httpAction self-analog:** `convex/warRoomIngest.ts` full file — the ingest dispatch pattern is already correct. No changes needed to the httpAction itself.

**Mutation to modify:** `convex/v6Mutations.ts` `insertWarRoomEvent` lines 151-164 (current):
```typescript
export const insertWarRoomEvent = mutation({
  args: {
    roomId: v.string(),
    eventType: v.string(),
    speakerId: v.optional(v.string()),
    speakerName: v.optional(v.string()),
    text: v.optional(v.string()),
    payload: v.optional(v.any()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("warRoomEvents", args);
  },
});
```

**Seq-computing replacement** (RESEARCH Pattern 4 — copy OCC pattern from `convex/forge.ts` lines 623-649):
```typescript
export const insertWarRoomEvent = mutation({
  args: {
    roomId: v.string(),
    eventType: v.string(),
    speakerId: v.optional(v.string()),
    speakerName: v.optional(v.string()),
    text: v.optional(v.string()),
    payload: v.optional(v.any()),
    timestamp: v.float64(),
    // seq NOT in args — computed server-side
  },
  handler: async (ctx, args) => {
    const lastEvent = await ctx.db
      .query("warRoomEvents")
      .withIndex("by_room_seq", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .first();
    const seq = (lastEvent?.seq ?? -1) + 1;
    await ctx.db.insert("warRoomEvents", { ...args, seq });
  },
});
```
Forge precedent for OCC read-max-then-insert: `convex/forge.ts` lines 634-641:
```typescript
const existing = await ctx.db
  .query("forgeLogChunks")
  .withIndex("by_host_job_seq", (q) =>
    q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId).eq("seq", args.seq)
  )
  .unique();
if (existing) return;
await ctx.db.insert("forgeLogChunks", { ... });
```
The war room version is simpler (no idempotency check — each transcript chunk is unique).

---

### `convex/schema.ts` (schema/config — MODIFY)

**Forge seq precedent** (`schema.ts` lines 1541-1549):
```typescript
forgeLogChunks: defineTable({
  hostId:     v.string(),
  forgeJobId: v.string(),
  lines:      v.array(v.string()),
  seq:        v.number(),             // monotonic per (host,job) — ordering + dedup (REQUIRED)
  sentAt:     v.optional(v.string()),
})
  .index("by_host_job",     ["hostId", "forgeJobId"])
  .index("by_host_job_seq", ["hostId", "forgeJobId", "seq"]),
```

**Change to `warRoomEvents`** (currently lines 1290-1300):
```typescript
// CURRENT:
warRoomEvents: defineTable({
  roomId: v.string(),
  eventType: v.string(),
  speakerId: v.optional(v.string()),
  speakerName: v.optional(v.string()),
  text: v.optional(v.string()),
  payload: v.optional(v.any()),
  timestamp: v.float64(),
})
  .index("by_room", ["roomId", "timestamp"])
  .index("by_timestamp", ["timestamp"]),

// TARGET — add seq field + by_room_seq index:
warRoomEvents: defineTable({
  roomId: v.string(),
  eventType: v.string(),
  speakerId: v.optional(v.string()),
  speakerName: v.optional(v.string()),
  text: v.optional(v.string()),
  payload: v.optional(v.any()),
  timestamp: v.float64(),
  seq: v.optional(v.number()),        // D-07: monotonic per room; optional for backcompat
})
  .index("by_room", ["roomId", "timestamp"])    // kept — legacy reads
  .index("by_room_seq", ["roomId", "seq"])       // ADDED — deterministic ordering
  .index("by_timestamp", ["timestamp"]),
```
`v.optional(v.number())` (not `v.number()`) — existing rows have no `seq` and would be rejected by a required field (Pitfall 5).

---

### `src/App.tsx` (router config — MODIFY)

**Self-analog:** `src/App.tsx` lines 131-134 (`/hr/roster/:agentId` + `/hr/onboarding/:catalogId` deep-link pattern):
```typescript
<Route path="/hr/roster" element={<Suspense fallback={<div ...>Loading Roster...</div>}><HrRoster /></Suspense>} />
<Route path="/hr/roster/:agentId" element={<Suspense fallback={<div ...>Loading Roster...</div>}><HrRoster /></Suspense>} />
```

**Target change** — insert after existing `/war-room` route at line 118:
```typescript
{/* Phase 72 existing: */}
<Route path="/war-room" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading War Room...</div>}><WarRoom /></Suspense>} />
{/* Phase 90 — deep-link: */}
<Route path="/war-room/:roomId" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading War Room...</div>}><WarRoom /></Suspense>} />
```
Both routes render the same `<WarRoom />` component. `useParams()` returns `roomId` only for the second route.

---

### `src/hooks/useWarRoomVoice.ts` (hook, request-response + event-driven — CREATE)

**Primary analog:** `src/hooks/useTtsPlayback.ts` (full file)

Copy these structural patterns:

**Ref-for-stateful-resource pattern** (`useTtsPlayback.ts` lines 31-34):
```typescript
export function useTtsPlayback(): UseTtsPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
```
Map: `audioRef` → `roomRef` (`useRef<Room | null>(null)`), `isPlaying` → `connectionState`.

**Cleanup on unmount** (`useTtsPlayback.ts` lines 36-43):
```typescript
useEffect(() => {
  return () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };
}, []);
```
Map: `pause()` → `room.disconnect()`.

**useCallback action pattern** (`useTtsPlayback.ts` lines 45-78):
```typescript
const stop = useCallback(() => {
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current = null;
  }
  setIsPlaying(false);
}, []);
```
Map: `stop()` → `leave()`, `play()` → `join()`.

**Auth fetch pattern** (`src/lib/astridrApi.ts` lines 117-121 + 126-136):
```typescript
export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (ASTRIDR_API_KEY) h["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;
  return h;
}
export const astridrApiBase = (): string => ASTRIDR_API_BASE;

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ASTRIDR_API_BASE}${path}`, {
    headers: authHeaders(),
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new AstridrApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}
```
Token fetch in `join()` (RESEARCH Code Examples):
```typescript
import { authHeaders, astridrApiBase } from "@/lib/astridrApi";

async function fetchJoinToken(roomName: string): Promise<{ token: string; url: string }> {
  const res = await fetch(
    `${astridrApiBase()}/api/war-room/${encodeURIComponent(roomName)}/token`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ identity: "operator" }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `Token fetch failed: ${res.status}`);
  }
  return res.json();
}
```

**Full hook return type** (RESEARCH Pattern 2):
```typescript
export type VoiceConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export interface UseWarRoomVoiceReturn {
  connectionState: VoiceConnectionState;
  isMuted: boolean;
  join: (roomName: string) => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => Promise<void>;
}
```

**LiveKit Room lifecycle** (RESEARCH Pattern 1):
```typescript
import { Room, RoomEvent, Track, ConnectionState } from 'livekit-client';

const roomRef = useRef<Room | null>(null);
const audioElsRef = useRef<HTMLAudioElement[]>([]);

async function joinRoom(livekitUrl: string, token: string) {
  const room = new Room({ adaptiveStream: true, dynacast: true });

  room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
    // map SDK enum → VoiceConnectionState string
    setConnectionState(mapState(state));
  });
  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === Track.Kind.Audio) {
      const el = track.attach() as HTMLAudioElement;
      document.body.appendChild(el);
      audioElsRef.current.push(el);
    }
  });
  room.on(RoomEvent.TrackUnsubscribed, (track) => { track.detach(); });
  room.on(RoomEvent.Disconnected, () => {
    audioElsRef.current.forEach(el => el.remove());
    audioElsRef.current = [];
  });

  roomRef.current = room;
  await room.connect(livekitUrl, token);
  // DO NOT setMicrophoneEnabled(true) — D-03: join muted
}
```
Gate with `connectionState !== 'disconnected'` check before calling `join()` to prevent double-connect (Pitfall Anti-pattern).

---

### `src/__mocks__/livekit-client.ts` (test mock — CREATE)

**Analog:** `src/test/setup.ts` class stub pattern (lines 53-61):
```typescript
class WorkerMock {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor(_url: string | URL, _options?: WorkerOptions) {}
}
globalThis.Worker = WorkerMock;
```

**Target stub — copy this shape:**
```typescript
// src/__mocks__/livekit-client.ts
import { vi } from 'vitest';

export const ConnectionState = {
  Disconnected: 'Disconnected',
  Connecting: 'Connecting',
  Connected: 'Connected',
  Reconnecting: 'Reconnecting',
  SignalReconnecting: 'SignalReconnecting',
} as const;

export const RoomEvent = {
  ConnectionStateChanged: 'connectionStateChanged',
  TrackSubscribed: 'trackSubscribed',
  TrackUnsubscribed: 'trackUnsubscribed',
  Disconnected: 'disconnected',
} as const;

export const Track = { Kind: { Audio: 'audio', Video: 'video' } };

export class Room {
  connect = vi.fn(() => Promise.resolve());
  disconnect = vi.fn(() => Promise.resolve());
  localParticipant = {
    setMicrophoneEnabled: vi.fn(() => Promise.resolve()),
  };
  private _listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  on(event: string, handler: (...args: unknown[]) => void) {
    (this._listeners[event] ??= []).push(handler);
    return this;
  }
  off = vi.fn();
  // Test helper: simulate event emission
  emit(event: string, ...args: unknown[]) {
    this._listeners[event]?.forEach(h => h(...args));
  }
}
```
This mock lives at `src/__mocks__/livekit-client.ts`. Vitest will auto-use it for any test importing `livekit-client` (when placed in `src/__mocks__/`), or import it explicitly with `vi.mock('livekit-client')`.

**Test file pattern** (from `useTtsPlayback.test.ts` lines 1-34):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWarRoomVoice } from "./useWarRoomVoice";

vi.mock('livekit-client');

describe("useWarRoomVoice", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  // ...
});
```

---

### `astridr/api/war_room_routes.py` (route handler, request-response — MODIFY)

**Self-analog:** `war_room_routes.py` lines 56-96 (existing POST endpoint):
```python
@router.post("")
async def create_war_room(req: CreateWarRoomRequest) -> dict[str, Any]:
    _require_war_room()          # 503 guard
    # ... business logic ...
    log.info("api.war_room.created", ...)
    return { **result, "participants": participants, "topic": req.topic }
```

**New endpoint to append** (after line 113, after the DELETE endpoint):

First: add `import os` at line 8 (confirmed missing — Pitfall 3, Assumption A5). Current imports (lines 1-15):
```python
from __future__ import annotations
import uuid
from typing import Any
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
```
Add `import os` between `import uuid` and `from typing import Any`.

**New route shape** (RESEARCH Pattern 3, mirrors dispatcher.py lines 119-125):
```python
class JoinTokenRequest(BaseModel):
    """Request body for joining an existing war room."""
    identity: str | None = None   # defaults to "operator" if not provided


@router.post("/{room_name}/token")
async def get_join_token(room_name: str, req: JoinTokenRequest) -> dict[str, Any]:
    """Mint a LiveKit join token for an existing war room.

    Does not create or modify the room — only mints a participant token.
    Protected by the web channel's auth_check Bearer middleware (web.py:677-694).
    """
    _require_war_room()

    identity = req.identity or "operator"

    from astridr.channels.war_room.token import generate_participant_token

    token = generate_participant_token(room_name, identity)

    public_lk_url = os.environ.get("LIVEKIT_PUBLIC_URL", "ws://localhost:7880")

    log.info("api.war_room.token_issued", room_name=room_name, identity=identity)

    return {
        "token": token,
        "url": public_lk_url,
    }
```

**Auth:** No per-route auth code needed. `web.py:677-694` `auth_check` middleware auto-applies to all `/api/*` routes. The new `/api/war-room/{room_name}/token` path matches `request.url.path.startswith("/api/")` and is not in the exclusion list (not `/api/health`, not `/api/whatsapp/`, not `/api/telegram/`, not `/api/audio/`).

**Response shape:** `{ "token": "<jwt>", "url": "ws://..." }` — same as `dispatcher.py` return (minus `room` field, which the caller already has from the URL path).

---

## Shared Patterns

### Auth Header for astridr API Calls
**Source:** `src/lib/astridrApi.ts` lines 117-121
**Apply to:** `src/hooks/useWarRoomVoice.ts` token fetch
```typescript
export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (ASTRIDR_API_KEY) h["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;
  return h;
}
```
Import `authHeaders` and `astridrApiBase` from `@/lib/astridrApi` — do NOT re-implement inline.

### Error Handling (Convex mutations)
**Source:** `convex/warRoomIngest.ts` lines 55-59
**Apply to:** `convex/v6Mutations.ts insertWarRoomEvent`
```typescript
} catch (e: any) {
  return new Response(JSON.stringify({ error: e.message }), {
    status: 400,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
  });
}
```
The mutation itself (`insertWarRoomEvent`) does not need try/catch — Convex surfaces mutation errors to the caller. The httpAction wrapper already has the catch.

### Ref-Lifecycle Cleanup
**Source:** `src/hooks/useTtsPlayback.ts` lines 36-43
**Apply to:** `src/hooks/useWarRoomVoice.ts`
```typescript
useEffect(() => {
  return () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };
}, []);
```
Map: `audioRef.current.pause()` → `roomRef.current?.disconnect()`.

### Deterministic Color Hash (AgentAvatar — MUST EXPORT)
**Source:** `src/components/AgentAvatar.tsx` lines 28-40
```typescript
const DEFAULT_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f97316",
  "#22c55e", "#06b6d4", "#f59e0b", "#ef4444",
];

function getColor(name: string, override?: string): string {
  if (override) return override;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DEFAULT_COLORS[Math.abs(hash) % DEFAULT_COLORS.length];
}
```
Currently **file-private** (not exported). To use `getColor(pid)` in `WarRoom.tsx` for `agentColor` on transcript chunks and unknown participant cards, either:
- (a) Export it: change `function getColor` → `export function getColor` in `AgentAvatar.tsx`
- (b) Re-implement the same 6-line hash inline in a shared utility file

Option (a) is the single-file change. The planner must include this as a prerequisite step for ROOM-01.

### FastAPI Route Guard Pattern
**Source:** `astridr/api/war_room_routes.py` lines 35-39
**Apply to:** new `get_join_token` endpoint
```python
def _require_war_room() -> Any:
    """Guard: raise 503 if war room channel is not initialized."""
    if _war_room_channel is None:
        raise HTTPException(status_code=503, detail="War room channel not initialized")
    return _war_room_channel
```
Call `_require_war_room()` as first line in `get_join_token` — same as existing endpoints.

---

## No Analog Found

All files have analogs. No entries in this section.

---

## Critical Implementation Notes (for Planner)

| # | File | Issue | Resolution |
|---|------|-------|------------|
| N1 | `AgentAvatar.tsx` | `getColor()` is file-private — required for ROOM-01 `agentColor` | Export it as a prerequisite; planner should make this Wave 0 step 1 |
| N2 | `war_room_routes.py` | `import os` is missing (confirmed: current imports list only `uuid, Any, structlog, APIRouter, HTTPException, BaseModel`) | Add `import os` at top of file before the new route body |
| N3 | `warRoomEvents` schema | `seq` must be `v.optional(v.number())` not `v.number()` | Existing rows have no seq; required field would break existing data (Pitfall 5) |
| N4 | `WarRoom.tsx` room-change effect | Must call `voice.leave()` not just `setIsJoined(false)` | LiveKit Room instance is not tied to React state; must disconnect explicitly (Pitfall 1) |
| N5 | `useWarRoomVoice.ts` | Gate `join()` on `connectionState === 'disconnected'` | Prevents double-connect on rapid button clicks (Anti-pattern from RESEARCH) |
| N6 | `convex/warRoom.ts` | Decide `"idle"` room treatment before writing listRooms | Treat as closed (include in bounded closed section) — RESEARCH Open Question 2 |

---

## Metadata

**Analog search scope:** `src/pages/`, `src/hooks/`, `src/components/`, `src/lib/`, `src/test/`, `convex/`, `astridr/api/`, `astridr/channels/war_room/`
**Files scanned:** 18 source files read; 5 grep searches
**Pattern extraction date:** 2026-06-26
