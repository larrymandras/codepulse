---
phase: 90
plan: "01"
subsystem: war-room
tags: [livekit, convex-schema, supply-chain, seq-ordering]
dependency_graph:
  requires: []
  provides:
    - livekit-client@2.20.0 installed (exact pin)
    - warRoomEvents.seq field (optional number, backcompat)
    - warRoomEvents.by_room_seq index (live in Convex deployment)
    - Convex generated types regenerated
  affects:
    - convex/v6Mutations.ts (Plan 90-03: seq-computing insertWarRoomEvent)
    - convex/warRoom.ts (Plan 90-03: getRoomEvents switches to by_room_seq)
    - src/hooks/useWarRoomVoice.ts (Plan 90-04: consumes livekit-client)
    - src/__mocks__/livekit-client.ts (Plan 90-02: test mock setup)
tech_stack:
  added:
    - "livekit-client@2.20.0 (exact pin, supply-chain gate passed)"
  patterns:
    - "Convex optional field for additive schema migration (N3 / Pitfall 5 backcompat)"
    - "OCC-safe by_room_seq index for monotonic per-room sequence ordering"
key_files:
  modified:
    - path: package.json
      change: "Add livekit-client@2.20.0 (exact, no caret)"
    - path: package-lock.json
      change: "Lock file updated for livekit-client@2.20.0 + 12 transitive deps"
    - path: convex/schema.ts
      change: "warRoomEvents: add seq field + by_room_seq index"
  created: []
decisions:
  - "seq MUST be v.optional(v.number()) not v.number() — existing warRoomEvents rows have no seq (N3/Pitfall 5). Required field would reject existing data on Convex schema push."
  - "livekit-client@2.20.0 exact pin (supply-chain pin T-90-SC) — no caret/tilde range."
  - "npm audit: 17 pre-existing vulnerabilities; zero attributable to livekit-client."
  - "npx convex dev --once used (not codegen-only) so by_room_seq index is live in the deployment for Wave 2+ queries."
metrics:
  duration: "~6 minutes"
  completed: "2026-06-26T18:44:29Z"
  tasks_completed: 3
  files_changed: 3
---

# Phase 90 Plan 01: Foundation — livekit-client Install + warRoomEvents Schema Summary

**One-liner:** Pinned `livekit-client@2.20.0` behind a supply-chain legitimacy gate and added optional `seq` + `by_room_seq` index to `warRoomEvents` — both deployed live, tsc clean, phase foundation ready.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Supply-chain legitimacy gate (checkpoint:human-verify) | n/a — gate | npmjs.com evidence recorded; operator approved |
| 2 | Install pinned livekit-client@2.20.0 + audit | b3ebae7 | package.json, package-lock.json |
| 3 | Add warRoomEvents.seq + by_room_seq index, redeploy Convex types | 146fb24 | convex/schema.ts |

## Task 1: Supply-Chain Legitimacy Gate (Checkpoint Approved)

**Gate status:** Approved by operator prior to execution.

**Evidence recorded:**
- Publisher: `livekit` org on npmjs.com (official LiveKit organization)
- License: Apache-2.0
- Source repository: `github.com/livekit/client-sdk-js`
- Version 2.20.0 published 2026-06-24; continuous release history (2.19.0 → 2.19.1 → 2.19.2 → 2.20.0)
- Age: created 2021-01-24 (~5.5 years on npm); high weekly download count
- Research tag: `[ASSUMED]` in 90-RESEARCH.md (slopcheck unavailable at research time) — operator manual review satisfies the gate per T-90-SC mitigation plan

**Disposition:** Gate satisfied. Install authorized.

## Task 2: npm install livekit-client@2.20.0 --save-exact

**Verification passed:**
- `package.json` dependencies: `"livekit-client": "2.20.0"` (exact, no `^`/`~`)
- `npm ls livekit-client` → `livekit-client@2.20.0`
- 12 transitive packages added

**npm audit result (full capture):**
- 17 total vulnerabilities: 1 low, 6 moderate, 8 high, 2 critical
- **Zero (0) advisories attributable to livekit-client**
- All advisories are pre-existing packages: @babel/core, @clerk/clerk-react, @clerk/shared, brace-expansion, fast-uri, hono, ip-address, js-cookie, js-yaml, postcss, qs, react-router/react-router-dom, undici, vite, vitest
- Per acceptance criteria: no unaddressed HIGH/CRITICAL advisory names livekit-client — criterion satisfied
- Pre-existing vulnerabilities are out of scope for this plan (deviation boundary rule)

## Task 3: warRoomEvents.seq + by_room_seq Index

**Schema change applied (`convex/schema.ts` lines 1290-1303):**
```typescript
warRoomEvents: defineTable({
  // ... existing fields unchanged ...
  seq: v.optional(v.number()),  // D-07: monotonic per room; optional for backcompat with existing rows
})
  .index("by_room", ["roomId", "timestamp"])        // kept — legacy reads / backcompat
  .index("by_room_seq", ["roomId", "seq"])           // ADDED — deterministic ordering (ROOM-04)
  .index("by_timestamp", ["timestamp"]),
```

**Deployment result:**
- `npx convex dev --once` against `tidy-whale-981.convex.cloud` (production)
- Convex confirmed: `[+] warRoomEvents.by_room_seq   roomId, seq, _creationTime`
- No schema-validation errors against existing data (optional field — additive change)

**Type verification:**
- `npx tsc --noEmit` passes clean (zero errors)
- `convex/_generated/dataModel.d.ts` uses `DataModelFromSchemaDefinition<typeof schema>` — types derive from schema.ts at compile time (Convex v1.x pattern); `seq` is reflected through the schema reference

## Deviations from Plan

None — plan executed exactly as written.

The 17 pre-existing npm audit vulnerabilities are noted but out of scope. They predate this plan and are not attributable to livekit-client.

## Known Stubs

None introduced in this plan. This plan is pure infrastructure (package install + schema migration).

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundary changes introduced in this plan. The schema addition (`seq: optional number`) is non-PII metadata. T-90-DATA disposition: accept (per threat model).

## Self-Check

- [x] `package.json` contains `"livekit-client": "2.20.0"` — confirmed exact pin
- [x] `convex/schema.ts` contains `by_room_seq` at line 1301 — confirmed
- [x] `convex/schema.ts` `seq` is `v.optional(v.number())` — confirmed
- [x] `by_room` and `by_timestamp` indexes preserved — confirmed
- [x] Commit `b3ebae7` exists — Task 2 (livekit install)
- [x] Commit `146fb24` exists — Task 3 (schema change)
- [x] `npx convex dev --once` confirmed `by_room_seq` live in deployment
- [x] `npx tsc --noEmit` passed clean

## Self-Check: PASSED
