/**
 * Retention COVERAGE policy — which bucket every schema table belongs to.
 *
 * WHY THIS EXISTS (2026-08-21). convex/retention.ts's RETENTION_DAYS covers 37
 * tables. schema.ts declares 145. Nothing connected the two in the direction
 * that mattered: retention.test.ts asserts every RETENTION_DAYS key is a real
 * table (catching typos), but nothing asserted that every real table has been
 * GIVEN a retention decision, nor that a table's stated bounding mechanism is
 * still alive.
 *
 * The cost of that gap, measured on the live backend 2026-08-21 via
 * _system/cli/tableSize: graphSnapshotNodes + graphSnapshotLinks held 502,636
 * documents — 25.7% of the entire database — while their only bound, the
 * sweepGraphSnapshotVersions cron, sat COMMENTED OUT in crons.ts since
 * 2026-07-14. Nothing reported it for 29 days. The nightly health check said
 * "verdict=OK tables=21 all caught up" throughout, truthfully, because it only
 * inspects the 37 enrolled tables. An instrument that cannot see the failure
 * mode reports success right up until someone reads the disk.
 *
 * This module is a RATCHET, not a blessing list. A table absent from every
 * bucket FAILS retentionCoverage.test.ts, so "unbounded" is refused as a
 * default rather than being the default.
 */

/** Tables pruned nightly by convex/retention.ts. Mirrors RETENTION_DAYS. */
export const COVERAGE_PRUNED: readonly string[] = [
  "runtime_events",
  "toolExecutions",
  "activeTime",
  "selfHealingEvents",
  "fileOps",
  "heartbeatAlerts",
  "gatewayQuotaSnapshots",
  "events",
  "environmentSnapshots",
  "contextSnapshots",
  "metricSnapshots",
  "securityEvents",
  "cronExecutions",
  "jobLifecycle",
  "agentCoordination",
  "toolPolicyEvents",
  "activeEngineSnapshots",
  "controlVerbSwaps",
  "governorDecisions",
  "messageRoutes",
  "aggregates",
  "advisorEvents",
  "promptSubmissions",
  "supabaseHealth",
  "episodicEvents",
  "configChanges",
  "run_blocks",
  "gitActivity",
  "gitCommits",
  "startupEvents",
  "agents",
  "commandExecutions",
  "proactiveMessages",
  "hiveMindEntries",
  "agentMetrics",
  "briefings",
  "subagentExecutions",
  // Phase 197 D-20 -- the mission-board projection tables. 14 days for the
  // per-tick missionRunEvents firehose, 30 for the one-row-per-mission
  // missionRuns; day values and rationale in retention.ts's RETENTION_DAYS.
  // Prunable because Postgres is the authority (Phase 197 D-01/D-02/D-06) and
  // plan 197-08 requires the final token count to survive independent of
  // Convex retention -- a pruned row costs the board history, never a fact.
  "missionRunEvents",
  "missionRuns"
] as const;

/**
 * Table -> the internal.* function that bounds it, which MUST be registered on a
 * LIVE cron. Machine-checked against COMMENT-STRIPPED crons.ts, because a
 * disabled cron is not absent from that file — it is commented out and still
 * perfectly greppable. That check is the one that catches the 2026-08-21 failure.
 */
export const COVERAGE_BOUNDED_BY_CRON: Record<string, string> = {
  graphSnapshots: "internal.graphSnapshots.sweepGraphSnapshotVersions",
  graphSnapshotNodes: "internal.graphSnapshots.sweepGraphSnapshotVersions",
  graphSnapshotLinks: "internal.graphSnapshots.sweepGraphSnapshotVersions",
  forgeLogChunks: "internal.forge.sweepForgeLogChunks",
  forgeFiles: "internal.forge.sweepForgeFileRecords",
  forgeArtifacts: "internal.forge.sweepForgeFileRecords",
  forgeCommands: "internal.forge.expireStaleCommands",
  alertMutes: "internal.alertMutes.cleanupExpired",
  media: "internal.media.pruneTrashBatch",
  // Phase 127 D-09/R-02: both are auto-close-then-delete janitors, not
  // calendar prunes, which is why they belong here rather than in
  // RETENTION_DAYS. `inbox` keys on a dedicated `closedAt` lifecycle field
  // — NOT the separate acknowledgement timestamp field, which two frontend
  // surfaces render read/unread state from and which this janitor only
  // ever reads, never writes. `ideationFindings` keys on its existing
  // `dismissed`/`dismissedAt`.
  inbox: "internal.inbox.autoCloseAndPrune",
  ideationFindings: "internal.ideation.autoCloseAndPrune",
};

/** Table -> where it is bounded at WRITE time. Documented, not machine-checkable. */
export const COVERAGE_BOUNDED_INLINE: Record<string, string> = {
  graphSnapshotBlobChunks: "convex/graphSnapshots.ts - upsertGraphSnapshot step 8 deletes prior-version chunk rows AFTER the pointer flip, capped by STALE_CHUNK_DELETE_CAP (Phase 126, SWEEP-02, D-06-REVISED)",
  workspaceSnapshots: "convex/workspace.ts - batch-capped prune inside the ingest mutation (D-11)",
  workspaceDirs: "convex/workspace.ts - batch-capped prune inside the ingest mutation (D-11)",
  promptVersions: "convex/galdr.ts - newest-20-per-prompt, pruned inline on save/restore (retention.ts:130-141 forbids calendar pruning here)",
  prompts: "curated library, not a firehose - retention.ts:126-141 explicitly forbids adding this to RETENTION_DAYS",
};

/** Table -> why it is deliberately unbounded. Config/registry/curated only. */
export const COVERAGE_KEEP_FOREVER: Record<string, string> = {
  llmMetrics: "cost history - named in retention.ts policy comment",
  sessions: "named in retention.ts policy comment",
  alerts: "named in retention.ts policy comment",
  agentConfigs: "config/audit; also stores retention.rotationCursor itself",
  mediaStyles: "curated Studio library - retention.ts:143-157 forbids calendar pruning",
  mediaModels: "curated Studio library - retention.ts:143-157 forbids calendar pruning",
  modelPricing: "pricing reference table, edited by hand",
  providerConfig: "provider configuration",
  profileConfigs: "agent profile configuration",
  kits: "tool-kit registry",
  plugins: "plugin registry",
  mcpServers: "MCP server registry",
  cliTools: "CLI tool registry",
  registeredHooks: "hook registry",
  skillCategories: "skill taxonomy, curated",
  personaDials: "persona configuration",
  links: "curated links",
  pipelines: "pipeline definitions",
  costBudgets: "budget configuration",
  alertRuleCustom: "alert rule configuration",
  authAliases: "identity mapping, bounded by number of humans",
  forgeHosts: "host registry, one row per machine",
  forgeWorkspaces: "workspace registry",
  wsl2Status: "single-row status doc",
  kgSummary: "single-row summary doc",
  kgAnswerSync: "single-row sync marker",
  tasks: "user-managed task list, bounded by what the operator creates",
  reminders: "reminder list, user-managed",
  wizardDrafts: "draft state",
  agentConfigVersions: "config version history, bounded by edit count",
  discoveredTools: "UPSERT-keyed by tool name (registry.ts:629-648) - bounded by distinct tool count, not append-only",
  dockerContainers: "UPSERT-keyed by containerId (docker.ts:16-21); stale rows removed by docker.pollHealth",
  providerHealth: "UPSERT-keyed per provider",
  channelHealth: "UPSERT-keyed per channel",
  executionModes: "mode configuration",
  rosterViewPrefs: "UI preference doc",
  savedKgViews: "user-saved views",
  slashCommands: "command registry",
  teamPresets: "preset configuration",
  toolGovernance: "governance policy configuration",
  warRooms: "war-room definitions",
  swarmGoals: "goal definitions",
  operatorScores: "operator scoring reference",
  agentProfiles: "MIXED curated + ephemeral: seedTeams.ts:142 and seedGateway.ts:67 insert real team config (displayName/systemPrompt/tools/sortOrder) while agents.ts:35 auto-creates one per new agentId. pruneBatchV3 deletes OLDEST FIRST, so calendar pruning would delete the seeded config before anything else",
  avatars: "foreign-key target of agentProfiles.avatarId, typed v.id to this table; pruning would leave dangling references, and seedTeams.ts:133 seeds curated ones",
  skills: "UPSERT registry keyed on (name, origin) at registry.ts:248-256 - a row IS an installed skill, so deleting one by calendar age removes a skill that is still present, exactly the hazard retention.ts:126-141 documents for prompts",
  skillOverrides: "user-authored category/visibility overrides (skillCategories.ts:331) - configuration, not telemetry",
};

/**
 * REVIEWED, NOT YET ENROLLED. Each table below was measured on 2026-08-21 and
 * judged log/event/snapshot-shaped, i.e. it should almost certainly be pruned.
 * They are NOT in RETENTION_DAYS yet because enrolling a table starts DELETING
 * production data, and pruneBatchV3 deletes by whole-table _creationTime cutoff
 * — the exact reason retention.ts:126-157 forbids enrolling curated tables.
 * That decision is the owner's, not this module's.
 *
 * `rowsPerDay` is measured (oldest row -> newest row over current count);
 * `null` means the table holds zero rows today. A zero-row table still needs a
 * window BEFORE its writer goes live — see retention.ts:52-62, where
 * gatewayQuotaSnapshots went from permanently-empty to ~288 rows/provider/day
 * the moment a dead poller was revived.
 *
 * TO ENROLL: move the key into RETENTION_DAYS in convex/retention.ts with the
 * proposedDays value, delete it from here, and confirm the table's rows are
 * genuinely disposable at that age.
 */
export const COVERAGE_PRUNE_PROPOSED: Record<
  string,
  { rowsPerDay: number | null; proposedDays: number; note: string }
> = {
  profileMetrics: { rowsPerDay: 0, proposedDays: 90, note: "DEAD WRITER: newest row 2026-04-10, 2,540 rows frozen. Confirm the feature is retired, then drop the table rather than prune it" },
  memoryQuality: { rowsPerDay: null, proposedDays: 90, note: "eval output, append-only" },
  evalScores: { rowsPerDay: null, proposedDays: 90, note: "eval output, append-only" },
  apiErrors: { rowsPerDay: null, proposedDays: 30, note: "append-only API error log, event-shaped" },
  anomalyEvents: { rowsPerDay: null, proposedDays: 90, note: "anomaly detection output" },
  compactionEvents: { rowsPerDay: null, proposedDays: 90, note: "append-only compaction log" },
  emailDeliveryLog: { rowsPerDay: null, proposedDays: 90, note: "delivery log" },
  githubWorkflowRuns: { rowsPerDay: null, proposedDays: 90, note: "CI run history" },
  forgeJobs: { rowsPerDay: null, proposedDays: 90, note: "job history" },
  subagentJobs: { rowsPerDay: null, proposedDays: 90, note: "job history" },
  pipelineRuns: { rowsPerDay: null, proposedDays: 90, note: "pipeline run history" },
  warRoomEvents: { rowsPerDay: null, proposedDays: 90, note: "append-only event log" },
  gagLedger: { rowsPerDay: null, proposedDays: 90, note: "append-only ledger" },
  swarmTasks: { rowsPerDay: null, proposedDays: 90, note: "task execution history" },
  calendarEvents: { rowsPerDay: null, proposedDays: 90, note: "synced calendar items" },
  callGraphEdges: { rowsPerDay: null, proposedDays: 90, note: "derived graph edges, regenerated" },
  buildProgress: { rowsPerDay: null, proposedDays: 30, note: "zero rows today; build progress is event-shaped" },
  callTranscripts: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; transcripts are append-only" },
  credentialAudit: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; audit trail" },
  dreamingCycles: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; cycle log" },
  dreamingFacts: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; append-only facts" },
  gatewayTasks: { rowsPerDay: null, proposedDays: 30, note: "zero rows today; task queue" },
  githubTriggerLog: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; trigger log" },
  instructionsLoaded: { rowsPerDay: null, proposedDays: 30, note: "zero rows today; per-session event" },
  integrationCalls: { rowsPerDay: null, proposedDays: 30, note: "zero rows today; call log" },
  kgBenchmarkRuns: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; benchmark history" },
  meetingBotSessions: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; session log" },
  memoryPreflight: { rowsPerDay: null, proposedDays: 30, note: "zero rows today; per-request event" },
  memoryTierStats: { rowsPerDay: null, proposedDays: 30, note: "zero rows today; periodic stats snapshot" },
  notifications: { rowsPerDay: null, proposedDays: 30, note: "zero rows today; notification log" },
  pagerdutyDeliveryLog: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; delivery log" },
  permissionRequests: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; request log" },
  pipelineCheckpoints: { rowsPerDay: null, proposedDays: 30, note: "zero rows today; checkpoint state" },
  pipelineExecutions: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; execution history" },
  profileSwitches: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; switch log" },
  reflectionResults: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; reflection output" },
  routingDecisions: { rowsPerDay: null, proposedDays: 30, note: "zero rows today; per-message decision log" },
  runtimeCommands: { rowsPerDay: null, proposedDays: 30, note: "zero rows today; command log" },
  sandboxViolations: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; violation log" },
  versionHistory: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; version log" },
  voiceCalls: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; call history" },
  webhookDeliveryLog: { rowsPerDay: null, proposedDays: 30, note: "zero rows today; delivery log" },
  webhookEvents: { rowsPerDay: null, proposedDays: 30, note: "zero rows today; inbound webhook firehose" },
  worktreeEvents: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; worktree event log" },
  approvalQueue: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; approval records" },
  conversationImports: { rowsPerDay: null, proposedDays: 90, note: "zero rows today; import records" },
};

/**
 * Tables present in the LIVE database with NO defineTable anywhere in convex/.
 * Verified 2026-08-21; value is the row count that day.
 *
 * These are NOT governed by the gate below — it parses schema.ts, and by
 * definition these are absent from it. They are inert: defineSchema() is called
 * without options so schemaValidation defaults to true, which rejects writes to
 * undeclared tables, and every one of them stopped receiving rows in May 2026
 * (newest row 2026-05-05 .. 2026-05-15). Total 1,675 rows.
 *
 * Recorded here so the 164-live vs 145-declared discrepancy is not rediscovered
 * as a mystery. Cleaning them up requires re-declaring each table to delete from
 * it, which costs more risk than the 1,675 rows are worth.
 */
export const COVERAGE_ORPHANED_NO_SCHEMA: Record<string, number> = {
  agentStatusEvents: 0,
  agentToolAssignments: 509,
  canonicalEvents: 530,
  complexityAssessments: 112,
  contextPressure: 436,
  dailyRhythmEntries: 0,
  designProjects: 0,
  designTemplates: 0,
  llmGateEvents: 2,
  networkEgressSummary: 0,
  networkPolicyRules: 0,
  pipelineStepEvents: 0,
  promptAssembly: 0,
  rateLimitEvents: 0,
  rawMessages: 85,
  scheduledWakeups: 0,
  superLoopIterations: 0,
  toolAssignmentChanges: 0,
  toolClassifications: 1,
};
