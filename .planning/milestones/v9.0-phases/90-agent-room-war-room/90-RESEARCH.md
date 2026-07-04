# Phase 90: Agent Room / War Room — Research

**Researched:** 2026-06-26
**Domain:** LiveKit JS client, Convex bounded queries, FastAPI token endpoint, React Router v7 deep-links
**Confidence:** HIGH (codebase fully audited; livekit-client API confirmed via GitHub; astridr auth pattern verified in web.py)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Full two-way voice join — publish mic + subscribe to agent audio. Not listen-only.
- **D-02:** Add `POST /api/war-room/{room}/token` to astridr-repo — wraps existing `generate_participant_token()`, lets operator join any live room.
- **D-03:** Join muted by default; explicit unmute. Mirrors Phase 92 voice safety posture. Reuse existing `VoiceControlBar` `isMuted` toggle.
- **D-04:** Map `participantId` → `useRosterAgents()` agent for name, avatar, color, roleBadge. Feed into `AgentVoiceCard` and transcript `agentColor`.
- **D-05:** Unknown participants get deterministic generated avatar + color from id hash. Never raw id string. Never identical placeholders for different unknowns.
- **D-06:** Closed/invalid deep-links render read-only "room ended" state (full transcript preserved, Join disabled). Not a redirect, not a 404.
- **D-07:** Add `seq` field to `warRoomEvents` for deterministic ordering. Merge persisted + live chunks by seq, not array-append order.
- **D-08:** Bounded listing = all active rooms + last 20 closed, with "show more" to page further back.

### Claude's Discretion

- Exact `N` for closed-room window and "show more" page size (start ~20).
- Unknown-participant identity uses initials vs emoji for generated avatar.
- Deep-link auto-scroll/auto-select behavior (lean toward auto-select + scroll to newest).
- Precise LiveKit client library + connection-state UI states (`livekit-client` is the expected SDK).
- Exact new endpoint path/shape in astridr-repo (suggested `POST /api/war-room/{room}/token`).

### Deferred Ideas (OUT OF SCOPE)

- Real-time multi-persona moderator / turn-taking in the War Room.
- Listen-only observer mode as a separate join tier.
- Push-to-talk mic interaction.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROOM-01 | Real participant identity: name, avatar, color, roleBadge from `useRosterAgents()` in place of hardcoded props at `WarRoom.tsx:190–199`. `agentColor` (currently `undefined` at line 63) wired per agent. | `useRosterAgents()` returns `{id, name, tier, avatarData?:{color,emoji,imageStorageId}}`. `AgentAvatar.getColor()` (line 33–39 in AgentAvatar.tsx) provides deterministic color hashing. |
| ROOM-02 | Bounded room listing — replace `warRoom.ts:listRooms` unbounded `.collect()` (lines 4–11); confirm ingest path populates rooms. | `by_status: ["status","createdAt"]` index exists. Pattern: `withIndex("by_status").order("desc").take(N+1)` returns `hasMore`. Ingest path confirmed: `/war-room-ingest` → `upsertWarRoom` mutation. |
| ROOM-03 | Genuine operator Join: real LiveKit voice join (publish mic + subscribe agent audio), joined muted, explicit unmute. Cross-repo: new token endpoint in astridr-repo. | `livekit-client@2.20.0` is the JS SDK. `generate_participant_token()` already exists in `token.py`. D-02 endpoint wraps it. Web channel Bearer middleware auto-protects new route. |
| ROOM-04 | `/war-room/:roomId` deep-link + deterministic transcript ordering via per-room monotonic `seq` on `warRoomEvents`. | React Router v7 nested route pattern. Convex OCC makes server-side seq computation race-free within a mutation. Forge `forgeLogChunks.seq` is the codebase precedent. |
</phase_requirements>

---

## Summary

Phase 90 wires and hardens a ~70–75%-complete War Room surface into a working multi-persona voice boardroom. No net-new page is created. All four capabilities (ROOM-01 through ROOM-04) have existing scaffolding that needs real data connected or hardened.

**ROOM-01** is a prop-wiring task: `WarRoom.tsx` passes `name={pid}`, `avatar={null}`, `roleBadge="Agent"` (lines 190–199) regardless of which participant it renders. `useRosterAgents()` already assembles the full identity dataset; the lookup is `agents.find(a => a.id === pid || a.name === pid)`. For unresolved participants, `AgentAvatar`'s existing `getColor(name)` hash (line 33–39 of `AgentAvatar.tsx`) already produces 8 deterministic brand colors — the call site just needs to pass `{ name: pid }` as the avatar prop.

**ROOM-02** is a Convex query replacement. The current `listRooms` uses `.collect()` (no bound) on a table that grows unboundedly. The `by_status: ["status","createdAt"]` index already supports a scoped bounded read. The fix: return `{ active: Room[], closed: Room[], hasMore: boolean }` with closed rooms bounded to N+1 (to detect `hasMore`). The `/war-room-ingest` path that populates rooms via `upsertWarRoom` is confirmed operational.

**ROOM-03** is the headline new integration: adding `livekit-client` (JS SDK, Apache-2.0, 5 years old, livekit org, 2.20.0) to CodePulse and wiring a React hook that manages the Room connection lifecycle. The astridr-repo side is minimal: one new route `POST /api/war-room/{room_name}/token` that wraps the already-present `generate_participant_token()`. The web channel's global Bearer auth middleware (`web.py:677–694`) automatically protects it — no per-route auth code required.

**ROOM-04** has two halves: (a) a React Router v7 route addition + `useParams()` in `WarRoom.tsx`, and (b) a Convex schema + mutation change to add a per-room monotonic `seq` field. The schema change is additive (`seq: v.number()`, new `by_room_seq` index). The mutation computes seq server-side within the serializable transaction (Convex OCC prevents races). Existing `by_room` index and `by_timestamp` index are kept.

**Primary recommendation:** Implement in dependency order — ROOM-04 schema first (schema change unblocks correct ordering everywhere), then ROOM-01 and ROOM-02 in parallel (both pure wiring, no cross-dependency), then ROOM-03 last (most risk, isolated to the voice join hook).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Agent identity resolution | Frontend (React) | — | `useRosterAgents()` already resolves API + Convex data; the War Room just consumes it |
| Room listing / bounded query | Database (Convex) | Frontend | Query lives in `warRoom.ts`; UI adds pagination state |
| LiveKit token mint | API / Backend (astridr-repo) | — | Token must be server-signed with `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET`; never expose these to the browser |
| LiveKit Room connection | Browser / Client | — | `livekit-client` runs in-browser; connects directly to LiveKit WS server |
| Mic publish / audio subscribe | Browser / Client | — | `room.localParticipant.setMicrophoneEnabled()` and `track.attach()` are browser-only APIs |
| Transcript seq ordering | Database (Convex) | Frontend | Seq is assigned at ingest time in the mutation (server-side); frontend just reads in seq order |
| Deep-link routing | Frontend (React Router) | — | Route param extraction + room auto-select is a client-side concern |
| Token endpoint auth | API / Backend (astridr-repo middleware) | — | Bearer check is in `web.py` middleware, not in the route handler |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `livekit-client` | 2.20.0 | Browser LiveKit Room connection, track publish/subscribe | Official LiveKit JS SDK (livekit org); Apache-2.0; 5 years on npm; only official browser SDK for LiveKit server |
| `convex` | ^1.42.0 (already installed) | Bounded room listing, seq-ordered events, real-time subscriptions | Already the project's database layer |
| `react-router-dom` | v7 (already installed via React Router v7) | `/war-room/:roomId` deep-link route | Already the project's router |

**Version verification:**
```bash
npm view livekit-client version   # → 2.20.0 (published 2026-06-24) [VERIFIED: npm registry]
```

`livekit-client` is the only new dependency for this phase. All other libraries are already in `package.json`.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `livekit-api` (Python, already in astridr-repo) | 1.1.0 | Token generation in D-02 endpoint | Already installed; `generate_participant_token()` wraps it |
| `motion/react` (already installed) | current | VoiceControlBar slide-up animation | Already used by `VoiceControlBar.tsx` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `livekit-client` | `@livekit/components-react` | The React components library is higher-level but overkill; we're wiring into existing War Room components, not using LiveKit's pre-built UI |
| Server-side seq computation | Client-side timestamp ordering | Timestamps from concurrent ingest are not monotonic (D-07 decision); server-side seq is required |
| Cursor-based Convex pagination | Increasing `take()` limit | Convex's `paginationOptsValidator` is heavyweight for a simple "show more 20" UX; increasing `closedLimit` arg is sufficient at expected War Room scale |

**Installation (CodePulse only — one new package):**
```bash
npm install livekit-client
```

---

## Package Legitimacy Audit

> slopcheck was unavailable (blocked by sandbox). All packages marked `[ASSUMED]` per graceful-degradation rule.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `livekit-client` | npm | ~5.5 yrs (created 2021-01-24) | High (LiveKit is widely used in production) | github.com/livekit/client-sdk-js | [ASSUMED] | Approved — official LiveKit org package, Apache-2.0, 5+ year track record, GitHub source confirmed |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time. `livekit-client` is tagged `[ASSUMED]` above. However, manual legitimacy signals are strong: official livekit org on GitHub, Apache-2.0 license, created January 2021, continuous release history (2.19.0 → 2.19.1 → 2.19.2 → 2.20.0 showing active maintenance), homepage matches official LiveKit docs. The planner should add a human-verify checkpoint before `npm install livekit-client` if strict slopcheck policy applies.*

---

## Architecture Patterns

### System Architecture Diagram

```
                    CodePulse Browser
                         │
          ┌──────────────┼──────────────────┐
          │              │                  │
   Convex useQuery   fetch() token      livekit-client
   (listRooms,       endpoint D-02      Room instance
   getRoomEvents)        │                  │
          │              │                  │
     Convex DB     astridr-repo        LiveKit Server
     warRooms      POST /api/war-room   (ws://lk-host:7880)
     warRoomEvents  /{room_name}/token       │
     (seq-ordered)       │              Agent audio tracks
          │         generate_            (published by agents)
   WarRoom.tsx       participant_              │
   (room select,     token()          track.attach() → <audio>
   transcript merge)      │           element → browser audio
          │         { token, url }          │
   VoiceControlBar        └──────────→ Room.connect(url, token)
   (Join / Mute /         (no mic until     │
    Leave / ConnectionState) explicit unmute)│
          │                           setMicrophoneEnabled(true)
   /war-room/:roomId ──────────────────────→ (operator's mic → room)
   (deep-link auto-select)
```

### Recommended Project Structure Changes

```
src/
├── pages/
│   └── WarRoom.tsx              # + useParams() for deep-link, + Room lifecycle state
├── hooks/
│   └── useWarRoomVoice.ts       # NEW: livekit-client Room lifecycle hook
├── components/
│   ├── VoiceControlBar.tsx      # + connectionState prop + "You'll join muted" sub-label
│   └── [no other component changes]
convex/
├── schema.ts                    # + seq field + by_room_seq index on warRoomEvents
├── warRoom.ts                   # listRooms → bounded query returning {active, closed, hasMore}
└── v6Mutations.ts               # insertWarRoomEvent → compute + assign seq
astridr-repo/
└── astridr/api/
    └── war_room_routes.py       # + POST /{room_name}/token route
src/App.tsx                      # + /war-room/:roomId route
```

### Pattern 1: LiveKit Browser Join (ROOM-03)

**What:** Connect a browser participant to a LiveKit room, muted by default, subscribe to agent audio.
**When to use:** On operator "Join Voice" click.

```typescript
// Source: github.com/livekit/client-sdk-js README + docs.livekit.io/home/client/tracks/publish/
import { Room, RoomEvent, Track, ConnectionState } from 'livekit-client';

// Create room once per component mount; store in ref so it survives re-renders
const roomRef = useRef<Room | null>(null);

async function joinRoom(livekitUrl: string, token: string) {
  const room = new Room({
    adaptiveStream: true,  // auto-quality
    dynacast: true,        // reduce bandwidth for non-visible tracks
  });

  // Track all attached audio elements for cleanup
  const audioEls: HTMLAudioElement[] = [];

  room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
    setConnectionState(state); // 'Disconnected'|'Connecting'|'Connected'|'Reconnecting'|'SignalReconnecting'
  });

  room.on(RoomEvent.TrackSubscribed, (track, _pub, _participant) => {
    if (track.kind === Track.Kind.Audio) {
      const el = track.attach();  // creates <audio> element; SDK handles playback
      document.body.appendChild(el);
      audioEls.push(el as HTMLAudioElement);
    }
  });

  room.on(RoomEvent.TrackUnsubscribed, (track) => {
    track.detach();  // removes and destroys the <audio> element
  });

  room.on(RoomEvent.Disconnected, () => {
    // Clean up audio elements
    audioEls.forEach(el => el.remove());
  });

  roomRef.current = room;
  await room.connect(livekitUrl, token);
  // DO NOT call setMicrophoneEnabled(true) here — D-03: join muted
}

// Explicit unmute (operator action)
async function unmute() {
  await roomRef.current?.localParticipant.setMicrophoneEnabled(true);
}

// Mute again
async function mute() {
  await roomRef.current?.localParticipant.setMicrophoneEnabled(false);
}

// Leave
async function leaveRoom() {
  await roomRef.current?.disconnect();
  roomRef.current = null;
}
```

**ConnectionState values** (from `livekit-client` `ConnectionState` enum, verified via `Room.ts`):
- `ConnectionState.Disconnected` → maps to UI state `"disconnected"` (pre-join / post-leave)
- `ConnectionState.Connecting` → maps to UI state `"connecting"` (spinner shown)
- `ConnectionState.Connected` → maps to UI state `"connected"` (green dot)
- `ConnectionState.Reconnecting` → maps to UI state `"reconnecting"` (amber pulse)
- `ConnectionState.SignalReconnecting` → treat same as `"reconnecting"` in UI

**Key RoomEvents used:**
- `RoomEvent.ConnectionStateChanged` — primary state driver
- `RoomEvent.TrackSubscribed` — wire agent audio tracks
- `RoomEvent.TrackUnsubscribed` — clean up detached tracks
- `RoomEvent.Disconnected` — final cleanup

### Pattern 2: `useWarRoomVoice` Hook Shape (ROOM-03)

**What:** Encapsulate Room lifecycle so WarRoom.tsx stays clean.

```typescript
// src/hooks/useWarRoomVoice.ts
export type VoiceConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

interface UseWarRoomVoiceReturn {
  connectionState: VoiceConnectionState;
  isMuted: boolean;
  join: (roomName: string) => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => Promise<void>;
}

export function useWarRoomVoice(): UseWarRoomVoiceReturn { ... }
```

The hook internally:
1. Fetches `POST /api/war-room/{roomName}/token` via `authHeaders()` + `astridrApiBase()`
2. Creates `new Room()`, sets up event listeners
3. Calls `room.connect(url, token)`
4. Cleans up on `leave()` or component unmount

### Pattern 3: D-02 Token Endpoint (astridr-repo)

**What:** Minimal FastAPI route that mints a LiveKit token for an existing room.
**Auth posture:** Inherits global `auth_check` Bearer middleware from `web.py:677–694` — no per-route auth code needed.

```python
# In astridr/api/war_room_routes.py — append after the DELETE endpoint

class JoinTokenRequest(BaseModel):
    """Request body for joining an existing war room."""
    identity: str | None = None  # defaults to "operator" if not provided

@router.post("/{room_name}/token")
async def get_join_token(room_name: str, req: JoinTokenRequest) -> dict[str, Any]:
    """Mint a LiveKit join token for an existing war room.

    Does not create or modify the room — only mints a participant token.
    Protected by the web channel's auth_check Bearer middleware (no auth code needed here).
    """
    _require_war_room()  # 503 if channel not initialized

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

**Response shape:** `{ "token": "<jwt>", "url": "ws://..." }` — exactly what `create_war_room` dispatcher already returns (minus `room` field, which the caller already knows from the URL path).

**`os` import:** Already available at module top of `war_room_routes.py`? Check — if not, add `import os`.

### Pattern 4: Seq Computation in Convex Mutation (ROOM-04)

**What:** Server-side monotonic seq per room, race-free under Convex OCC.
**Why safe:** Convex mutations execute as serializable transactions (OCC). If two concurrent mutations read the same max seq, one will conflict and retry — resulting in a correct, gap-free sequence.

```typescript
// convex/v6Mutations.ts — updated insertWarRoomEvent
export const insertWarRoomEvent = mutation({
  args: {
    roomId: v.string(),
    eventType: v.string(),
    speakerId: v.optional(v.string()),
    speakerName: v.optional(v.string()),
    text: v.optional(v.string()),
    payload: v.optional(v.any()),
    timestamp: v.float64(),
    // seq is NOT in args — it is computed server-side
  },
  handler: async (ctx, args) => {
    // Compute next seq within the serializable transaction
    // Uses by_room_seq index (added to schema) for efficient max lookup
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

**Forge precedent:** `convex/schema.ts:1545` — `forgeLogChunks.seq` (monotonic per `(host,job)`); `convex/schema.ts:1549` — `by_host_job_seq` index; `convex/forge.ts:636` — `appendLogChunk` uses the index for idempotency check. The war room pattern is the same, simplified (no idempotency dedup needed since each transcript chunk is a distinct event).

**Schema additions to `warRoomEvents`:**

```typescript
// convex/schema.ts — warRoomEvents (lines 1290–1299)
warRoomEvents: defineTable({
  roomId: v.string(),
  eventType: v.string(),
  speakerId: v.optional(v.string()),
  speakerName: v.optional(v.string()),
  text: v.optional(v.string()),
  payload: v.optional(v.any()),
  timestamp: v.float64(),
  seq: v.number(),   // D-07: monotonic per room, assigned at ingest — ADDED
})
  .index("by_room", ["roomId", "timestamp"])       // kept — legacy getRoomEvents
  .index("by_room_seq", ["roomId", "seq"])          // ADDED — deterministic ordering
  .index("by_timestamp", ["timestamp"]),            // kept
```

### Pattern 5: Bounded `listRooms` Query (ROOM-02)

```typescript
// convex/warRoom.ts — replacement for listRooms
export const listRooms = query({
  args: {
    closedLimit: v.optional(v.float64()),  // default 20
  },
  handler: async (ctx, { closedLimit = 20 }) => {
    const limit = Math.min(closedLimit, 200);  // safety cap

    const active = await ctx.db
      .query("warRooms")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .collect();  // active rooms are always fully listed (expected < 20 simultaneous)

    const closedRaw = await ctx.db
      .query("warRooms")
      .withIndex("by_status", (q) => q.eq("status", "closed"))
      .order("desc")
      .take(limit + 1);  // take one extra to detect hasMore

    const hasMore = closedRaw.length > limit;
    const closed = hasMore ? closedRaw.slice(0, limit) : closedRaw;

    return { active, closed, hasMore };
  },
});
```

**WarRoom.tsx pagination state:**
```typescript
const [closedLimit, setClosedLimit] = useState(20);
const roomsData = useQuery(api.warRoom.listRooms, { closedLimit }) ?? { active: [], closed: [], hasMore: false };
const activeRooms = roomsData.active;
const closedRooms = roomsData.closed;
const hasMore = roomsData.hasMore;

// "Show older rooms" handler
const handleShowMore = () => setClosedLimit(prev => prev + 20);
```

**Note on idle rooms:** The current schema allows status `"active" | "idle" | "closed"`. The bounded query above only bounds `"closed"` status. "idle" rooms are not currently in the `by_status` index path for the closed section. Clarify with planner: treat "idle" as closed (add second query) or treat it as active. Lean toward treating non-"active" as closed in the listing.

### Pattern 6: ROOM-01 Identity Resolution

```typescript
// In WarRoom.tsx — identity lookup utility
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
  // D-05: unknown participant — deterministic generated avatar
  return {
    profileId: pid,
    name: "Agent #" + pid.slice(-4),
    avatar: { name: pid },  // AgentAvatar.getColor(pid) → deterministic brand color
    roleBadge: "Agent",
    isSpeaking: speakingAgents.has(pid),
  };
}
```

**`agentColor` for transcript:** The `TranscriptChunk.agentColor` field (currently hardcoded `undefined` at `WarRoom.tsx:63`) can be resolved from the same identity lookup. The `agentColor` value should be the agent's `avatarData?.color` (or the `getColor(pid)` hash for unknowns). Note: `getColor` is not exported from `AgentAvatar.tsx` — it is a file-private function. To use it for `agentColor`, either (a) export it, or (b) re-implement the same hash inline in `WarRoom.tsx`. Option (a) is cleaner.

### Anti-Patterns to Avoid

- **Creating a `new Room()` in render body:** The Room instance is stateful. Create in a ref (`useRef`) or inside the `join` callback, never directly in the component body or as a plain variable. Otherwise React strict mode double-invoke creates two rooms.
- **Not cleaning up audio elements on disconnect:** `track.attach()` creates `<audio>` DOM nodes. Track them and call `track.detach()` or remove the elements in the disconnected handler. Leaking audio elements causes the agent's voice to continue playing after leaving.
- **Calling `room.connect()` twice:** If the operator clicks "Join" twice before the first connect resolves, you get two Room instances. Gate the join with a `connectionState !== 'disconnected'` check.
- **Using `by_room` index for seq-ordered reads:** The existing `by_room: ["roomId","timestamp"]` index orders by timestamp, not seq. Once seq is added, `getRoomEvents` should switch to `by_room_seq` for ordering. Keep `by_room` for backward compatibility or migrate.
- **Appending live WS chunks without dedup:** If a `transcript.chunk` WS event arrives AND the same event is persisted to Convex, both could appear in the transcript. The live chunk's `id` is `${timestamp}-${speakerId}`. The persisted event `id` is the Convex `_id`. They don't collide, so the same utterance won't appear twice — but be aware that on room re-select, `liveChunks` is cleared (`setLiveChunks([])` on selectedRoomId change at WarRoom.tsx:44), so persisted events (from `getRoomEvents`) are the source of truth for reload.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser LiveKit room connection | Custom WebRTC signaling | `livekit-client` `Room.connect()` | LiveKit's protocol is proprietary; hand-rolled WebRTC won't connect to a LiveKit server |
| Audio track subscription | Manual WebRTC `RTCPeerConnection` track handling | `RoomEvent.TrackSubscribed` + `track.attach()` | The SDK handles codec negotiation, simulcast, adaptive bitrate, and `<audio>` element creation |
| Token JWT signing | Custom HMAC JWT | `livekit_api.AccessToken` (already in astridr-repo) | LiveKit tokens require specific claim structure; `generate_participant_token()` already exists |
| Monotonic seq without races | Application-level distributed counter | Convex mutation serializable transaction (OCC) | Convex's OCC guarantees the read-max-then-insert pattern is race-free without explicit locks |
| Connection state machine | Custom WebSocket state tracking | `Room.connectionState` + `RoomEvent.ConnectionStateChanged` | The SDK already manages Connecting/Connected/Reconnecting/Failed with retry logic |

**Key insight:** The LiveKit JS SDK is the only browser-side way to join a LiveKit room. Any alternative (raw WebRTC, custom WebSocket) would require reverse-engineering LiveKit's signaling protocol. Don't attempt it.

---

## Common Pitfalls

### Pitfall 1: Room Lifecycle Leak on Room Change

**What goes wrong:** When the operator is joined to Room A and selects Room B, the existing `useEffect` on `selectedRoomId` sets `setIsJoined(false)` — but with the real LiveKit integration, this doesn't disconnect the LiveKit `Room` instance. Agent audio from Room A continues to play.

**Why it happens:** `isJoined` is a React state flag, not the Room connection itself. Setting it to false doesn't call `room.disconnect()`.

**How to avoid:** The `useWarRoomVoice` hook must call `room.disconnect()` as part of the `leave()` action AND in its cleanup effect when `selectedRoomId` changes. The existing reset useEffect at `WarRoom.tsx:43–47` must trigger `leave()` if currently joined.

**Warning signs:** Audio from a previous room still audible after selecting a new room.

### Pitfall 2: Hardcoded `LIVEKIT_PUBLIC_URL` Default

**What goes wrong:** The astridr-repo dispatcher defaults to `ws://localhost:7880` for `LIVEKIT_PUBLIC_URL`. In production (Docker Compose), the LiveKit server may be on a different host. The token endpoint D-02 should use the same env var.

**Why it happens:** `os.environ.get("LIVEKIT_PUBLIC_URL", "ws://localhost:7880")` was designed for local dev. The browser cannot reach the internal Docker hostname.

**How to avoid:** The D-02 endpoint already mirrors `dispatcher.py`'s pattern — same env var, same default. Verify that `LIVEKIT_PUBLIC_URL` is set correctly in production Docker Compose. The CodePulse frontend uses whatever URL the endpoint returns; it does not need its own LiveKit URL env var.

**Warning signs:** `room.connect()` times out or returns network error in production.

### Pitfall 3: `os` Not Imported in `war_room_routes.py`

**What goes wrong:** The D-02 route body calls `os.environ.get(...)`. Current `war_room_routes.py` does not import `os` (confirmed: it imports `uuid`, `Any`, `structlog`, `APIRouter`, `HTTPException`, `BaseModel`).

**Why it happens:** `os` is only needed for the new route.

**How to avoid:** Add `import os` at the top of `war_room_routes.py` when adding the token endpoint.

### Pitfall 4: `idle` Rooms Missing from Bounded Listing

**What goes wrong:** The `warRooms.status` field allows `"active" | "idle" | "closed"`. The bounded listing pattern only queries `"active"` and `"closed"`. Rooms with `status="idle"` would appear in neither section.

**Why it happens:** The listing pattern was designed for the two-state mental model in D-08 ("all active + last N closed").

**How to avoid:** Decide how to handle `"idle"` status in the listing. Recommended: treat `"idle"` as a sub-state of closed for listing purposes (include in the closed section, also bounded). Alternatively, query active as `status !== "closed"` (two statuses). The planner must decide which approach.

### Pitfall 5: `seq` Field Missing on Old Records

**What goes wrong:** After the schema change adds `seq: v.number()`, existing `warRoomEvents` rows have no `seq` field. Queries using `by_room_seq` index will not return them; ordering breaks for historical rooms.

**Why it happens:** Convex schema changes are additive but existing documents retain their old shape.

**How to avoid:** Make `seq` optional in the schema (`v.optional(v.number())`) and handle null/missing seq in the transcript merge (treat missing seq as -1 or sort missing-seq events before seq=0). Alternatively, run a one-time backfill migration. For this phase, `v.optional(v.number())` is the lower-risk approach since Phase 90 is about live rooms going forward, not backfilling history. The planner should include a Wave 0 decision on whether to backfill.

### Pitfall 6: Deep-Link Race Condition

**What goes wrong:** `/war-room/abc123` loads, `useParams()` yields `roomId="abc123"`, but `rooms` is still `[]` (Convex hasn't resolved yet). The `useEffect` that auto-selects the room fires but finds nothing to select.

**Why it happens:** `useQuery` returns `undefined` while loading, defaulting to `[]` in the component. The effect fires too early.

**How to avoid:** The auto-select effect should depend on `rooms.length > 0` and only fire when rooms have loaded:
```typescript
useEffect(() => {
  if (roomId && rooms.length > 0 && !selectedRoomId) {
    setSelectedRoomId(roomId);
  }
}, [roomId, rooms.length, selectedRoomId]);
```

---

## Code Examples

### D-02 Token Fetch from CodePulse

```typescript
// Source: authHeaders() pattern from src/lib/astridrApi.ts + dispatcher.py return shape
import { authHeaders, astridrApiBase } from "@/lib/astridrApi";

async function fetchJoinToken(roomName: string): Promise<{ token: string; url: string }> {
  const res = await fetch(
    `${astridrApiBase()}/api/war-room/${encodeURIComponent(roomName)}/token`,
    {
      method: "POST",
      headers: authHeaders(),  // adds Authorization: Bearer + Content-Type
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

### `getRoomEvents` Updated to Use Seq Ordering

```typescript
// convex/warRoom.ts — updated getRoomEvents
export const getRoomEvents = query({
  args: { roomId: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, { roomId, limit }) => {
    return await ctx.db.query("warRoomEvents")
      .withIndex("by_room_seq", (q) => q.eq("roomId", roomId))  // seq-ordered
      .order("asc")
      .take(limit ?? 500);
  },
});
```

### Transcript Merge with Seq Dedup

```typescript
// WarRoom.tsx — updated transcript merge
const transcriptChunks: TranscriptChunk[] = [
  ...roomEvents
    .filter((e) => e.eventType === "transcript.chunk")
    .map((e) => ({
      id: e._id,
      speaker: (e as Record<string, unknown>).speakerName as string ?? "Unknown",
      speakerId: (e as Record<string, unknown>).speakerId as string | undefined,
      text: (e as Record<string, unknown>).text as string ?? "",
      timestamp: e.timestamp,
      seq: e.seq,          // for dedup
      isUser: (e as Record<string, unknown>).speakerId === "user",
      agentColor: resolveAgentColor((e as Record<string, unknown>).speakerId as string, agents),
    })),
  // Only include live chunks that don't already exist as persisted events.
  // Live chunks have no seq; they're appended after all persisted events.
  ...liveChunks.filter(lc =>
    !roomEvents.some(e => e.timestamp === lc.timestamp && (e as any).speakerId === lc.speakerId)
  ),
];
```

### `/war-room/:roomId` Route Addition

```typescript
// src/App.tsx — add alongside the existing /war-room route (line 118)
<Route path="/war-room" element={<Suspense fallback={<div ...>Loading War Room...</div>}><WarRoom /></Suspense>} />
<Route path="/war-room/:roomId" element={<Suspense fallback={<div ...>Loading War Room...</div>}><WarRoom /></Suspense>} />
```

### Deep-Link Auto-Select in `WarRoom.tsx`

```typescript
// WarRoom.tsx — add useParams import + auto-select effect
import { useParams } from "react-router-dom";

// inside WarRoom():
const { roomId: deepLinkRoomId } = useParams<{ roomId?: string }>();

// Auto-select room from deep-link (fires once rooms load)
useEffect(() => {
  if (deepLinkRoomId && rooms.length > 0 && !selectedRoomId) {
    setSelectedRoomId(deepLinkRoomId);
  }
}, [deepLinkRoomId, rooms.length, selectedRoomId]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `setIsJoined(true)` as cosmetic flag | Real LiveKit Room.connect() | Phase 90 | Operator actually hears agents and can speak |
| `agentColor: undefined` in live transcript chunks | Resolved from `useRosterAgents()` or hash | Phase 90 | Transcript bubbles show agent colors |
| Unbounded `.collect()` on warRooms | Bounded `take(N)` with `hasMore` | Phase 90 | Avoids full table scan as room history grows |
| No `seq` field → timestamp-ordered transcript | Monotonic `seq` → deterministic transcript | Phase 90 | Concurrent ingest no longer renders out of order |
| Only `/war-room` route | `/war-room` + `/war-room/:roomId` | Phase 90 | Room sessions can be bookmarked and shared |

**Deprecated/outdated in this phase:**
- `WarRoom.tsx` `handleJoin` returning `setIsJoined(true)`: replaced by async LiveKit connect flow
- `warRoom.ts:listRooms` returning `[]` (unbounded collect): replaced by bounded structured response
- `warRoomEvents.by_room` as the primary ordering index: supplemented by `by_room_seq`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `livekit-client` package is the official LiveKit JS SDK from the livekit org — confirmed via npm registry source URL `git+ssh://git@github.com/livekit/client-sdk-js.git` and GitHub homepage, but slopcheck was unavailable | Package Legitimacy Audit | Low — manual signals are very strong (Apache-2.0, 5+ yr history, official org); slopcheck confirmation would be belt-and-suspenders |
| A2 | War room participants in `warRooms.participantIds` use the same string values as `useRosterAgents()` agent `.id` or `.name` fields | ROOM-01 Code Example | If the `participantId` format differs (e.g., LiveKit identity vs agent registry ID), the lookup `a.id === pid` will always miss and all participants will render as unknown. Needs cross-repo verification. |
| A3 | `"idle"` rooms are rare and acceptable to omit from the bounded listing | Pitfall 4 | If "idle" is a common status, those rooms would be invisible in the list. The planner should decide explicitly. |
| A4 | `LIVEKIT_PUBLIC_URL` is correctly configured in the production Docker Compose for astridr-repo | Pitfall 2 | If not set, defaults to `ws://localhost:7880` which works in dev but fails in production |
| A5 | `os` is not currently imported in `war_room_routes.py` | Pitfall 3 | Low risk — easy to confirm on read |
| A6 | `AgentAvatar.getColor()` is a file-private function; it needs to be exported to use in `WarRoom.tsx` for `agentColor` | Pattern 6 | If it remains private, the planner must either re-implement the hash inline or move the utility to a shared module |

---

## Open Questions (RESOLVED)

1. **`participantId` format in `warRooms`** — **RESOLVED (planning): assume match; runtime-confirm in Plan 08.**
   - What we know: `warRooms.participantIds` is `string[]`; `useRosterAgents()` agents have `.id` (from API) and `.name`.
   - What's unclear: Are the `participantIds` values the same strings as agent `.id` (e.g., `"astridr"`, `"hervor"`) or LiveKit-specific identities? In `dispatcher.py`, the `user_identity` passed to `generate_participant_token` is `"codepulse-user"`, not a roster ID. Agent identities in LiveKit are the `agent_name` values (`"astridr"`, `"hervor"`, etc.) which do match the roster.
   - **Resolution:** Assume match on `.id` / `.name` since agent_name == roster key; the D-05 fallback ("Agent #xxxx") handles any mismatch gracefully. **Residual risk (Assumption A2):** if `participantIds` are LiveKit-specific identities that don't match roster `.id`/`.name`, ROOM-01 success criterion 1 degrades to deterministic-but-unnamed cards. This is explicitly confirmed at runtime in **Plan 90-08, Task 1, manual check step 2** (operator confirms at least one card shows a real roster name, not "Agent #xxxx").

2. **`idle` room status in listing** — **RESOLVED: treat `idle` as closed.**
   - Schema allows `"active" | "idle" | "closed"`. D-08 says "all active + last N closed."
   - **Resolution:** Treat `"idle"` as closed for Phase 90 — show in the bounded closed section. Implemented in Plan 90-03 Task 1 (queries both `"closed"` and `"idle"` via `by_status`).

3. **Whether existing `warRoomEvents` rows need seq backfill** — **RESOLVED: optional field, no backfill.**
   - Existing rows have no `seq`. Using `seq: v.optional(v.number())` lets them exist; they sort before seq=0 events.
   - **Resolution:** Make `seq` optional (Plan 90-01 Task 3), treat null seq as `seq = -1` for sorting, skip backfill for Phase 90. Historical transcripts still display.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `livekit-client` npm package | ROOM-03 browser join | ✗ (not in package.json) | — | None — must install |
| `livekit-api` Python (astridr-repo) | D-02 token endpoint | ✓ | 1.1.0 | — |
| LiveKit server (`LIVEKIT_PUBLIC_URL`) | ROOM-03 `room.connect()` | Unknown at research time | — | Defaults to `ws://localhost:7880` in dev |
| `VITE_ASTRIDR_API_URL` | D-02 fetch | ✓ (already in use) | — | Defaults to `""` |
| `VITE_ASTRIDR_API_KEY` | D-02 `authHeaders()` | ✓ (already in use) | — | — |

**Missing dependencies with no fallback:**
- `livekit-client` (npm): install step `npm install livekit-client` required in Wave 0.

**Missing dependencies with fallback:**
- LiveKit server URL: defaults to `ws://localhost:7880`; production requires `LIVEKIT_PUBLIC_URL` set correctly.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + jsdom |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/hooks/useWarRoomVoice.test.ts convex/warRoom.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROOM-01 | Unknown participant renders "Agent #xxxx" name + deterministic avatar | unit | `npx vitest run src/components/AgentVoiceCard.test.tsx` | ❌ Wave 0 |
| ROOM-01 | Known participant renders agent.name + agent.avatarData | unit | `npx vitest run src/components/AgentVoiceCard.test.tsx` | ❌ Wave 0 |
| ROOM-02 | `listRooms` returns `{ active, closed, hasMore }` with bounded closed | unit | `npx vitest run convex/warRoom.test.ts` | ❌ Wave 0 |
| ROOM-02 | `hasMore: true` when closed rooms exceed limit | unit | `npx vitest run convex/warRoom.test.ts` | ❌ Wave 0 |
| ROOM-03 | `useWarRoomVoice.join()` calls token endpoint then room.connect | unit | `npx vitest run src/hooks/useWarRoomVoice.test.ts` | ❌ Wave 0 |
| ROOM-03 | Join muted: mic not enabled on connect | unit | `npx vitest run src/hooks/useWarRoomVoice.test.ts` | ❌ Wave 0 |
| ROOM-03 | `toggleMute()` calls setMicrophoneEnabled | unit | `npx vitest run src/hooks/useWarRoomVoice.test.ts` | ❌ Wave 0 |
| ROOM-04 | `insertWarRoomEvent` assigns seq = max+1 | unit | `npx vitest run convex/v6Mutations.test.ts` | ❌ Wave 0 |
| ROOM-04 | Two concurrent insertions produce unique seq values | unit | `npx vitest run convex/v6Mutations.test.ts` | ❌ Wave 0 |
| ROOM-04 | `/war-room/:roomId` auto-selects the correct room | unit (React Testing Library) | `npx vitest run src/pages/WarRoom.test.tsx` | ❌ Wave 0 |
| ROOM-04 | Closed-room deep-link shows "Room Ended" banner, Join disabled | unit | `npx vitest run src/pages/WarRoom.test.tsx` | ❌ Wave 0 |

**Mock strategy for `livekit-client`:** The existing test setup at `src/test/setup.ts` already mocks heavy externals (Three.js, etc.). Add `livekit-client` to the mock list, or create a `__mocks__/livekit-client.ts` that exports stub `Room`, `RoomEvent`, `Track`, `ConnectionState`. This keeps tests fast and avoids WebRTC APIs in jsdom.

### Sampling Rate

- **Per task commit:** Quick run on the affected module's test file
- **Per wave merge:** `npm test` full suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/hooks/useWarRoomVoice.test.ts` — covers ROOM-03 hook behavior
- [ ] `convex/warRoom.test.ts` — covers ROOM-02 bounded listing
- [ ] `convex/v6Mutations.test.ts` (or add to existing) — covers ROOM-04 seq assignment
- [ ] `src/pages/WarRoom.test.tsx` — covers ROOM-04 deep-link + closed-room state
- [ ] `src/components/AgentVoiceCard.test.tsx` — covers ROOM-01 identity resolution display
- [ ] `src/__mocks__/livekit-client.ts` — shared mock for all War Room tests

---

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | D-02 token endpoint is behind the existing Bearer auth middleware (`web.py:677–694`); `VITE_ASTRIDR_API_KEY` must be set for the CodePulse fetch to authenticate |
| V3 Session Management | Yes | LiveKit tokens are room-scoped, 3600s TTL, via `generate_participant_token()` with `room_join + can_publish + can_subscribe` only (no `room_admin` or `room_create` — T-70-08 is already enforced) |
| V4 Access Control | Yes | Token is scoped to a specific room name (`room=room_name` in `VideoGrants`) — prevents operator from joining a different room with the same token |
| V5 Input Validation | Yes | `room_name` path param in D-02 endpoint must be validated before passing to `generate_participant_token`. Recommend: reject names containing `..`, `/`, or non-alphanumeric-hyphen characters to prevent injection |
| V6 Cryptography | No direct exposure | LiveKit tokens use `livekit_api.AccessToken` — don't hand-roll JWT; `LIVEKIT_API_SECRET` never leaves the server |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token endpoint called with arbitrary `room_name` to join any LiveKit room | Elevation of Privilege | Token is only valid for the named room; LiveKit server enforces room-scoped grant. Still: validate `room_name` format in D-02 to reject path traversal attempts |
| Operator browser exposes LiveKit token in DevTools | Information Disclosure | Tokens are 1h TTL and room-scoped; risk is bounded. Don't log tokens. |
| Accidental hot mic after join | Spoofing / unintended broadcast | D-03: join with mic disabled (`setMicrophoneEnabled` not called on connect). 5-second amber warning after join per UI-SPEC Surface B |
| `livekit-client` supply-chain (very new 2.20.0) | Tampering | Pin to `livekit-client@2.20.0` in package.json; run `npm audit` in Wave 0; the livekit org is well-established |

---

## Sources

### Primary (HIGH confidence)

- `C:\Users\mandr\codepulse\src\pages\WarRoom.tsx` — confirmed hardcoded props at lines 190–199; cosmetic join at lines 112–113; transcript merge at lines 92–105; `agentColor: undefined` at line 63
- `C:\Users\mandr\codepulse\convex\warRoom.ts` — confirmed unbounded `.collect()` at lines 7–9; `getRoomEvents` at lines 13–21
- `C:\Users\mandr\codepulse\convex\warRoomIngest.ts` — confirmed no `seq` in `insertWarRoomEvent` calls; `/war-room-ingest` and `/transcript-ingest` paths verified
- `C:\Users\mandr\codepulse\convex\schema.ts:1279–1299` — `warRooms` + `warRoomEvents` schema confirmed; `by_room: ["roomId","timestamp"]` index exists; no `seq` field
- `C:\Users\mandr\codepulse\convex\schema.ts:1541–1549` — Forge `forgeLogChunks.seq` precedent (`v.number()`, `by_host_job_seq` index)
- `C:\Users\mandr\codepulse\convex\forge.ts:623–641` — `appendLogChunk` mutation: OCC-safe seq computation pattern via `by_host_job_seq` index
- `C:\Users\mandr\codepulse\src\hooks\useRosterAgents.ts` — confirmed `{id, name, tier, avatarData?}` shape; agent lookup data available
- `C:\Users\mandr\codepulse\src\components\AgentAvatar.tsx:33–39` — `getColor()` function: deterministic color from name hash; 8 brand colors; file-private
- `C:\Users\mandr\codepulse\src\components\VoiceControlBar.tsx` — current props + mute toggle pattern
- `C:\Users\mandr\codepulse\src\components\TranscriptPanel.tsx` — `live` prop, `TranscriptChunk` type with `agentColor?: string`
- `C:\Users\mandr\codepulse\src\App.tsx:118` — confirmed only `/war-room` route exists; no `/war-room/:roomId`
- `C:\Users\mandr\codepulse\src\lib\astridrApi.ts:117–121` — `authHeaders()` function shape
- `C:\Users\mandr\astridr-repo\astridr\api\war_room_routes.py` — confirmed only POST (create) + DELETE (close) routes; no token endpoint
- `C:\Users\mandr\astridr-repo\astridr\channels\war_room\token.py` — `generate_participant_token()` grants `room_join + can_publish + can_subscribe`, TTL 3600s
- `C:\Users\mandr\astridr-repo\astridr\channels\war_room\dispatcher.py:119–125` — `create_war_room` return shape `{ token, url, room }`; `LIVEKIT_PUBLIC_URL` env var
- `C:\Users\mandr\astridr-repo\astridr\channels\web.py:675–694` — `auth_check` Bearer middleware: all `/api/*` routes require `Authorization: Bearer {api_key}`
- `C:\Users\mandr\astridr-repo\astridr\engine\bootstrap\wiring.py:234–247` — war_room_router is mounted on the web channel app; inherits auth middleware
- github.com/livekit/client-sdk-js — `RoomEvent` values (Connected, Disconnected, Reconnecting, Reconnected, ConnectionStateChanged); `ConnectionState` enum (Disconnected, Connecting, Connected, Reconnecting, SignalReconnecting); `Room.connect(url, token)`; `setMicrophoneEnabled()`; `track.attach()`
- npm registry — `livekit-client@2.20.0`, created 2021-01-24, Apache-2.0, source `github.com/livekit/client-sdk-js`

### Secondary (MEDIUM confidence)

- docs.livekit.io — `room.connect(url, token)` API shape; `setMicrophoneEnabled(true/false)` pattern; `RoomEvent.TrackSubscribed` + `track.attach()` for audio subscription (partial docs access — 404 on some pages)

### Tertiary (LOW confidence)

- None — all critical claims verified from live source files or official GitHub.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — livekit-client verified on npm registry + GitHub; all others already installed
- Architecture: HIGH — all patterns derived from reading live source files
- Pitfalls: HIGH — derived from reading actual code (`.collect()`, missing `os` import, no cleanup on room change, missing `seq`)
- astridr-repo auth: HIGH — `web.py` auth middleware read directly

**Research date:** 2026-06-26
**Valid until:** 2026-07-26 (30 days; `livekit-client` 2.x is stable but active; check for patch updates before install)
