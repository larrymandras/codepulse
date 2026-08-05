---
phase: 106-consolidation-hardening
plan: 05
subsystem: infrastructure
tags: [tailscale, tailnet, vite, dev-server, reachability, manual-verification, operations]

# Dependency graph
requires:
  - phase: 106-consolidation-hardening
    provides: "106-CONTEXT.md D-10 — the tailnet name, the `:8443` Convex port recollection this plan had to confirm against the live machine, and the instruction that this is a Larry-run checklist rather than automation"
provides:
  - "106-TAILSCALE-CHECKLIST.md — a laptop-side onboarding + reachability checklist whose every endpoint was read off the running office PC (verbatim `tailscale status` / `serve status` / `funnel status` output plus 21 office-PC probes), and Larry's real per-step results from the 2026-08-05 run"
  - "D-10 SATISFIED — the laptop is on the tailnet and CodePulse renders LIVE data on it, proven by a Sessions figure matching the office PC's at the same moment, not by Tailscale reporting Connected"
  - "vite.config.ts server config that survives the tailnet path: `host: true` plus a single-host `allowedHosts` entry"
  - "Two recorded, unfixed defects with named fixes: Blocker B (VITE_ASTRIDR_WS_URL) and the Clerk secure-context finding"
affects: [106-08]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Two-machine differential as a live test: when a UI indicator is an ABSENCE rather than a message, assert it is PRESENT on the control machine and ABSENT on the machine under test, in the same minute against the same build — this controls for 'the element is missing because the header changed'"]

key-files:
  created:
    - .planning/phases/106-consolidation-hardening/106-TAILSCALE-CHECKLIST.md
  modified:
    - vite.config.ts

key-decisions:
  - "`server.allowedHosts` is a single explicit hostname (`lmofficenew.tail5bb6b3.ts.net`), never `true` and never a wildcard — `true` disables Vite's DNS-rebinding guard for every host, which is a real security regression in exchange for a convenience this plan does not need."
  - "Step 6 was re-specified live rather than marked FAIL: `ConnectionPopover` is dead code and there is no 'Disconnected' label anywhere in the header, so the only rendered consequence of the Ástríðr socket status is the `LAT: <n>ms` chip (`DashboardLayout.tsx:570`, gated at `:445`). The corrected form — chip PRESENT on the office PC, ABSENT on the laptop — is a strictly stronger test than the original."
  - "The Clerk secure-context failure was recorded and NOT fixed: publishing 5173 over HTTPS via `tailscale serve` is the named fix, but it is a config change outside this plan's checklist-and-record scope."
  - "Blocker B (`VITE_ASTRIDR_WS_URL=ws://127.0.0.1:8181`) was left in place — `.env` files are blocked for read and write by this project's env-file-guard hook, so the edit is Larry's; the checklist carries the exact before/after value and the restart requirement."

patterns-established:
  - "An operational checklist is evidence only once its `result:` lines are filled from a real run — the plan's own automated gate asserts zero blank `result:` lines before the frontmatter `status:` may leave `pending`."

requirements-completed: []

# Metrics
duration: spanned 2026-08-04 17:37 → 2026-08-05 14:12 (checklist authored, revised twice, then Larry's laptop run transcribed)
completed: 2026-08-05
---

# Phase 106 Plan 05: Laptop Tailscale Onboarding & Reachability Summary

**Larry's laptop is on the tailnet and CodePulse actually works on it — 7/7 checklist steps PASS, D-10 SATISFIED, proven by the dashboard rendering live data whose Sessions figure matched the office PC's at the same moment rather than by Tailscale reporting "Connected".**

## Accomplishments

**Task 1 — discover, don't assume.** Every endpoint in the checklist was read off the running office PC: verbatim `tailscale status`, `tailscale serve status` and `tailscale funnel status` output, a mapping of what is actually behind each published port, and 21 probes (P1-P21) establishing the healthy response for each from the office PC before the laptop ever tried it. CONTEXT.md D-10's `:8443` recollection was confirmed against live output rather than copied forward. No Tailscale-mutating command was run (no `serve` config change, no device approval, no cert issuance), and no bearer token, admin key or credential value appears anywhere in the file — only that a header was sent and the status it produced.

**Task 2 — the run.** Larry worked the checklist on the laptop on 2026-08-05. All 7 steps PASS. Step 5 is the load-bearing one and it is the reason the verdict is SATISFIED rather than "Tailscale connected": the CodePulse dashboard rendered on the laptop **with live data**, and the Hero Stats Bar Sessions figure **matched the office PC's** with both machines open simultaneously — a comparison that cannot pass on a blank or stale render.

**A revision pass that corrected itself in the open.** The file was first written 2026-08-04 17:37 and re-measured on 2026-08-05 before the run. Two of its three recorded blockers had been resolved in the interim, one probe result was no longer true, and one *expected value was wrong on its own terms* — it told Larry to compare the Dashboard's Sessions tile against `/health`'s `sessions` field, which are different numbers by construction (`/health` returns `sessions.listActive`, `.take(20)`-capped, so it reads `20` whenever there are ≥20 active sessions; the Hero Stats tile reads the uncapped `heroStats.summary.activeSessions`, then 279). That expectation would have produced a **false FAIL** on the single most important step. The 2026-08-04 findings that changed are called out explicitly in the file rather than silently overwritten, so the correction is auditable.

## Blockers found and cleared during the run

**Blocker A — Vite's DNS-rebinding guard (FIXED).** `host: true` (`bbfdae78`) made Vite listen on all interfaces, so the raw tailnet IP `http://100.93.234.6:5173/` returned 200 — but the MagicDNS *hostname* form returned **403 `Blocked request. This host ("lmofficenew.tail5bb6b3.ts.net") is not allowed.`** That is Vite refusing the `Host:` header, not a network fault; Vite's own error names the fix. `server.allowedHosts: ["lmofficenew.tail5bb6b3.ts.net"]` (`9a783f84`) — one explicit host, deliberately not `true`. Re-probed after the auto-restart: MagicDNS 200, and `localhost` / `127.0.0.1` / `100.93.234.6` all still 200, so no regression on the paths that already worked.

## Findings recorded, deliberately NOT fixed

**Blocker B — `VITE_ASTRIDR_WS_URL` is `ws://127.0.0.1:8181`.** `AstridrWSContext.tsx:231` appends `/ws/telemetry`, and `AstridrWSProvider` wraps the whole app (`App.tsx:99`), so a laptop tab resolves `127.0.0.1` to *the laptop*, finds nothing, and sits in a reconnect loop. This produced exactly the 7 console errors seen in step 7 and the absent `LAT:` chip in step 6. The Convex data path is unaffected, which is why steps 3-5 passed anyway. Claude cannot make this edit — `.env` files are blocked for read and write by this project's env-file-guard hook. The checklist carries the exact edit (`ws://lmofficenew.tail5bb6b3.ts.net:8181`), the requirement to restart the Vite dev server (Vite reads `.env` at start, not per-request), and the tradeoff note that the tailnet hostname also resolves from the office PC, so this is not a laptop-only setting.

**New finding — Clerk fails its cookie hashing on the laptop.** Verbatim from step 7's console: `Suffixed cookie failed due to Cannot read properties of undefined (reading 'digest') (secure-context: false, url: http://lmofficenew.tail5bb6b3.ts.net:5173/)`. This is **not** Blocker B and **not** a tailnet fault: `crypto.subtle` is only exposed in a secure context — HTTPS, or `localhost`, which browsers special-case — and the laptop reaches Vite over plain HTTP on a non-localhost hostname, so `crypto.subtle` is `undefined` and Clerk's cookie-suffix hashing throws. The office PC never hits it because `http://localhost:5173` is a secure context by specification. Auth worked well enough for the session (step 5 rendered live data behind `AuthGuard`), but the suffixed-cookie mechanism is silently degraded on any non-localhost HTTP origin — the class of defect that later presents as unexplained session or multi-tab behaviour rather than an obvious failure. Named fix: publish 5173 over HTTPS via `tailscale serve`; the tailnet already terminates TLS for Convex on 443 and 8443, so the capability exists and only 5173 is published as plain HTTP.

## Task Commits

| Commit | What |
|---|---|
| `51545b55` | Discover live tailnet endpoints and write the laptop reachability checklist (Task 1) |
| `bbfdae78` | `fix(106-05)`: explicitly bind the Vite dev server to all interfaces (`host: true`) |
| `9a783f84` | `fix(106-05)`: allow the tailnet MagicDNS host through Vite's rebinding guard (`allowedHosts`) |
| `f2e2c75c` | Make the WS-URL config bug (Blocker B) unambiguous in the checklist |
| `126b6679` | Record the laptop Tailscale run — D-10 SATISFIED, 7/7 pass (Task 2) |

## Files Created/Modified

**Created**
- `.planning/phases/106-consolidation-hardening/106-TAILSCALE-CHECKLIST.md` — discovered endpoints (verbatim command output + 21 probes), 7 laptop-side steps each with a concrete `expected:` and a filled `result:`, the Result table, 2 deviations, 1 new finding, and 5 troubleshooting entries.

**Modified**
- `vite.config.ts` — `server.host: true` and `server.allowedHosts: ["lmofficenew.tail5bb6b3.ts.net"]`, each with a comment explaining what was verified live and why the wide form was rejected.

## Deviations from Plan

1. **Step 6 named a UI element that does not exist.** As written it told Larry to read the Ástríðr connection status from `ConnectionPopover`. Found live when he could not locate the control: `ConnectionPopover` is dead code (`grep -rn "ConnectionPopover" src` returns only its own test file plus a comment mention at `DashboardLayout.tsx:407`, never imported into the rendered app), and there is no "Disconnected" label anywhere in the header — the indicator is an **absence**, not a message. Re-specified live as the two-machine differential described above and recorded against the corrected form.

2. **The plan did not anticipate Vite's rebinding guard.** Task 1 was scoped as read-only discovery, but the discovery itself proved the dev server was not reachable over MagicDNS. Two small source commits (`bbfdae78`, `9a783f84`) were made so the checklist would describe a path that actually works — a checklist whose step 5 is known-broken before it is handed over is not a checklist.

3. **One REQUIREMENTS.md clause corrected outside this plan's `files_modified`.** DEBT-03's marker asserted "the laptop Tailscale half of this requirement is plan 106-05's and **has not started**" — directly falsified by this run. Corrected in place per this repo's Stale Docs rule. The remaining DEBT-01..04 marker reconciliation is 106-08's, and was left alone.

## Issues Encountered

Nothing that blocked the plan. The 4x `[React Flow]: The parent container needs a width and a height` warnings observed on the laptop are layout warnings, not connection errors; step 7 is scored on which host connection errors name, so they do not affect the verdict, and whether they are laptop-viewport-specific was **not** established and is not claimed either way.

## User Setup Required

**Open, for Larry, both optional:**
1. Edit `C:\Users\mandr\codepulse\.env.local` by hand — `VITE_ASTRIDR_WS_URL=ws://127.0.0.1:8181` → `ws://lmofficenew.tail5bb6b3.ts.net:8181` — then restart the Vite dev server (the `\CodePulseUI` scheduled task supervises it). Clears Blocker B on the laptop; safe on the office PC, since the tailnet hostname resolves there too.
2. `tailscale serve` port 5173 over HTTPS to clear the Clerk secure-context degradation.

Neither is required for D-10, which is satisfied as recorded.

## Next Phase Readiness

D-10 is closed, which unblocks Wave 3. `106-08-PLAN.md` lists `106-05` in its `depends_on` and is now clear to run (it also needs a live Forge daemon and a browser session). DEBT-03 as a whole is **still not SATISFIED** — its bundle half remains above the 512,000-byte threshold per 106-04, honestly documented rather than silenced. That marker belongs to 106-08.

## Self-Check

- ✅ Every `result:` line in `## Steps` is filled — zero blank (the plan's own automated gate).
- ✅ Frontmatter `status: passed` reconciles with a Result table carrying one row per step, 7/7 PASS.
- ✅ Every URL in `## Steps` also appears in `## Discovered endpoints` — no URL introduced that was not observed on the live machine.
- ✅ Step 5's expected result names a specific always-populated surface (the Hero Stats Bar Sessions tile) with a cross-machine equality check, not the generic word "data".
- ✅ No credential value anywhere in the checklist — only that a header was sent and the resulting status.
- ✅ No command mutated Tailscale config, approved a device, or wrote to the self-hosted Convex instance.
