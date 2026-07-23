# Milestones

## v12.0 Personal Productivity — Reminders & Calendar (Shipped: 2026-07-23)

**Phases completed:** 2 phases (101-102), 10 plans (~22 tasks), cross-repo (codepulse + astridr-repo)
**Timeline:** 2026-07-19 → 2026-07-23 (5 days) | ~49 commits touching the reminders/calendar surface + phase docs
**Requirements:** 9/9 (REM-01..05, CAL-01..02, UI-01..02)
**Verification:** Phase 101 `VERIFICATION.md` passed (code-verified → live-verification addendum closed all 5 human items against the running stack: real Ástríðr container, real Google OAuth ×3, real Telegram nudge, real cron ticks; 101-07 gap-closure mutation-tested). Phase 101 Nyquist-compliant (`101-VALIDATION.md`, 17/17 tasks). Phase 102 verification 10/10, live self-hosted deploy + one real calendar tick (75 pushed / 0 failed).
**Milestone audit:** `tech_debt` — 0 blockers; the 2 flagged tech-debt items were closed by Phase 102. See `milestones/v12.0-MILESTONE-AUDIT.md`.
**Known deferred items at close:** 3 non-blocking (`102-REVIEW.md` 4 advisory warnings for a future tech-debt pass; QuickAdd NL date-parse backlog; astridr boot-order transient — self-heals).
**Non-linear note:** executed as an interleaved side-quest while **v11.0 (Skills, Phases 97-100) is still in progress** (97/98 done; 99/100 not started). Closing v12.0 did not change the active milestone — v11.0 resumes at Phase 99. `REQUIREMENTS.md` was not deleted at close; only its v12.0 section was extracted to `milestones/v12.0-REQUIREMENTS.md`.

**Key accomplishments:**

- **REM — one Convex store, bidirectional sync:** A single Convex `reminders` table is the source of truth, written by both the CodePulse UI and an Ástríðr chat tool (`reminders`: add/list/update/complete/snooze over `ConvexHandler.send_to`), every row origin-tagged (`dashboard` / `astridr`). A reminder created on either side appears live on the other — verified live end-to-end (NL round-trip both directions).
- **REM — recurrence + proactive nudges:** Due-dated reminders recur (daily / weekly / monthly / "every 1st", iCal `byday` codes); completing or passing an occurrence spawns the next open one with nudge state cleared, bounded recurrences terminate at `until`, and one-offs never respawn. An Ástríðr cron nudges exactly once per due occurrence on the reminder's own profile channel (deduped via `notifiedAt`) — live cron proof: 1 Telegram send, dedupe held 2 ticks.
- **CAL — read-only Google Calendar overlay:** Per-profile cron caches each real Google calendar (`personal`→mandrasle, `business`→lmandras@myprotectall, `consulting`→lemandras@forgedinai) into `calendarEvents` on a bounded forward window, upserted by `googleEventId` with stale rows pruned; one account's auth failure never blanks another. Events + due reminders render together on one grid, visually distinct — and **no Google write path exists** (grep-verified). Live: 3/73/0 events across the 3 real accounts.
- **UI — profile-segmented command center:** A lazy `/reminders` route in `navRegistry` (COMMAND cluster) presents reminders segmented personal / business / consulting, grouped Overdue / Today / Upcoming / Done, with optimistic complete/snooze/quick-add reconciled on server confirm and `prefers-reduced-motion`-safe motion. The sole UAT gap (undated reminders hidden by the day-filter) was closed by 101-07 with a RED-first regression test.
- **Quality gates:** `101-REVIEW` / `101-REVIEW-FIX` fixed 8/8 findings (2 Critical + 6 Warning), each regression-tested; `101-RETEST-UAT` 7/7 pass via Playwright against the live backend + live astridr cron/chat (also fixed pre-existing astridr log errors in-session). Phase 102 then removed the audit-flagged dead code cross-repo (dead `dueSoon`/`overdue` + `by_dueAt` index in codepulse; dead `CodePulsePoster` + stale two-backend narrative in astridr-repo) and live-verified the index-drop deploy + real calendar tick.

---

## v10.0 Eval & Trace Observability + Hardening (Shipped: 2026-07-07)

**Phases completed:** 3 phases (93-95), 15 plans, 36 tasks
**Timeline:** 2026-07-05 → 2026-07-07 | 97 files, +13,336 / −819
**Requirements:** 9/9 (EVAL-01..03, TRACE-01/02, HARD-01..04)
**Verification:** All 3 phases have `VERIFICATION.md` — 93 (18/18), 94 (22/22 + operator live sign-off), 95 (16/16). Prod deploy `tidy-whale-981`. Cross-repo: Forge daemon SQLite-migration FK crash + ingest-config durability fixes merged to forge `master` (`9adacfe`).
**Known deferred items at close:** 7 (all stale/non-blocking — see STATE.md Deferred Items).

**Key accomplishments:**

- D-04 is met with a real score traveling the full cross-repo path — Larry's Telegram turn (session `4e701b43`) -> `spawn_evaluation` -> mirror POST -> prod `/runtime-ingest` -> `evalScores` row with `profileId: "personal"` -> `listPersonaKpis` card (currentMean 1, delta +1, sparkline populated) — after live testing surfaced and fixed FIVE production gaps no test suite had caught, plus the E3 calibration reference set (12 real sessions, labels pending, trends explicitly not yet trusted).
- TypeScript 5.9.3 to 6.0.3 landed green via a single tsconfig `types: ["node"]` fix, react-day-picker fully deleted (not migrated), and the two now-redundant `@types/diff`/`@types/js-yaml` stubs removed — full green bar (tsc + 164/164 passing test files + vite build) confirmed on the settled tree.
- The four already-merged dependency majors were confirmed at target on the settled tree, all six stale dependabot branches confirmed gone from origin (pruned locally), and the `react-easy-crop@6` cropper UI in `AvatarUploader.tsx` was operator-verified live — closing D-10 as the retrospective verification it actually is, with no no-op re-bump commits.
- Ran the `/cso` fast-tier audit over the settled CodePulse tree (`src/`+`convex/`+build/config); verdict SHIP with `npm audit` 0 vulns, 0 committed secrets, and full ingest-auth coverage. Four LOW findings, all `file:line`-evidenced — the operator approved fixing all four, and they were remediated in one pass: `validateIngestAuth` made fail-closed, `insightsChat.ask` auth-gated, `.gitignore` broadened, and CI actions SHA-pinned. Green bar re-run green. HARD-01 resolved.
- HARD-02 closed honestly as verification + documentation (NO new rotation): both ingest keys confirmed real on prod Convex `tidy-whale-981`, and both emitter sides proven by live round trip — a completed `codex`/`goal` job from the real Forge daemon (`host lmofficenew`) landed a fresh `forgeJobs` row (`01KWYJ2GVQ09WRQTRN96VP926Y` @ 15:10:18Z), corroborated by a live Ástríðr `events` row at 13:40:44Z. Getting there required fixing two real blockers: a `.cloud`→`.site` host bug in the deploy checklist and a forge-daemon startup crash (migration-v4 FK violation).

**Addendum — Phase 96: UI Deep-Dive Cleanup (completed 2026-07-13, appended to v10.0 post-ship):**

- 13 plans / 28 tasks in one day, from a full-app audit (F1–F10 findings, D-01–D-11 decisions). Every UI surface now tells the truth and follows one standard: CONSOLE nav cluster dissolved; CommandPalette + sidebar single-sourced from `navRegistry` (killed ~15-route drift); fabricated header telemetry (`SYS: 14%`/`LAT: 12ms`), hardcoded Security "Valid" badge, Automation `?? 12` fallback, and fake cron indicators all removed; orphaned MissionControl/Profiles/Agents pages deleted with redirects (Tasks absorbed Mission Control behind a view toggle); dead UI stubs removed; all pages on one shared `<PageHeader>`; mobile master-detail collapse for ForgePage/WarRoom.
- Both HITL approval consumers (Chat ApprovalBlock + InboxCard) now gate UI state on the server ack boolean against the live-verified Ástríðr `ApprovalRespondCommand` contract — the false-success class found in live UAT is closed and regression-tested; Chat realigned from the never-emitted `run.block` to the real `run.blocks` event.
- Gates: re-verification 16/16 after the 96-13 gap closure, code review clean (0 critical/0 warning), 96-SECURITY.md 35/35 threats closed (`threats_open: 0`), 1742 tests + tsc green.
- Cross-repo handoff: `chat.send` security-pipeline bypass + missing approval-block producer routed to astridr-repo Phase 178.1 (inserted, planned, and code-complete same day; pending live UAT).

---

## v9.0 Readability & Experience (Shipped: 2026-06-29)

**Phases completed:** 5 phases (88–92), 30 plans, 43 tasks
**Timeline:** 2026-06-23 → 2026-06-29 (7 days) | 222 commits | 277 files, +33,655 / −3,495
**Requirements:** 19/19 (TH-01..06, AR-01..03, ROOM-01..04, G3D-01..02, VOX-01..04)
**Verification:** Phases 89/91/92 have VERIFICATION.md (91 verifier PASSED 10/10); Phase 90 operator live sign-off (`90-08-SUMMARY`); Phase 88 Nyquist VALIDATION (47/47 tests). All 5 phases have a VALIDATION.md. Phase 87/Phase 88 prod deploy `tidy-whale-981`.

**Key accomplishments:**

1. **AR — Durable Analytics Rollup (Phase 88):** Ingest-time rollups (`convex/analyticsRollup.ts` + shared `lib/sankeyClassify.ts`) maintained atomically from `ingest.ts`/`runtimeIngest.ts` — idempotency-keyed dedup (no double-count), a one-time historical backfill run against prod, and removal of every `.take()` count cap. Analytics queries now read O(buckets), permanently under Convex's 16 MiB/exec limit.
2. **TH — Readable Themes & Editorial Skin (Phase 89):** Fully token-driven theming (~77 hardcoded hex/rgba sites across ~24 files migrated to `var(--token)`, canvas graphs read tokens via `useThemeColors()`), a WCAG-AA readability-first theme, the Midnight Aubergine editorial skin, Matrix-Emerald + Electric Cyan retained, and a no-flash persisted switcher honoring `prefers-reduced-motion`. Zero axe violations across 4 themes × 5 surfaces (20 cases).
3. **ROOM — Agent / War Room finished (Phase 90):** Real participant identity from live roster (`useRosterAgents`), bounded room listing, genuine operator **Join** via LiveKit + the Ástríðr token endpoint, and per-room deep-links (`/war-room/:roomId`) with `seq`-ordered transcripts. Closed five live cross-repo integration gaps (LiveKit profile/workers, Convex deploy, `warRooms` ingest, transcript streaming, two CodePulse bugs) — operator live sign-off 2026-06-29.
4. **G3D — 3D Memory Galaxy (Phase 91):** Opt-in, lazy-loaded `react-force-graph-3d` render mode on `CodeVaultGraph` (three.js confined to the lazy chunk; 2D default never bundles it). Renders the ~4,038-node production graph at ≥30 FPS (operator GPU sign-off), disposes the WebGL context cleanly on 2D↔3D toggling, and colors nodes via the TH-01 `useThemeColors()` resolver.
5. **VOX — Voice Command Palette / Jarvis Mode (Phase 92):** Local in-browser openWakeWord ONNX wake-word detection (custom self-contained `hey_astrid.onnx`, no Picovoice/account), Web Speech STT via the shared `useSpeechRecognition` hook, streamed reply + persona TTS, and a safe-by-default OFF toggle that degrades gracefully on model-load failure (no silent hot mic).

**Notable:** Phases 90 and 91 were unbuilt at the 2026-06-26 milestone audit (`gaps_found`) and were completed 2026-06-27..29; the archived audit reflects that mid-flight snapshot, not the shipped state. VOX-01..04 were added to v9.0 after original scoping and back-filled into traceability 2026-06-26. The feared stale `milestones/v9.0-*` adversarial-track archives were verified absent from this repo (no rename needed).

**Known deferred items at close:** 8 (see STATE.md Deferred Items) — all non-blocking: 3 passed-UAT false positives (80/84/85), 2 verification flags still marked `human_needed` though signed off in docs (89/92), 1 stale unrelated quick task, 2 answered-but-unmarked CONTEXT question sets (078/89). Accepted tech debt: Phases 88 & 90 have no formal `VERIFICATION.md` (covered by Nyquist VALIDATION + operator live sign-off respectively).

---

## v8.0 Graph/KG Consolidation (Shipped: 2026-06-23)

**Phases completed:** 5 phases (83–87), 17 plans, 23 tasks
**Timeline:** 2026-06-18 → 2026-06-23 (6 days)
**Requirements:** 8/8 (GH-01..04, KG-08..11) — milestone audit PASSED
**Verification:** all phases verified; Phases 84/85/86/87 human-UAT'd via Playwright; Phase 87 deployed to prod (`tidy-whale-981`)

**Key accomplishments:**

- **GH-01 — Graph Snapshot Receiver:** Convex row-based tables (`graphSnapshots`/`graphSnapshotNodes`/`graphSnapshotLinks`) + versioned-swap upsert + retention cron + `case graph_snapshot` dispatch; stops dropping Ástríðr's nightly code/vault snapshots — the full ~4,038-node real graph is now live.
- **GH-02/GH-03 — Unified Graphs Hub:** replaced the `placeholder:true` nav stub with a real `/graphs` route + `GraphsHub`; `CodeVaultGraph` dual-palette render of the code+vault graph from Convex; Tool Galaxy / MCP Inventory / KG Explorer all reachable from one hub.
- **GH-04 — Cross-Graph Navigation:** `buildFocusUrl`/`useFocusParam` deep-links tool → owning agent → KG entity with same-origin `?from` return chips (normalized-EXACT matching, zero false jumps).
- **KG-09 — Community-Cluster Layout:** d3-force clustering + color halos in `ForceGraphCanvas`, auto-gated on the snapshot `community` field (no regression when absent).
- **KG-08 — Full-Text Search Lens:** `fetchSearch` + Search lens + `KGSearchResults` behind a graceful-degrade gate (live results data-gated on Ástríðr `/api/kg/search`, SEED-008).
- **KG-10/KG-11 — Saved Views + Temporal Diff/Animate:** `savedKgViews` + `useSavedViews` + `KGViewsPopover` + shareable `?view=<token>` links; `Point | Diff | Animate` temporal sub-modes (client-side `computeDiff` + `useKgAnimation` frame-synth + 20-entry LRU).

**Notable:** Phase 87 code review caught 1 BLOCKER (animation prefetch shared the frame display token → stuck frame) + 4 warnings, all fixed with a regression test. A pre-existing build break (stray `ThemeSwitcher` import without its committed component) was found + fixed during the close-out push; CI green.

---

## v5.0 Advanced Visualization & Integrations (Shipped: 2026-05-25)

**Phases completed:** 12 phases (6 with GSD plans, 6 built outside GSD), 23 plans, 31 tasks
**Files modified:** 668 | **Lines:** +76,219 / -3,401
**Timeline:** 10 days (2026-05-16 → 2026-05-25) | 267 commits

**Key accomplishments:**

1. **Schema foundation** — 4 new Convex tables (callGraphEdges, emailDeliveryLog, pagerdutyDeliveryLog, githubTriggerLog) and 2 table extensions (llmMetrics agentId/toolName, alertRuleCustom pagerdutyConfig/githubTrigger) unblocking all v5.0 features
2. **Multi-provider gateway** — Central provider registry (7 providers: 3 legacy + 4 gateway), OTel provider attribution fix, gateway event routing to dedicated tables, CLIGatewayTool telemetry emission
3. **Cost intelligence** — Provider billing registry with GPT/Gemini pricing, billingType-aware cost aggregation, SDK spend cap gauge with projected daily totals, subscription vs API-billed split views
4. **Gateway observability** — Real-time quota burndown gauges, routing decision audit table with score breakdown, provider comparison charts, per-provider cost trend stacking, gateway task lifecycle tracking
5. **SDK spend guard & multi-provider UX** — Provider enable/disable and priority controls with drag-to-reorder, session timeline provider badges, provider attribution across all surfaces
6. **External integrations & call graph** — Email digest delivery via Resend with daily cron, PagerDuty trigger/resolve via Events API v2 with stable dedup_key, agent/tool call graph visualization with dagre layout

---

## v4.0 CodePulse Operational Excellence (Shipped: 2026-04-14)

**Phases completed:** 8 phases, 36 plans
**Files modified:** 311 | **Lines:** +43,759 / -5,570
**Timeline:** 39 days (2026-03-06 → 2026-04-14)

**Key accomplishments:**

1. **Paperclip design language** — shadcn/ui New York, monochromatic oklch palette, zero border-radius, MetricCard/EntityRow patterns across 15 dashboard pages
2. **Bidirectional WebSocket telemetry** — real-time event push from Ástríðr, command sending, connection state management with auto-reconnect
3. **Command center UI** — Unified Inbox with keyboard navigation, Command Palette (Cmd+K), Agent Chat with Generative UI Blocks, Live Run Widget with Flow DAG, Insights Chat
4. **Task management** — 6-column Kanban with drag-and-drop, Ideation Findings with status workflow, Config Editor with inline diff/hot-reload, Cron management with visual builder
5. **Data pipeline** — Hourly/daily time-series aggregation, configurable retention with batch archival, cursor-based pagination across 7 list-view domains, Analytics page on pre-computed aggregates
6. **Alert routing** — Configurable rules (static + compound AND/OR), Discord/Slack webhook delivery with retry, acknowledge/mute/escalate lifecycle, per-severity notification preferences
7. **Intelligence layer** — Cost forecasting with moving averages, LLM-generated session briefings with daily digest cron, anomaly detection with z-score auto-alerts, memory quality metrics with dedup/staleness/contradiction detection
8. **Command catalog** — Live WebSocket-driven command registry on Capabilities page with accordion expand/collapse, category filter pills, dynamic search

**Known gaps:**

- REQUIREMENTS.md traceability table was stale (checkboxes not updated during phase execution) — all phases verified complete via VERIFICATION.md reports
- INFRA-01 through INFRA-05 referenced in ROADMAP but undefined in REQUIREMENTS.md (Ástríðr-side requirements, out of CodePulse scope)
- UI-08 (Lucide icon standardization) not fully checked off — partial coverage across phases

---
