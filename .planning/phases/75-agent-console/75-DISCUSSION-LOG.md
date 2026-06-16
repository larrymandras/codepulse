# Phase 75: Agent Console - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 75-agent-console
**Areas discussed:** Launch surface, Console vs LiveRun, Stop UX & safety, History & summary

---

## Launch surface

### Engine selection
| Option | Description | Selected |
|--------|-------------|----------|
| Per-task toggle | One launch form with a Claude Code / Codex toggle; engine is a field on the POST | ✓ |
| Separate launchers | Distinct Claude Code vs Codex entry points | |
| You decide | Pick based on the gateway task schema | |

### Working directory
| Option | Description | Selected |
|--------|-------------|----------|
| Browse picker (M1.P3) | Read-only gateway file/worktree browse routes | ✓ |
| Known-repos dropdown | Gateway returns allowed repos; pick from dropdown | |
| Free-text path | Type an absolute path, validated against allowlist | (recorded as fallback) |

### Form factor
| Option | Description | Selected |
|--------|-------------|----------|
| Modal dialog | Reuse WarRoomLaunchDialog pattern | ✓ |
| Inline launch panel | Persistent compose panel docked on the page | |
| You decide | Pick based on LiveRun layout | |

### Payload fields (multi-select)
| Option | Description | Selected |
|--------|-------------|----------|
| Model selector | Explicit model dropdown | ✓ |
| Budget / max-rounds cap | Spend/round cap (ties to v5.0 SDK spend guard) | ✓ |
| Agent/persona | Run as an Ástríðr agent/persona (fetchAgents exists) | ✓ |
| Keep it minimal | Just engine + workdir + prompt for v1 | ✓ |

**User's choice:** Per-task toggle; M1.P3 browse picker; modal dialog; payload = model + budget + agent/persona + "keep it minimal".
**Notes:** "Keep it minimal" selected alongside the three rich fields — interpreted (and confirmed via reflect) as: the six-field set (engine + workdir + prompt + model + budget + agent/persona) is the ceiling, no more fields. Free-text/allowlist workdir path recorded as the pre-M1.P3 fallback since the browse picker hard-gates on M1.P3.

---

## Console vs LiveRun

### Page strategy
| Option | Description | Selected |
|--------|-------------|----------|
| Evolve LiveRun | Grow LiveRun.tsx into the Agent Console | ✓ |
| New Console page | Distinct /console route, import shared components | |
| You decide | Pick based on LiveRun coupling | |

### Run ↔ stream correlation
| Option | Description | Selected |
|--------|-------------|----------|
| POST returns run/session id | UI subscribes WS filtered to that id | ✓ |
| Latest-active heuristic | Attach to whatever run WS emits after POST | |
| You decide | Depends on POST /tasks return | |

### Concurrency
| Option | Description | Selected |
|--------|-------------|----------|
| One active run (v1) | Match LiveRun today | |
| Multiple concurrent runs | Run list/tabs, per-run WS demux | ✓ |
| You decide | Depends on gateway concurrency support | |

**User's choice:** Evolve LiveRun; runId from POST drives correlation; multiple concurrent runs.
**Notes:** Coherent stack — runId-keyed correlation is the enabler for multi-run demux. Implication recorded: LiveRun's single `liveSessionId`/`RunMeta` becomes `Map<runId, RunState>`.

---

## Stop UX & safety

### Stop scope
| Option | Description | Selected |
|--------|-------------|----------|
| Per-run + global e-stop | Per-run flag + one global halt-all | ✓ |
| Per-run only | No global control | |
| You decide | Depends on estop.py scopes | |

### Async-stop feedback
| Option | Description | Selected |
|--------|-------------|----------|
| 'Stopping…' pending state | Disable, stream until cancel-ack, then Stopped | ✓ |
| Optimistic stopped | Flip to Stopped immediately | |
| You decide | Depends on cancel-ack event | |

### Confirm
| Option | Description | Selected |
|--------|-------------|----------|
| One-click, no confirm | Graceful cancellation, no friction | ✓ |
| Confirm dialog | Always confirm | |
| You decide | Confirm global, one-click per-run | |

**User's choice:** Per-run + global e-stop; 'Stopping…' pending state; one-click no confirm.
**Notes:** estop via cancellation flag, NOT pid-kill (CON-03). `Stopping…` needs a gateway cancel-ack event (research flag). Per-run is one-click; global e-stop leans confirm (it halts everything) — recorded as a minor planning call.

---

## History & summary

### Summary contents (multi-select)
| Option | Description | Selected |
|--------|-------------|----------|
| Cost + tokens | Input/output tokens + $ (RunMeta tracks live) | ✓ |
| Duration + status | Timestamps, rounds, final status | ✓ |
| Files touched / diff | Which files changed (needs gateway file-change events) | ✓ |
| Prompt + engine/model | Prompt, engine, model, agent/persona, workdir | ✓ |

### Persistence timing
| Option | Description | Selected |
|--------|-------------|----------|
| Terminal states only | Persist once on completed/errored/stopped | ✓ |
| Checkpoint + finalize | Partial at start, finalize on terminal | |
| You decide | Depends on current RunSummary write | |

### History UI
| Option | Description | Selected |
|--------|-------------|----------|
| Reuse RunSummary/Selector | Feed existing components the richer summary | ✓ |
| Filterable runs table | New table filterable by engine/repo/status/date | |
| You decide | Depends on component structure | |

**User's choice:** Full reproducible summary (all four fields); persist on terminal states only; reuse RunHistorySelector/RunSummary.
**Notes:** Files-touched/diff depends on a gateway file-change event (research flag). RunSummary likely needs a small extension to render files/diff.

---

## Claude's Discretion

- Exact run-list/tabs layout for concurrent runs (within "evolve LiveRun").
- Whether the global e-stop confirm is a dialog vs inline hold-to-confirm.

## Deferred Ideas

- Antigravity CLI as a launch engine (toggle designed to extend; Claude Code + Codex for v1).
- Filterable runs history table (reuse existing components for v1).
- Mid-run summary checkpointing for crashed/disconnected runs.
- Writable worktree editing (browse is read-only per M1.P3).

---

## Session 2 — Gate-lift reconciliation (2026-06-10)

Re-opened on gate-lift (Ástríðr v18.0 shipped M1.P0/M1.P3). Verified the gateway drive surface against astridr ground truth — the discuss-seed's "no POST /tasks" claim was stale; `gateway/gateway/app.py` already exposes `POST/GET/DELETE /tasks` + `WS /tasks/{id}/stream`.

Decisions resolved:
- **Launch fields (D-04):** keep persona + model pickers. Persona → `system_prompt_append`. `model` → small **paired Ástríðr change** (add to gateway `TaskRequest` + adapters).
- **Concurrency (D-07):** multiple concurrent runs in v1 (confirmed feasible — gateway is multi-task_id).
- **Summary diff (D-12):** research adapter events first (`claude_cli`/`codex_cli`) before deciding files/diff source.
- **Stop (D-08):** per-run = `DELETE /tasks/{id}`; global e-stop iterates (+ optional `estop.py`).

Outcome: gate LIFTED, status → READY TO PLAN. Phase is CodePulse-only except the one `model`-field gateway add.
