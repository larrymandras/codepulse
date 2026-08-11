---
id: SEED-008
status: resolved
resolved: 2026-08-11
resolution: "DECIDED — the tailnet is the auth boundary. Larry's call, 2026-08-11, taken against a measured exposure surface (215 public mutations, 8 files with ctx.auth, 85 without). Clerk is NOT made mandatory. Enforcement is the LAN firewall block, now a named self-verifying check in convex-selfhost/preflight.ps1 so it cannot silently vanish on a machine rebuild."
planted: 2026-08-11
planted_during: v14.0 / mid-milestone audit (INT-03 class sweep)
trigger_when: RESOLVED — reopen only if the Convex backend becomes reachable beyond the tailnet, if the tailnet gains devices that are not Larry's, or if CodePulse is ever intended to require sign-in for data access rather than for the UI
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
so it overrides the Docker Desktop Backend allowance without modifying it.

Verified after, from the same off-host laptop, **control-paired in both directions**:

```
http://10.0.0.44:3210/version  -> 000   (was 200 — blocked)
http://10.0.0.44:5173/         -> 200   (control: LAN path still live, so the 000
                                         is a real block, not a dropped subnet)
```

Plus: browsing over Tailscale still loads CodePulse with live data; host loopback stayed 200; and
Ástríðr→Convex ingest kept flowing (newest `events` row 12s old), since container traffic rides the
Docker bridge rather than the host LAN interface. Revert with `-Remove`.

The `5173=200` line is the one that makes this a result rather than an assumption — without it, a
`000` from a laptop that had simply fallen off the subnet is indistinguishable from a working
firewall rule. That distinction is not hypothetical here: two earlier readings of this same question
were confidently wrong before an off-host probe ran.

Chosen over rebinding the container to `127.0.0.1` + the Tailscale IP because that makes Convex
startup depend on the Tailscale interface being up first — on a reboot where Docker wins that race
the bind fails and Convex does not start at all, trading an exposure for an outage risk.

## RESOLUTION 2026-08-11 — the tailnet is the boundary, deliberately

**Decision: the tailnet is the auth boundary. Clerk is not made mandatory.** Larry's call, taken
against a measured surface rather than an impression:

| | |
|---|---|
| Public mutations (`export const X = mutation(`) | **215** |
| `internalMutation` | 78 |
| Files with public mutations **and** `ctx.auth` | **8** |
| Files with public mutations and **no** `ctx.auth` | **85** |
| Destructive public mutations | 18, incl. `resetAllCategoriesAndOverrides`, `notifications.clearAll`, `v6Mutations.deleteWarRoom`, `profiles.removeConfig` |

The honest statement of the posture: **Clerk gates the UI, not the data.** Anything on the tailnet
can call all 215 without signing in. That is now a decision rather than an accident.

**Why not make Clerk mandatory.** It is the correct end state only if CodePulse should require
sign-in for *data*, not just for the page. Today it would mean a `requireOperator(ctx)` across 215
mutations, and `dev:noauth` plus the entire Playwright suite depend on the no-auth path — so it also
requires deciding what tests do without an identity. That is milestone-scale work to defend against
"an attacker is already on an enrolled device," at which point they have the machine anyway.
Disproportionate; explicitly rejected, not deferred.

**Why not gate only the 18 destructive mutations.** Considered and rejected: it breaks the same
`dev:noauth`/e2e paths for exactly those functions, and it leaves the codebase inconsistent — some
mutations gated, 197 not — which reads as an unfinished migration to the next person.

### What enforcement actually is

The LAN firewall block (`restrict-convex-lan.ps1`), which is **machine state, not repo state**. A
rebuilt machine has none of it. So the closing action was to make it self-verifying:
`convex-selfhost/preflight.ps1` now carries `firewall:Block-Convex-Backend-LAN` and
`firewall:Block-Convex-Dashboard-LAN` as named checks that FAIL with
`"rule absent -- the LAN can reach Convex unauthenticated; run restrict-convex-lan.ps1"`.

Mutation-tested rather than assumed: pointing the check at a rule name that cannot exist produces
that FAIL, while the real names PASS on the same machine in the same run. A firewall check never
shown to fail is decoration.

### Known and accepted under this decision

- Any device on the tailnet, and anything running on one, can write to every public Convex function.
- **Tailscale ACLs were not inspected.** Default Tailscale policy allows all of your own devices to
  reach everything. If the tailnet ever gains a shared node or another person's device, that device
  inherits full write access to this database and **this decision must be revisited** — it is the
  first reopen trigger in the frontmatter.

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
