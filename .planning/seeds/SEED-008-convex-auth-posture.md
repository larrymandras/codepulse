---
id: SEED-008
status: dormant
planted: 2026-08-11
planted_during: v14.0 / mid-milestone audit (INT-03 class sweep)
trigger_when: a decision is needed on whether CodePulse requires sign-in, OR the Convex backend becomes reachable beyond the tailnet, OR a phase touches auth on Convex functions
scope: Medium
origin: "v14.0 audit INT-03 class sweep, 2026-08-11. Measured live: POST http://100.93.234.6:3210/api/mutation (TAILNET address, no credential) with {\"path\":\"galdr:recordUsage\"} returned ArgumentValidationError — the function executed its validator. Control {\"path\":\"galdr:definitelyNotReal9x7q2\"} returned 'Could not find public function', proving the probe discriminates. `docker ps` shows convex-backend published on 0.0.0.0:3210-3211, every interface. 13 of ~137 convex/*.ts modules reference ctx.auth."
paired_seed: none
---

# SEED-008: Convex auth posture — is the tailnet the boundary, or is Clerk?

## The finding

Every **public** Convex function is callable, with no credential, by anything that can route to
the host. Demonstrated over the tailnet address rather than loopback, with a control:

```
POST 100.93.234.6:3210/api/mutation  {"path":"galdr:recordUsage","args":{}}
  -> ArgumentValidationError: Object is missing the required field `slug`     [function RAN]

POST 100.93.234.6:3210/api/mutation  {"path":"galdr:definitelyNotReal9x7q2"}
  -> Could not find public function                                            [control]
```

The control is what makes the first line evidence rather than noise: a probe that returns an
argument error for a real function and a not-found for a fake one is discriminating correctly.

**This is a class, not an instance.** It surfaced while sweeping Phase 119's Loom mutations
(audit INT-03), but Galdr is not special — `13` of `~137` `convex/*.ts` modules reference
`ctx.auth` at all. The other ~124 expose their public mutations identically.

## Why the obvious fix is the wrong one

The reflex is to flip `galdr:createPrompt` / `recordUsage` to `internalMutation` like Loom's were.
It does not work here and would not help if it did:

1. `src/pages/Galdr.tsx:377-380` calls those mutations **from the UI**, so they must stay public.
   Repointing only `galdrHttp.ts:131,190` at an internal copy closes nothing — the public
   mutation remains, and the public mutation is the exposure.
2. Even done perfectly it would close 4 doors of ~124, and leave the Seiðr suite internally
   inconsistent for no gain.
3. Fail-closed `ctx.auth` cannot be applied app-wide today. Clerk is **optional and gracefully
   skipped** when `VITE_CLERK_PUBLISHABLE_KEY` is unset (repo CLAUDE.md), and `dev:noauth` —
   which the entire Playwright suite depends on — relies on that. Making Clerk mandatory is a
   product decision about whether CodePulse requires sign-in, not a hardening task.

## The decision this seed exists to force

**Which is the real auth boundary — the tailnet, or Clerk?** Today the codebase implies both and
enforces neither cleanly:

- The `/galdr` and `/loom` HTTP routes carry fail-closed bearer keys, which reads as "these writes
  are protected." They are not: the same writes are reachable unauthenticated through the public
  mutation surface. The keys gate the *documented CLI path*, not the write.
- Nothing states that the tailnet is the trust boundary, so a future editor cannot tell whether
  the unauthenticated surface is a deliberate posture or an oversight.

If the answer is **tailnet**: bind the container to `127.0.0.1` + the Tailscale IP instead of
`0.0.0.0` (one compose line, closes LAN/any-interface exposure for all ~124 modules at once), and
write the posture into CLAUDE.md's Self-Hosted Convex rules so the bearer keys stop implying a
protection they do not provide. This was the audit's recommendation and is the cheaper branch by a
wide margin.

If the answer is **Clerk**: that is a milestone-scale change — a shared `requireOperator(ctx)`
helper, a decision on what `dev:noauth` and the e2e suite do without an identity, and a sweep
across ~124 modules. Do not start it inside a debt phase.

## Reachability — what is and is not established (corrected 2026-08-11)

**The origin block's probe does NOT prove remote reachability, and the first write-up of this
finding over-claimed that it did.** That `curl` ran on the same host as the backend, against the
host's own Tailscale address. Windows routes traffic destined to a local IP through the loopback
path, where it does not traverse the inbound firewall filter. So the probe proves the socket binds
that interface and the app answers on it — it does **not** prove a remote device can reach it. Same
defect class as the 2026-08-10 presence-control rule: a probe that returns the same result whether
or not the property holds is not evidence.

Firewall state, measured:

| Fact | Value |
|---|---|
| Inbound default action | `NotConfigured` on all three profiles → Windows default **Block** |
| `Docker Desktop Backend` inbound allow rules | **Public profile only** (2 rules) |
| `Tailscale-Process` / `Tailscale-In` | Profile **Any** / **Domain,Private** |
| `Node.js JavaScript Runtime` | Public **and Private** — covers Vite, not the Docker-published port |
| Ethernet (LAN, `10.0.0.44`) network category | **Private** |
| Tailscale interface category | **Private** |

Reading: the only rule that could admit LAN traffic to a Docker-published port is scoped to
**Public**, while the LAN interface is **Private** — so LAN inbound to 3210 is most likely
**blocked** by the default-block. Tailnet inbound is most likely **allowed**, via the Any-profile
Tailscale rules, which is consistent with laptop browsing working today.

## RESOLVED 2026-08-11 — the LAN could reach it, and that half is now closed

**The firewall reading above was wrong.** It predicted LAN was already blocked. A laptop on the
same subnet, Tailscale off, measured:

```
http://10.0.0.44:5173/         -> 200   (control: the path is live)
http://10.0.0.44:3210/version  -> 200   (Convex backend)
http://10.0.0.44:6791/         -> 200   (Convex dashboard)
```

So any device on the home LAN could call every public Convex mutation with no credential. Three
probes attempted from the host itself were all inconclusive — loopback (own IP), a Docker container
on the bridge (returned 200, but through Docker's own NAT and allowance), and WSL (no usable
distro). **Only the off-host device settled it.** Record this: a firewall-rule *reading* is not a
reachability *result*, and this analysis was confidently wrong twice before a real probe ran.

**Fix applied the same day:** `convex-selfhost\restrict-convex-lan.ps1` — Windows Firewall Block
rules on TCP `3210-3211` and `6791`, scoped `RemoteAddress=LocalSubnet`. Block beats Allow in WFP,
so it overrides the Docker Desktop Backend allowance without modifying it. Verified after: the same
laptop probe returned **000**, browsing over Tailscale still loads CodePulse with live data, and on
the host loopback stayed 200 with Ástríðr→Convex ingest still flowing (newest `events` row 12s old,
since container traffic rides the Docker bridge, not the host LAN interface). Revert with `-Remove`.

Chosen over rebinding the container to `127.0.0.1` + the Tailscale IP because that makes Convex
startup depend on the Tailscale interface being up first — on a reboot where Docker wins that race
the bind fails and Convex does not start at all, trading an exposure for an outage risk.

## What this does and does NOT close

**Closed:** LAN devices can no longer reach the unauthenticated mutation surface.

**Still open — the actual question this seed exists for.** The exposure is now bounded to the
tailnet, which makes *the tailnet the de facto auth boundary* by accident rather than by decision.
Anything on the tailnet — every enrolled device, and anything running on one — can still write to
every public Convex function with no credential. That is probably acceptable, but it has never been
decided, written down, or weighed against making Clerk mandatory. The firewall rule bought time; it
did not answer the question. Note also that the rule lives in `convex-selfhost\`, which is not under
version control (DEBT-07, Phase 113) — so this mitigation is currently one machine rebuild away from
being silently lost.

## Related

- Audit: `.planning/v14.0-MILESTONE-AUDIT.md` — INT-03 and its remediation note.
- The Loom half of the class WAS fixed (2026-08-11): `convex/loom.ts`'s `upsertPipeline` and
  `recordStepEvent` are now `internalMutation`, verified by control-paired probe. That change is
  worth keeping for consistency with the rule Phase 108 set (`activeEngine.ts:79`,
  `controlVerbSwaps.ts:46`) — but it did not close a boundary on its own, and this seed exists
  because the boundary is elsewhere.
