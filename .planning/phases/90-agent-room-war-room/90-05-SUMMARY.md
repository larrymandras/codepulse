---
phase: "90"
plan: "05"
subsystem: warRoomIdentity
tags: [identity-resolution, pure-helpers, war-room, ROOM-01]
dependency_graph:
  requires: ["90-02"]
  provides: ["resolveParticipant", "resolveAgentColor"]
  affects: ["90-06", "90-07"]
tech_stack:
  added: []
  patterns: [deterministic-color-hash, pure-helper, structural-subtyping]
key_files:
  created: []
  modified:
    - src/lib/warRoomIdentity.ts
decisions:
  - "resolveAgentColor accepts `string | undefined` speakerId to handle system transcript events with no speaker"
  - "avatar fallback for known agents with no avatarData uses `{name: agent.name}` so getColor hash is stable"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-26"
  tasks_completed: 1
  files_modified: 1
---

# Phase 90 Plan 05: warRoomIdentity Pure Helper Summary

**One-liner:** Pure identity resolver maps LiveKit participantId → AgentVoiceCard props + transcript color with roster lookup, deterministic unknown fallback, and operator-self case.

## What Was Built

`src/lib/warRoomIdentity.ts` — two pure functions (no React, no hook calls):

- **`resolveParticipant(pid, agents, isOperatorSelf)`** — resolves a LiveKit participant id to `AgentVoiceCardProps`:
  - Operator-self: `name="You"`, `avatar={name:"You", color:"var(--primary)"}`, `roleBadge="Operator"`
  - Known (matched by id or name): `agent.name`, `agent.avatarData ?? {name:agent.name}`, `agent.tier ?? "Agent"`
  - Unknown (D-05): `name="Agent #" + pid.slice(-4)`, `avatar={name:pid}`, `roleBadge="Agent"` — raw pid never surfaces as display name

- **`resolveAgentColor(speakerId, agents)`** — resolves a speakerId to a hex color string for transcript chunk coloring:
  - Known agent: `agent.avatarData?.color ?? getColor(speakerId)`
  - Unknown/undefined: `getColor(speakerId ?? "")`

- **`getColor`** — re-exported from `AgentAvatar.tsx` for convenient access by callers.

## Verification

- `npx vitest run src/components/AgentVoiceCard.test.tsx` — **8/8 PASS** (was RED before this plan)
- `npx tsc --noEmit` — clean, no errors

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Implement resolveParticipant + resolveAgentColor | d23787c |

## Deviations from Plan

**1. [Rule 2 - Enhancement] Extended resolveAgentColor to accept `string | undefined`**
- **Found during:** Task 1 implementation
- **Issue:** Plan 90-PATTERNS.md shows `agentColor` derives from `speakerId` which can be undefined for system events (no speaker). The skeleton typed it as `string`, but callers passing `undefined` would hit a TypeScript error.
- **Fix:** Changed signature to `speakerId: string | undefined` and guarded with `speakerId ?? ""` for the fallback path.
- **Files modified:** `src/lib/warRoomIdentity.ts`
- **Commit:** d23787c

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| T-90-ID mitigated | src/lib/warRoomIdentity.ts | Unknown pid never renders as display name; maps to "Agent #<last4>" + deterministic avatar |

## Self-Check: PASSED

- [x] `src/lib/warRoomIdentity.ts` exists and implements both functions
- [x] Commit d23787c confirmed in git log
- [x] 8/8 tests GREEN
- [x] tsc --noEmit clean
