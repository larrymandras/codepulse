/**
 * Retention COVERAGE policy — which bucket every schema table belongs to.
 *
 * WHY THIS EXISTS (2026-08-21). convex/retention.ts's RETENTION_DAYS covers 21
 * tables. schema.ts declares 145. Nothing connected the two, in either
 * direction that mattered: retention.test.ts asserted every RETENTION_DAYS key
 * is a real table (catching typos), but nothing asserted the reverse — that
 * every real table has been GIVEN a retention decision.
 *
 * The cost of that gap, measured on the live backend 2026-08-21:
 * graphSnapshotNodes + graphSnapshotLinks held 502,636 documents — 25.7% of the
 * entire database — while their only bounding mechanism, the
 * sweepGraphSnapshotVersions cron, sat COMMENTED OUT in crons.ts since
 * 2026-07-14. Nothing reported it. The nightly health check said
 * "verdict=OK tables=21 all caught up" the whole time, truthfully, because it
 * only ever looked at the 21 enrolled tables.
 *
 * This module is a RATCHET, not a blessing list:
 *   - A table absent from every bucket FAILS the test. New tables must be
 *     classified deliberately; the default is "unbounded", which is refused.
 *   - UNREVIEWED_TABLES is a FROZEN RECORD OF DEBT, not approval. Its length may
 *     only ever go DOWN (UNREVIEWED_CEILING enforces this). Do not add to it.
 *   - BOUNDED_BY_CRON values are machine-checked: the named function must appear
 *     in a LIVE (non-commented) cron registration. That check is the one that
 *     would have caught the graphSnapshots failure, because there the table was
 *     classified correctly and the MECHANISM was the thing that had died.
 */

/** Tables pruned nightly by convex/retention.ts. Source of truth: RETENTION_DAYS. */
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
  "aggregates"
] as const;

/**
 * Table -> the internal.* function that bounds it, which MUST be wired to a live
 * cron in convex/crons.ts. Verified by retentionCoverage.test.ts against
 * comment-stripped crons.ts source.
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
};

/**
 * Table -> where it is bounded at WRITE time (no cron to check). Documented, not
 * machine-verified: an inline prune cannot be confirmed from crons.ts. Keep this
 * set small and cite file + mechanism, so a reviewer can check it by hand.
 */
export const COVERAGE_BOUNDED_INLINE: Record<string, string> = {
  workspaceSnapshots: "convex/workspace.ts - batch-capped prune inside the ingest mutation (D-11)",
  workspaceDirs: "convex/workspace.ts - batch-capped prune inside the ingest mutation (D-11)",
};

/** Table -> why it is deliberately unbounded. Only tables with a stated rationale. */
export const COVERAGE_KEEP_FOREVER: Record<string, string> = {
  llmMetrics: "cost history - named in retention.ts policy comment",
  sessions: "named in retention.ts policy comment",
  alerts: "named in retention.ts policy comment",
  agentConfigs: "config/audit; also stores retention.rotationCursor itself",
};

/**
 * DEBT. Tables that existed on 2026-08-21 with no retention decision on record.
 * Being listed here is NOT approval — it means nobody has decided yet. Every one
 * of these is a potential repeat of the graphSnapshots incident.
 *
 * To burn this down: pick a table, decide, and MOVE it into one of the buckets
 * above. Then lower UNREVIEWED_CEILING to match. Never add a new table here —
 * classify it properly instead.
 */
export const UNREVIEWED_TABLES: readonly string[] = [
  "advisorEvents",
  "agentConfigVersions",
  "agentMetrics",
  "agentProfiles",
  "agents",
  "alertRuleCustom",
  "anomalyEvents",
  "apiErrors",
  "approvalQueue",
  "authAliases",
  "avatars",
  "briefings",
  "buildProgress",
  "calendarEvents",
  "callGraphEdges",
  "callTranscripts",
  "channelHealth",
  "cliTools",
  "commandExecutions",
  "compactionEvents",
  "configChanges",
  "conversationImports",
  "costBudgets",
  "credentialAudit",
  "discoveredTools",
  "dockerContainers",
  "dreamingCycles",
  "dreamingFacts",
  "emailDeliveryLog",
  "episodicEvents",
  "evalScores",
  "executionModes",
  "forgeHosts",
  "forgeJobs",
  "forgeWorkspaces",
  "gagLedger",
  "gatewayTasks",
  "gitActivity",
  "gitCommits",
  "githubTriggerLog",
  "githubWorkflowRuns",
  "hiveMindEntries",
  "ideationFindings",
  "inbox",
  "instructionsLoaded",
  "integrationCalls",
  "kgAnswerSync",
  "kgBenchmarkRuns",
  "kgSummary",
  "kits",
  "links",
  "mcpServers",
  "mediaModels",
  "mediaStyles",
  "meetingBotSessions",
  "memoryPreflight",
  "memoryQuality",
  "memoryTierStats",
  "modelPricing",
  "notifications",
  "operatorScores",
  "pagerdutyDeliveryLog",
  "permissionRequests",
  "personaDials",
  "pipelineCheckpoints",
  "pipelineExecutions",
  "pipelineRuns",
  "pipelines",
  "plugins",
  "proactiveMessages",
  "profileConfigs",
  "profileMetrics",
  "profileSwitches",
  "promptSubmissions",
  "promptVersions",
  "prompts",
  "providerConfig",
  "providerHealth",
  "reflectionResults",
  "registeredHooks",
  "reminders",
  "rosterViewPrefs",
  "routingDecisions",
  "run_blocks",
  "runtimeCommands",
  "sandboxViolations",
  "savedKgViews",
  "skillCategories",
  "skillOverrides",
  "skills",
  "slashCommands",
  "startupEvents",
  "subagentExecutions",
  "subagentJobs",
  "supabaseHealth",
  "swarmGoals",
  "swarmTasks",
  "tasks",
  "teamPresets",
  "toolGovernance",
  "versionHistory",
  "voiceCalls",
  "warRoomEvents",
  "warRooms",
  "webhookDeliveryLog",
  "webhookEvents",
  "wizardDrafts",
  "worktreeEvents",
  "wsl2Status",
];

/**
 * Ratchet. UNREVIEWED_TABLES.length must never exceed this. Lower it as tables
 * get classified; raising it requires deliberately editing this line, which is
 * the point — it makes adding new unbounded debt a visible act in review.
 */
export const UNREVIEWED_CEILING = 109;
