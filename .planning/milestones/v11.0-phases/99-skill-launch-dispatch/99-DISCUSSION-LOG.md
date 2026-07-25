# Phase 99: Skill Launch / Dispatch - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 99-skill-launch-dispatch
**Areas discussed:** Run surface & target picker, Chat auto-send & skill args, Ástríðr / persona dispatch, Forge agent-run mapping

---

## Run surface & target picker

### Q1 — How to pick the launch target?
| Option | Description | Selected |
|--------|-------------|----------|
| Single Run → target chooser | One Run opens a chooser (Chat / Forge / Ástríðr), remembers last pick | ✓ |
| Split button | Primary runs default target; caret for the others | |
| Three explicit menu items | Separate ⋯-menu items per target | |

### Q2 — Which surfaces expose Run?
| Option | Description | Selected |
|--------|-------------|----------|
| ⋯ menu + QuickDeck tiles | SkillLifecycleMenu + high-traffic QuickDeck; palette unchanged | ✓ |
| ⋯ menu only | Single item in the existing menu | |
| Everywhere (+ palette) | ⋯ menu, tiles, and command palette | |

### Q3 — Fate of QuickDeck copy-to-clipboard?
| Option | Description | Selected |
|--------|-------------|----------|
| Keep copy as secondary | Primary click = Run; small copy icon retained | ✓ |
| Replace copy with Run | Retire clipboard copy | |
| Leave QuickDeck as copy | No tile change; Run only in ⋯ menu | |

**Notes:** Chooser remembers the last pick so repeat runs are fast. Palette deliberately left as copy/open-in-chat.

---

## Chat auto-send & skill args

### Q1 — Argument handling in Chat?
| Option | Description | Selected |
|--------|-------------|----------|
| Quick arg step, then send | Mini-input prefilled `/skill `, Enter fires real chat.send | ✓ |
| Fire bare `/skill` instantly | Immediate send, no args, no confirm | |
| Auto-detect: send or prompt | Metadata-driven; needs arg schema | |

### Q2 — Where does the send happen?
| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to Chat, send there | Go to /chat and stream the turn live | ✓ |
| Background send, stay on Skills | Fire from Skills, toast only | |
| Side drawer / split | Chat drawer over Skills | |

**Notes:** The arg step is a deliberate pre-send capture (popover), NOT the composer — result is always an executed chat.send, honoring LAUNCH-01's "not merely prefilled" requirement.

---

## Ástríðr / persona dispatch

### Q1 — What does the Ástríðr target DO (vs plain Chat)?
| Option | Description | Selected |
|--------|-------------|----------|
| Persona-scoped chat | Same stream, pick which profile answers (override active) | ✓ |
| Headless dispatch to runtime | Background job under a persona, results via telemetry | |
| Both: pick persona + where | Persona + stream-or-headless choice | |

### Q2 — Cross-repo scope appetite for this phase?
| Option | Description | Selected |
|--------|-------------|----------|
| Codepulse-only v1, stub the rest | Ship Chat+Forge fully; Ástríðr wired to existing channel, endpoint gaps deferred | ✓ |
| Cross-repo now (codepulse + astridr) | Do the astridr endpoint as part of Phase 99 | |
| Let research decide | Probe astridr's chat.send/dispatch before committing scope | |

**Notes:** Persona list sourced from `profileConfigs` (personal/business/consulting). `chat.send` has no per-message persona field today — researcher must probe whether a persona param or profile-switch already covers this before scoping; a genuinely-new astridr endpoint becomes a paired/deferred astridr phase.

---

## Forge agent-run mapping

### Q1 — What goes in the agent instruction?
| Option | Description | Selected |
|--------|-------------|----------|
| `/skill` + args verbatim | Agent harness resolves; native for the claude agent | ✓ |
| Natural-language wrapper | "Use the {skill} skill to…" — agent-agnostic paraphrase | |
| Agent-dependent (research) | `/skill` for claude, wrapper for codex/agy | |

### Q2 — How much of ForgeLaunchModal is shown?
| Option | Description | Selected |
|--------|-------------|----------|
| Full modal, prompt prefilled | Reuse Phase 80 modal, editable prompt, full picker | ✓ |
| One-click smart defaults | Skip modal, default agent/workspace/mode | |
| Prefilled + default agent, still modal | Modal with claude+last-workspace preselected | |

**Notes:** `/skill` verbatim stands regardless; researcher confirms codex/agy slash resolution (natural-language wrapper is the fallback only for non-resolving agents). The modal's prompt textarea is the Forge arg surface, so the Chat arg step does not apply to the Forge path.

---

## Claude's Discretion

- Research directive (D-14): probe astridr persona-routing on `chat.send`/`profileSwitches` (bounds Ástríðr scope) and Forge agent slash-skill resolution.
- Chooser component + "last pick" persistence (localStorage vs Convex); QuickDeck copy-vs-run affordance visuals.
- Per-target error/offline handling copy (follow honest-state conventions).
- Whether the persona picker is a second step or an inline expansion of the chooser.
- useCount/lastUsedAt: every real launch records; clipboard copy stops counting as a launch (Larry approved the recommended reading).

## Deferred Ideas

- New Ástríðr per-turn persona-override endpoint (if none exists) — paired astridr phase.
- Headless dispatch to Ástríðr's autonomous runtime (Mission Control, astridr SEED-023) — not chosen for v1.
- Split-button / per-target default launch — rejected for the single chooser.
- Run in the command palette — deliberately excluded.
- Structured Forge args beyond the prefilled prompt.
- ⋯ menu polish, drag lanes, optimistic reconcile — Phase 100.
