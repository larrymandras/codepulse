---
phase: 103
slug: brain-swap-control-surface
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-30
register_authored_at_plan_time: true
register_source: "13 of 18 PLAN.md files carry a parseable <threat_model> block (103-01..103-13); 103-14..103-18 are gap-closure plans that inherit the register rather than extending it"
mode: verify-mitigations
---

# Phase 103 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
>
> **Mode:** verification, not discovery. The register was authored at plan time, so this audit
> confirms each declared mitigation is present in the shipped implementation. It does NOT scan for
> new threats — with two exceptions recorded below, both of which surfaced from work done *after*
> the register was written and would be dishonest to omit.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → Ástríðr WS | Operator-issued swap commands (`swap.set`, `swap.catalogue`, `swap.get_state`) | Model ids, override state. Bearer subprotocol handshake gates the whole connection. |
| Ástríðr → CodePulse `/runtime-ingest` | Untrusted-shaped telemetry (`model_routing`) into Convex | Profile ids, model ids, routing mode |
| browser → Convex | Reactive reads of `activeEngineSnapshots`, `profileConfigs` | Profile ids, model ids — no credentials |
| CLI (admin key) → Convex | Deliberate operator maintenance (`pruneUnresolved`) | Deletes of unresolved telemetry rows |
| build env → shipped bundle | `VITE_BRAINS_STUB` decides whether the operator sees real or fabricated data | Stub-vs-live provenance |

---

## Threat Register

Verified against live source on 2026-07-30. "Comment vs code" was disambiguated programmatically
(comment lines stripped before counting) — the register below reports **code** facts, not prose
claims.

| Threat ID | Category | Component | Disposition | Mitigation — verified evidence | Status |
|---|---|---|---|---|---|
| T-103-01 | Tampering | `gateway.model.set` payload | mitigate | `validateGatewayModelSet` (`brainsApi.ts:76`) called on both dispatch paths (`:125`, `:166`) | closed |
| T-103-02 | Elevation of Privilege | command auth tier | mitigate | Contract §6 pins the non-admin tier; no admin verb invoked | closed |
| T-103-03 | Info Disclosure (wrong state) | stub build in prod | mitigate | `BRAINS_STUB_ACTIVE` (`brainsApi.ts:216`) is the sole source; **0** components read `VITE_BRAINS_STUB` independently | closed |
| T-103-04 | Spoofing | WS connection | accept | Transport-level bearer handshake; no new auth surface | closed |
| T-103-05 | Tampering | `model_routing` payload | mitigate | Dual snake/camelCase coalescing at the ingest edge — **narrowed 2026-07-30**, see T-103-55 | closed |
| T-103-06 | Denial of Service | `latestByProfile` unbounded read | mitigate | `.take(200)` over `by_timestamp`; **0** real `.collect()` calls in `activeEngine.ts` | closed |
| T-103-07 | Repudiation | who changed a profile's model | accept | `configChanges` audit row already written by `profiles.ts` | closed |
| T-103-08 | Denial of Service | live self-hosted Convex | mitigate | Additive schema push only; deploy 2026-07-30 confirmed `✔ No indexes are deleted by this push` | closed |
| T-103-09 | Denial of Service | `useActiveEngine` | mitigate | `?? []` / `?? {}` coalescing; hook can never return `undefined` | closed |
| T-103-10 | Info Disclosure (wrong state) | engine reading fallback | mitigate | No fallback to `modelPreferences` on the telemetry path; **live-re-verified** — confirm modal's current column still reads "Auto" while its pinned count is config-derived (UAT test 6) | closed |
| T-103-11 | Tampering | catalogue display strings | accept | React escapes text; **0** `dangerouslySetInnerHTML` in any brain surface | closed |
| T-103-12 | Tampering | unintended global swap | mitigate | D-09 confirm modal enumerates every affected profile; **0** mutating frames before explicit confirm (UAT tests 5, 9, 11) | closed |
| T-103-13 | Repudiation | who moved every profile's default | accept | `configChanges` audit trail | closed |
| T-103-14 | Info Disclosure (wrong state) | failed row shows attempted target | mitigate | Failure renders the real unchanged engine; **strengthened 2026-07-30** — see T-103-56 | closed |
| T-103-15 | Elevation of Privilege | command auth tier | mitigate | Non-admin tier per contract §6 | closed |
| T-103-16 | Info Disclosure (wrong state) | stub rows read as live | mitigate | STUB chip bound to `BRAINS_STUB_ACTIVE`; absent on the live global axis | closed |
| T-103-17 | Tampering | `gateway.model.set` payload | mitigate | Same validator seam as T-103-01 | closed |
| T-103-18 | Info Disclosure (wrong state) | optimistic pending | mitigate | D-15 base label is server-sourced; live-confirmed the badge never switched on a failed swap (UAT test 11) | closed |
| T-103-19 | Info Disclosure (wrong state) | stub data read as live | mitigate | As T-103-03/16 | closed |
| T-103-20 | Denial of Service | duplicate cmdk values | mitigate | `CommandItem value={entry.id}`; 331 live entries rendered without collision | closed |
| T-103-21 | Elevation of Privilege | scope confusion | mitigate | `nextScope = "profile"` on every open (`BrainPicker.tsx:275`); live-confirmed reset (UAT test 4) | closed |
| T-103-22 | Denial of Service | throwing `useQuery` dashboard-wide | mitigate | Coalesced hook + `SectionErrorBoundary` | closed |
| T-103-23 | Info Disclosure (wrong state) | single badge over disagreeing profiles | mitigate | "Mixed brains" + stacked dots | closed |
| T-103-24 | Info Disclosure (wrong state) | pending/stub reading as confirmed | mitigate | `isConfirmedLive` gate present (`BrainHeaderBadge.tsx:126`). ⚠ **This control was found DEFEATED in practice by upstream data and has been repaired — see "Mitigation defeated in practice" below.** | closed |
| T-103-25 | Spoofing | vocabulary collision with SwapBadge | mitigate | Distinct dot treatment, no `Brain` icon reuse | closed |
| T-103-26 | Info Disclosure (wrong state) | Settings per-profile row | mitigate | `p.model` config read deleted; live-confirmed rows read "Not reported" (UAT test 13) | closed |
| T-103-27 | Tampering | `brain.fallback` payload | mitigate | Guards a missing `fallback_model`; no half-formed toast | closed |
| T-103-28 | Denial of Service | engine query inside Settings | accept | Existing `SectionErrorBoundary name="Agent Profiles"` | closed |
| T-103-29 | Info Disclosure (wrong state) | pill vs SwapBadge disagreement | mitigate | Live-confirmed all surfaces agreed simultaneously (UAT test 7) | closed |
| T-103-30 | Repudiation | verification claim scope | mitigate | Honesty boundary stated in the E2E header and VALIDATION | closed |
| T-103-31 (103-08) | Denial of Service | live global swap on a running stack | mitigate | Every UAT swap reverted; end state verified clean (no override in force) | closed |
| T-103-31 (103-09) | Info Disclosure | `swap.get_state` ack | accept | Ack carries only model id + voice name | closed |
| T-103-32 (103-08) | Info Disclosure (wrong state) | stub build reaching live verification | mitigate | UAT pre-flight confirmed no STUB chip | closed |
| T-103-32 (103-09) | Spoofing | `swap.state` payload fields | mitigate | `coerceOverrideString` coerces to `string \| null` | closed |
| T-103-33 | Tampering (stale state) | reconnect handling | mitigate | Snapshot effect keys on `status`, re-issues on every `connected` | closed |
| T-103-34 | Repudiation | global-vs-profile provenance | mitigate | "Global" chip + `(global)` in the aria-label; live-confirmed `"Active brain: Claude Sonnet 5 (global)"` | closed |
| T-103-35 | Elevation of Privilege | `recordRouting` public mutation | mitigate | `internalMutation` (`activeEngine.ts:79`); **0** real `api.activeEngine.recordRouting` references in code (the 2 textual hits are a docstring and a test assertion) | closed |
| T-103-36 | Spoofing | forged "server-confirmed" snapshot row | mitigate | No client-callable write path exists | closed |
| T-103-37 | Tampering | append-only table integrity | mitigate | `recordRouting` stays insert-only. ⚠ **A delete path was added this session — registered as T-103-57 below rather than silently folded in.** | closed |
| T-103-38 | Info Disclosure | `latestByProfile` public query | accept | Read-only, bounded, returns profile/model ids only | closed |
| T-103-39 | Elevation of Privilege | sibling public mutations | mitigate | Re-audited 2026-07-30: **0** public `mutation(` declarations, 2 `internalMutation`, 1 `query` | closed |
| T-103-40 | Tampering | keyboard bypassing cost-confirm | mitigate | Single `handleActivate` for both input modes | closed |
| T-103-41 | Tampering | keyboard bypassing global confirm | mitigate | Live-verified: keyboard-only selection dispatched 0 frames pre-confirm (UAT test 5) | closed |
| T-103-42 | Tampering (race) | stale `fetchCatalogue` response | mitigate | Generation-counter guard on both branches; live-confirmed scope re-fetch 0→331 (UAT test 4) | closed |
| T-103-43 | Info Disclosure | catalogue names in the picker | accept | Public product identifiers only | closed |
| T-103-44 | Denial of Service | held-down Enter re-firing | accept | Idempotent activation | closed |
| T-103-45 | Repudiation | modal reporting the wrong axis | mitigate | Reports the awaited `swap.set` ack; no `gateway.model.set` fan-out for global scope | closed |
| T-103-46 | Spoofing | ack-only "switched" claim | mitigate | Success rendered only after the `swap.state` readback matches; live-confirmed "Switched to Claude Sonnet 5." followed a real readback (UAT test 7) | closed |
| T-103-47 | Tampering | revert firing with no visible surface | mitigate | CR-03 mount split **plus** 103-18's app-level hoist; live-verified across a route change (UAT test 9). Further hardened by T-103-58 | closed |
| T-103-48 | Denial of Service | double-firing swap/revert | mitigate | `isBusy` gates the footer button (`:584`) and now clears in a `finally` on both legs (`:412`, `:449`) | closed |
| T-103-49 | Info Disclosure | server error text rendered verbatim | accept | Originates from Ástríðr's own validator; no secrets in the string | closed |
| T-103-50 | Tampering | process left on an unintended engine | mitigate | Every UAT swap reverted; final state verified `('No brain reported', '-')` | closed |
| T-103-51 | Repudiation | recording an unmade observation | mitigate | `103-UAT.md` records verbatim results per test, including the tests I could not run and why | closed |
| T-103-52 | Tampering | stub-on run recorded as live | mitigate | UAT ran with the stub OFF; no STUB chip present | closed |
| T-103-53 | Info Disclosure | live payloads in planning artifacts | mitigate | **Re-checked 2026-07-30: 0 admin-key strings, 0 bearer/API-key literals anywhere in `.planning/`.** Recorded WS frames contain only model ids and random request UUIDs | closed |
| T-103-54 | Tampering | overwriting the failing checkpoint record | mitigate | Prior sections preserved; `103-VERIFICATION.md` marked `superseded_by` rather than rewritten | closed |
| T-103-SC | Tampering | npm/pip/cargo installs | accept | **Zero new runtime dependencies across all 18 plans and the post-UAT fix round** — re-confirmed 2026-07-30 | closed |

### Threats added after the plan-time register (2026-07-30)

These arose from the post-UAT fix round. The workflow's verify-only constraint says not to hunt for
new threats; it does not license concealing surfaces that this session's own commits introduced.

| Threat ID | Category | Component | Disposition | Mitigation — verified evidence | Status |
|---|---|---|---|---|---|
| T-103-55 | Tampering / Info Disclosure (wrong state) | `model_routing` sentinel coalescing | mitigate | The ingest used to coalesce missing `profileId`/`model` to the literal `"unknown"` and store it, manufacturing a reading from an absence. Guarded at both boundaries (`activeEngineFilters.ts`), deployed live 2026-07-30, and **proven**: a real swap now creates zero rows where it previously created one every time | closed |
| T-103-56 | Info Disclosure (wrong state) | failed-swap result header | mitigate | A FAILED swap still rendered "Profiles now governed by the global override:", contradicting its own outcome line. Now "Profiles unchanged — still on their prior engine:" (`025d7502`), covered by tests on both branches | closed |
| T-103-57 | Tampering | **NEW delete path on `activeEngineSnapshots`** | mitigate | `pruneUnresolved` (`activeEngine.ts:111`) is the first delete path on this append-only table, directly narrowing T-103-37's "no delete path" claim. Controls: `internalMutation` (not in the client-callable `api.` namespace), bounded `.take(500)` scan, **batch-capped** at min(limit, 200) per call per the self-hosted-Convex mass-delete rule, deletes only rows failing `isUnresolvedRouting`, and returns `moreRemaining` instead of looping. Requires a CLI admin key to invoke | closed |
| T-103-58 | Denial of Service / Repudiation | unbounded queued dispatch | mitigate | `sendCommand` queues with no timeout when the socket is down, so `await dispatch(...)` could hang forever, trapping the operator in a modal showing false progress. Bounded by `GLOBAL_SWAP_DISPATCH_TIMEOUT_MS` with `try/finally` (`fc9828ff`). **Residual risk accepted — see AR-03** | closed |
| T-103-59 | Info Disclosure | dashboard-wide `swap.catalogue` fetch | accept | `useGlobalModelNames` issues one `swap.catalogue` per connected transition from a dashboard-wide component. Read-only, returns public model identifiers already covered by T-103-43, and the picker already issues the same command on every open | closed |

### Mitigation defeated in practice (the audit's most important finding)

**T-103-24's control was present in code and still produced a dishonest UI.** `isConfirmedLive`
correctly gated the confirmed-live pulse on "server-confirmed, non-pending, non-stub" — but the
*upstream data* was a sentinel, so the badge lit a server-confirmed pulse next to the word
`"unknown"` presented as a real engine name.

The control was never wrong; its input was. A code-reading audit of T-103-24 alone would have passed
it, and did — the prior verification pass confirmed the gate exists. Only running the live stack
surfaced it. Recorded here because it is the transferable lesson of this phase: **verifying that a
mitigation exists is not the same as verifying it is effective.** Closed by T-103-55.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---|---|---|---|---|
| AR-01 | T-103-04, T-103-38, T-103-43, T-103-49, T-103-59 | Read-only surfaces exposing public model identifiers and server-authored error text; no credentials cross these boundaries. Transport auth already gates the WS connection | Larry (operator) | 2026-07-30 |
| AR-02 | T-103-07, T-103-13, T-103-28, T-103-44 | Pre-existing controls (`configChanges` audit rows, `SectionErrorBoundary`, idempotent activation) already cover these; this phase adds no new exposure | Larry (operator) | 2026-07-30 |
| AR-03 | T-103-58 (residual) | The unbounded queue in `AstridrWSContext.sendCommand` is bounded at the *call site*, not fixed at source. Fixing the shared queue would convert silent hangs into unhandled rejections in every other command panel that awaits it without a catch. **A queued global swap could therefore still fire on reconnect with no visible surface** — the same hazard class as WR-01, reached via the queue instead of an unmount. Out of Phase 103's scope; flagged for a follow-up that can touch every command panel at once | Larry (operator) | 2026-07-30 |
| AR-04 | Per-profile axis | `models.catalog`, real `gateway.model.set`, and per-profile telemetry ingest are deferred to astridr Phase 184.1. Confirmed live: all 93 rows in `activeEngineSnapshots` were unresolved sentinels, so this axis has never carried real data. Not a Phase 103 defect | Larry (operator) | 2026-07-30 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|---|---|---|---|---|
| 2026-07-30 | 59 (54 plan-time + 5 post-UAT) | 59 | 0 | Claude (inline audit, verify-mitigations mode) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [x] Post-register surfaces introduced by this session's own commits disclosed (T-103-55…59), not folded in silently
- [x] Secrets check: 0 admin keys, 0 bearer/API-key literals in `.planning/`
- [x] Supply chain: zero new runtime dependencies across the whole phase
