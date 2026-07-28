# Phase 103: Brain-Swap Control Surface - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-27
**Phase:** 103-Brain-Swap Control Surface
**Areas discussed:** Backend gap (blocking), Swap-scope unit, Control placement, Global-swap ritual, Status + stub seam, Contract ownership

---

## Backend Gap (raised before gray areas — blocking)

Surfaced during codebase scout: astridr's brain-swap backend, which ROADMAP.md names as Phase 103's
dependency, does not exist. Evidence table in `103-CONTEXT.md` `<blocker_reframing>`.

| Option | Description | Selected |
|--------|-------------|----------|
| Contract-first, stub-backed | 103 stays as scoped; CodePulse locks the contract, builds against a stub, BSC-05 reframed to "contract published + verified live once 184.1 lands" | ✓ |
| Build astridr 184.1 first | Pause 103, register + build the astridr backend, return to a real gate | |
| Narrow 103 to read-only | Ship BSC-01 only; defer the swap itself | |
| Cross-repo single phase | Widen 103 to build both repos as one phase, executed from astridr-repo | |

**User's choice:** Contract-first, stub-backed
**Notes:** Accepts that the Phase-90 War Room lesson ("endpoint exists ≠ integration works") is
consciously deferred, not satisfied. BSC-05 is explicitly reworded in CONTEXT.md so the planner
cannot close it as originally written.

---

## Swap-Scope Unit

**Q1 — What does "per agent" bind to?**

| Option | Description | Selected |
|--------|-------------|----------|
| Persona / profile | `profileConfigs.profileId` + `modelPreferences`; the configurable unit CodePulse already syncs, with an existing `configChanges` audit trail | ✓ |
| Live agent run | `agents.agentId` — per-run read-only telemetry, ephemeral, no astridr seam to re-brain a running agent | |
| Chat session | astridr's `set_session_override` (1h TTL) — truly runtime-only, but "per agent" would then mean "per conversation" | |

**Q2 — Temporary swap, sticky default, or both?**

| Option | Description | Selected |
|--------|-------------|----------|
| Both — swap + pin | Session swap (1h TTL) plus a separately-pinned per-profile default; UI shows which is in force | ✓ |
| Sticky default only | One control, one meaning; loses the "try this for an hour" workflow | |
| Session swap only | Nothing persists; every restart silently reverts the engine | |

**Q3 — Who owns the persisted default?**

| Option | Description | Selected |
|--------|-------------|----------|
| Astridr owns it | Supabase persistence per design spec D4; CodePulse dispatches and reads back — one source of truth | ✓ |
| Convex-first, then dispatch | CodePulse's usual convention; instant optimistic UI but creates two stores that can diverge | |

**Q4 — Agentic toggle for CLI brains this phase?**

| Option | Description | Selected |
|--------|-------------|----------|
| Defer — text mode only | Ship CLI brains in text mode; the `--agentic` switch lands once the backend proves the text path | ✓ |
| Expose the per-brain switch | Design spec §7 item 2 puts it in v1, but it's a materially different execution mode to stub | |

**Notes:** D-03 deliberately overrides CodePulse's "Convex-first, then dispatch" convention —
worth flagging to the planner, since it reads as a deviation from house style until you see that
two stores would reproduce the exact stale-config divergence BSC-01 exists to kill.

---

## Control Placement

**Q1 — Where does the primary switcher live?**

| Option | Description | Selected |
|--------|-------------|----------|
| Chat composer pill + header badge | Design spec §7 items 1 + 3; puts the control where the consequence is felt | ✓ |
| Dedicated Brains panel | New page listing every reachable brain; adds a nav destination for something wanted inline | |
| Settings → LLM Providers tab | Lowest-friction build, but buries an on-the-fly control three clicks deep | |

**Q2 — How is the current engine surfaced per profile (BSC-01)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the existing rows in place | Replace the stale `p.model` at `Settings.tsx:663` with the live reactive engine + swap affordance | ✓ |
| New per-profile section elsewhere | Leaves the stale display on screen contradicting the new live one | |

**Q3 — How does the picker present API models vs subscription CLIs?**

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped: Subscription / API / Local | Design spec §7 item 2; color dot · name · billing chip · health dot · quota bar | ✓ |
| Flat searchable list | Faster to build, scales better on a large open registry, but loses the free-vs-metered read | |

**Q4 — Global scope: a place or a mode?**

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit scope toggle in the picker | One picker with This profile / All profiles, resetting to profile scope on every open | ✓ |
| Separate global control | Physically harder to fire by accident, but splits one concept across two places | |

**Notes:** Grounding for Q2 was found during scout — `src/pages/Settings.tsx:663` already renders
`{p.profileId} / {p.model}` from `agentProfiles.model`, a synced config field. That is a live
instance of the v9.0 VitalsRail active-profile trap BSC-01 names.

---

## Global-Swap Ritual

**Q1 — Form of the confirmation (BSC-03)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Modal listing what changes | Names every affected profile with current → new; friction is informational, and it previews what a revert undoes | ✓ |
| Type-to-confirm | Highest friction but arbitrary rather than informative; tedious when testing engines repeatedly | |
| Arm-then-fire | Two clicks are only marginally safer than one, and it doesn't say what changes | |

**Q2 — Is a global swap revertible?**

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot + one-click revert | Capture prior engines; offer Revert until the next swap supersedes it | ✓ |
| No revert — re-swap manually | The prior per-profile mix is lost and can't be restored from memory | |

**Q3 — What happens to pinned defaults?**

| Option | Description | Selected |
|--------|-------------|----------|
| Overwrite, but record what was pinned | Global means global; snapshot records pinned vs inherited so revert restores pin status too | ✓ |
| Skip pinned profiles | "Global" then quietly isn't global; produces a mixed state that's easy to misread | |
| Overwrite, no distinction | Least code, but revert can only restore engines, not pin status | |

**Q4 — Partial failure?**

| Option | Description | Selected |
|--------|-------------|----------|
| Honest partial result | Per-profile list: N switched / M failed with reasons; failed rows keep their real engine | ✓ |
| All-or-nothing rollback | Cleaner model, but the rollback can itself fail and produce a worse state | |

---

## Status + Stub Seam

**Q1 — Dispatch transport?**

| Option | Description | Selected |
|--------|-------------|----------|
| WS command via `useCommandDispatch` | `gateway.model.set`, mirroring `gateway.provider.set_enabled`; ack + toasts for free | ✓ |
| REST POST via `authHeaders()` | Easier to stub and curl-verify, but no ack channel | |
| REST for reads, WS for writes | Matches the design spec literally, at the cost of two surfaces to stub | |

**Q2 — Where does the resulting active engine come from (BSC-04)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Convex-reactive telemetry | Astridr emits → Convex → `useQuery`; the UI renders only what the backend reported | ✓ |
| WS ack carries the result | Fastest, but a point-in-time reply that goes stale and that nothing else in the app sees | |
| Poll after dispatch | Definitely server-truth, but adds a visible lag window showing a known-stale engine | |

**Q3 — In-flight treatment?**

| Option | Description | Selected |
|--------|-------------|----------|
| Pending overlay, old engine stays truth | `switching to X…` layered over the real engine; failure just drops the pending state | ✓ |
| Optimistic switch + rollback | The exact optimistic-then-wrong state BSC-04 forbids; Phase 100 precedent | |

**Q4 — How is the missing backend wired?**

| Option | Description | Selected |
|--------|-------------|----------|
| One adapter + env flag | Single module, one interface, stub/live impls behind a `VITE_` flag; going live is a flag flip | ✓ |
| Live path only, degrade honestly | No stub to remove later, but ships a surface nobody can exercise | |
| Convex-side stub registry | Most demoable, but builds a second persistence path and breaks "astridr owns the default" | |

**Notes:** Q3's rejected option is directly informed by Phase 100, where an optimistic
commandId-reconciled pending-state machine produced two Critical code-review findings.

---

## Contract Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| 103 ships a `CONTRACT.md` | Client contract as a real deliverable; BSC-05 becomes "contract published + stub conforms" | ✓ |
| Contract lives in the astridr spec | One canonical doc, but the artifact lands in a repo this phase isn't executing in | |
| Types only, no doc | Can't drift from code, but nothing readable hands over to whoever builds the astridr side | |

---

## Claude's Discretion

- Component decomposition of the picker.
- Naming of the adapter module, the `VITE_` flag, and the Convex table/field carrying the active engine.
- Visual treatment of the pending overlay, stub-data indicator, and billing/health/quota chips
  (subject to `/gsd-ui-phase 103`).
- Whether the brain-catalog **read** is REST or a WS event — only the write transport was fixed.

## Deferred Ideas

- Astridr Phase 184.1 itself (the blocking follow-on for live BSC-05).
- Live end-to-end brain-swap verification — the original BSC-05 wording.
- `--agentic` CLI mode (design spec D2 / §7 item 2).
- Voice / War Room brain-swap — astridr Phase 185, runtime-only, out of CodePulse scope.
- Fix the broken `claude-sdk` gateway adapter — design spec Follow-on Phase B.
- Expensive/unknown-model warn+confirm ritual and the CLI→API fallback notice — offered as further
  gray areas, not discussed; required by design spec §6.
- Header-badge behavior when profiles disagree on engine (mixed global state) — not discussed.
