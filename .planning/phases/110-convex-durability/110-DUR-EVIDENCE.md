# Phase 110 Plan 04 — DUR-01/DUR-02 Live Evidence

This file is a verbatim command transcript. No Convex admin key, deploy key, or bearer token
appears anywhere in it. Every `npx convex` invocation below targets the deployment via
`--env-file <path>`, never via a literal `--admin-key`/`--url` argument on the command line —
that shape means no credential value is ever present in a pasted command in the first place, so
there is nothing to elide from the command lines themselves. `npx convex env list` was not run at
any point in this session (forbidden by the orchestrator's dispatch; it prints unmasked
`NAME=VALUE` against this self-hosted backend and leaked live keys into a different session on
2026-08-10). No `.env` file was read, cat'd, sourced, or grepped at any point.

- **Date:** 2026-08-10
- **Operator:** Larry Mandras (authorization for the Task 2 deploy checkpoint has not yet been
  requested at the time this baseline was captured — see the CHECKPOINT REACHED report this file
  is attached to)
- **Driver:** Claude Code (sequential executor, plan `110-04` Task 1, `autonomous: false`,
  dispatched by the orchestrator running in this session)
- **Target:** self-hosted Convex at `127.0.0.1:3210`, reached via `--env-file
  C:\Users\mandr\convex-selfhost\selfhosted.envfile` — the same credential file
  `retention-health-check.ps1` and this project's prior live-evidence gates
  (`108-ENGINE-05-EVIDENCE.md`, `109-LIVE-EVIDENCE.md`) use for this exact target. See the
  target-verification note under the "Extra" section below for the independent evidence that this
  file in fact resolved to the live self-hosted instance rather than the retired
  `tidy-whale-981` cloud deployment.
- **Git SHA of code being deployed (pending operator authorization, Task 2):**
  `84ebc8d171d183d4cddc15578e47a3cd4cb95ace`

---

## Pre-deploy baseline (the control for every later assertion)

### Probe 1 — Oldest `period:"daily"` aggregates row (D-01)

```
$ npx convex run --env-file <selfhosted.envfile> --inline-query "const rows = await ctx.db.query('aggregates').withIndex('by_period_bucket', q => q.eq('period','daily')).order('asc').take(1); return rows.length ? { bucket_start: rows[0].bucket_start, _creationTime: rows[0]._creationTime, metric_type: rows[0].metric_type } : { empty: true };"
{
  "_creationTime": 1778029200021.6772,
  "bucket_start": 1777939200,
  "metric_type": "events"
}
```

`_creationTime` 1778029200021.6772 ms = `2026-05-06T01:00:00.021Z` (UTC). `bucket_start`
1777939200 s = `2026-05-05T00:00:00Z` (UTC).

**VERDICT:** Oldest daily row recorded. `bucket_start` matches `110-CONTEXT.md`'s "`aggregates`
spans 2026-05-05 → today" claim exactly — this is the correct table and window, not stale
research. This `bucket_start`/`_creationTime` pair is the sharp instrument for DUR-01: if the
deployed predicate ever wrongly deletes daily rows, it deletes from the oldest end first, so this
timestamp moving FORWARD on a later re-run of this same probe is the direct failure signature that
must block the phase.

### Probe 2 — Oldest `period:"hourly"` aggregates row (positive control)

```
$ npx convex run --env-file <selfhosted.envfile> --inline-query "const rows = await ctx.db.query('aggregates').withIndex('by_period_bucket', q => q.eq('period','hourly')).order('asc').take(1); return rows.length ? { bucket_start: rows[0].bucket_start, _creationTime: rows[0]._creationTime, metric_type: rows[0].metric_type } : { empty: true };"
{
  "_creationTime": 1778001143716.9412,
  "bucket_start": 1777996800,
  "metric_type": "cost"
}
```

`_creationTime` 1778001143716.9412 ms = `2026-05-05T17:12:23.716Z` (UTC). `bucket_start`
1777996800 s = `2026-05-05T16:00:00Z` (UTC).

**VERDICT:** Oldest hourly row recorded. This is the positive control: after the first post-deploy
nightly prune, this timestamp MUST move forward — `period:"hourly"` rows are the ones the new
predicate makes prunable at 90 days. If a later re-run of this same probe shows this timestamp
unchanged, the predicate is skipping everything rather than pruning correctly, which is the
opposite failure to the one Probe 1 guards against.

### Probe 3 — Bounded daily count at `take(1000)`

```
$ npx convex run --env-file <selfhosted.envfile> --inline-query "const rows = await ctx.db.query('aggregates').withIndex('by_period_bucket', q => q.eq('period','daily')).order('asc').take(1000); return { count: rows.length };"
{
  "count": 1000
}
```

**VERDICT:** No `SystemTimeoutError` — returned instantly, well inside the `take(1000)` ceiling
this plan requires. `count: 1000` means the cap was hit: there are AT LEAST 1000
`period:"daily"` rows in the table (consistent with `110-CONTEXT.md`'s ~138 daily rows/day over a
~97-day span, ≈13,000+ total). This is a lower bound, not an exhaustive count. Per the plan, no
retry at a larger `take` was attempted and none is warranted — Probe 1 stands on its own as the
sharp instrument regardless of this count's precision.

### Probe 4 — Rotation cursor absence (D-06)

```
$ npx convex run --env-file <selfhosted.envfile> --inline-query "const row = await ctx.db.query('agentConfigs').withIndex('by_key', q => q.eq('configKey','retention.rotationCursor')).first(); return { row: row ?? null };"
{
  "row": null
}
```

**VERDICT:** Confirmed absent (`null`) pre-deploy. This is the control D-06 requires: after the
first full nightly run post-deploy, this row should read a bounds-checked rotation index, e.g.
`0`. A stored value of `0` is indistinguishable from "the row never existed" unless the absence is
on record first — it now is.

### Probe 5 — `retention:listRetentionPolicy`, expected FAILURE (known-absent control)

```
$ npx convex run --env-file <selfhosted.envfile> retention:listRetentionPolicy
Exit code 1
✖ Failed to run function "retention:listRetentionPolicy":
Error: [Request ID: dc32672157fb0c29] Server Error
Could not find function for 'retention:listRetentionPolicy'. Did you forget to run `npx convex dev`?

Available functions:
• activeTime:insert
• activeTime:recent
• advisorEvents:recent
• advisorEvents:savingsSummary
• advisorEvents:providerMetrics
• advisorEvents:executionDepthHistogram
• agentConfigVersions:listByAgent
• agentConfigVersions:getVersion
• agentConfigVersions:latestVersion
• agentConfigVersions:listAgents
• agentConfigVersions:compareVersions
• agentConfigVersions:createVersion
• agentMetrics:insertMetric
• agentMetrics:forAgent
• agentMetrics:leaderboard
• agentProfiles:create
• agentProfiles:update
• agentProfiles:list
• agentProfiles:updateSortOrder
• agentProfiles:getByProfileId
• agentProfiles:remove
• agents:register
• agents:updateStatus
• agents:listRunning
• agents:topology
• agents:listAll
• agents:listAllPaginated
• agents:detail
• aggregates:computeHourly
• aggregates:rollupDaily
• aggregates:backfillDailyRollup
• aggregates:backfillTokenSplit
• aggregates:costByPeriod
• aggregates:costByPeriodByProvider
• aggregates:errorTrendByPeriod
• aggregates:costByGoalPeriod
• aggregates:llmByGoal
• aggregates:eventCountsByPeriod
• alertLifecycle:acknowledgeAlert
• alertLifecycle:resolveAlert
• alertLifecycle:escalateToTask
• alertMutes:muteTarget
• alertMutes:unmuteTarget
• alertMutes:isTargetMuted
• alertMutes:isTargetMutedPublic
• alertMutes:listActiveMutes
• alertMutes:cleanupExpired
• alertRuleCustom:create
• alertRuleCustom:update
• alertRuleCustom:remove
• alertRuleCustom:list
• alertRuleCustom:get
• alertRuleCustom:setThresholdOverride
• alertRuleCustom:getThresholdOverride
• alertRuleCustom:listThresholdOverrides
• alertRulesConfig:getDisabledRules
• alertRulesConfig:toggleRule
• alerts:create
• alerts:acknowledge
• alerts:listActive
• alerts:listAll
• alerts:listAllPaginated
• alerts:listBySource
• alerts:countBySeverity
• alerts:dismissAll
• alerts:autoAcknowledgeStaleInternal
• alerts:listActiveGrouped
• alerts:evaluate
• alerts:evaluateInternal
• alerts:getLastCriticalEvalTimestamp
• alerts:evaluateCriticalInternal
• alerts:getById
• alerts:updateWebhookStatus
• analytics:activityHeatmap
• analytics:toolFlowSankey
• analytics:tokenSunburst
• analytics:errorRateTrend
• analytics:sessionDurations
• analytics:tokenWaterfall
• analyticsRollup:backfillHistorical
• analyticsRollup:backfillTokenRollup
• analyticsRollup:clearHistoricalBucketsPage
• analyticsRollup:clearTokenBucketsPage
• analyticsRollup:incrementBatch
• analyticsRollup:insertBucketsBatch
• anomalyDetection:evaluateInternal
• anomalyDetection:getActiveAnomalies
• apiErrors:insert
• apiErrors:recent
• apiErrors:byStatusCode
• approvalQueue:upsert
• approvalQueue:list
• approvalQueue:get
• approvalQueue:updateStatus
• archival:markStaleArchived
• archival:setRetentionDays
• archival:getRetentionDays
• authAliases:list
• automation:recordCron
• automation:recentCrons
• automation:recordHeartbeat
• automation:recentHeartbeats
• automation:recordJob
• automation:recentJobs
• automation:recordProactiveMessage
• automation:recentProactiveMessages
• automation:recordSubagentExecution
• automation:recentSubagentExecutions
• automation:cronSummary
• automation:cronsByJob
• automation:recordWebhook
• automation:recentWebhooks
• avatars:create
• avatars:update
• avatars:list
• avatars:getById
• avatars:generateUploadUrl
• avatars:saveImage
• avatars:getImageUrl
• briefings:getLLMConfigInternal
• briefings:getSessionDataInternal
• briefings:getDailyDigestDataInternal
• briefings:getLLMConfig
• briefings:setLLMConfig
• briefings:onSessionCompleted
• briefings:storeBriefing
• briefings:generateSessionBriefingAction
• briefings:triggerDailyDigest
• briefings:generateDailyDigestAction
• briefings:listBriefings
• build:updateComponent
• build:phaseProgress
• build:phaseOverview
• build:recentActivity
• build:componentsByPhase
• calendarEvents:listByProfile
• calendarEvents:upsertBatch
• callGraphEdges:upsertEdge
• callGraphEdges:listEdges
• callGraphEdges:getBySession
• channelHealth:upsert
• channelHealth:latest
• commandExecutions:upsertLifecycle
• commandExecutions:listExecutions
• commandExecutions:listExecutionsPaginated
• commandExecutions:summaryStats
• compactionEvents:insert
• compactionEvents:recent
• contextSnapshots:record
• contextSnapshots:historyBySession
• contextSnapshots:latestBySession
• conversationImports:recent
• conversationTimeline:buckets
• conversationTimeline:messageDetail
• coordination:recordEvent
• coordination:activeHandoffs
• coordination:recentAll
• credentialAudit:recordAccess
• credentialAudit:recent
• credentialAudit:deniedAccesses
• credentialAudit:byTool
• credentialAudit:overview
• dataRetention:purgeOldTelemetryEvents
• dataRetention:purgeOldHeartbeatAlerts
• dataRetention:purgeOldMemoryEvents
• deliveryLogs:insertEmailLog
• deliveryLogs:insertPagerdutyLog
• deliveryLogs:insertGenericWebhookLog
• ... (function list continues; omitted middle section is unremarkable module listing,
•     no credential content anywhere in it — pattern preserved in full at the reminders/
•     retention/rosterViewPrefs boundary below, which is the part relevant to this probe)
• reminders:remove
• reminders:listByProfile
• retention:startNightlyPrune
• retention:pruneBatchV3
• rosterViewPrefs:save
• rosterViewPrefs:get
• routingDecisions:insert
• routingDecisions:listPaginated
• runBlocks:record
• runBlocks:listSessions
• runBlocks:getBySession
• sandboxViolations:recordViolation
• sandboxViolations:recent
• sandboxViolations:byTool
• sandboxViolations:byPermission
• sandboxViolations:overview
• savedKgViews:save
• savedKgViews:list
• savedKgViews:remove
• savedKgViews:getByShareToken
• security:recordEvent
• security:acknowledgeEvent
• security:recentEvents
• security:recentEventsPaginated
• security:severityCounts
• security:recentByType
• security:rlsStats
• security:hitlStats
• security:webhookStats
• security:vaultStats
• seedGateway:seedSDKSpendAlert
• seedGateway:seedGatewayProfiles
• seedGateway:seedProviderConfigs
• seedGateway:runSeed
• seedTeams:seed
• seedTeams:reseed
• selfHealing:recordEvent
• selfHealing:componentHealth
• selfHealing:recentRecoveries
• selfHealing:uptimeStats
• selfHealing:recordRecoveryWithCommit
• selfHealing:listVersions
• sessions:upsert
• sessions:markCompleted
• sessions:listActive
• sessions:getById
• sessions:listAll
• sessions:listPaginated
• sessions:comparison
• skillCategories:listCategories
• skillCategories:countAutoAssigned
• skillCategories:getSkillsWithOverrides
• skillCategories:getRecentlyUsedSkills
• skillCategories:createCategory
• skillCategories:updateCategory
• skillCategories:deleteCategory
• skillCategories:updateSkillOverride
• skillCategories:toggleFavorite
• skillCategories:bulkAcceptAutoAssigned
• skillCategories:autoSeedSkill
• skillCategories:seedExistingSkills
• skillCategories:migrateDisplayNames
• skillCategories:resetAllCategoriesAndOverrides
• startupEvents:recent
• subagentJobs:upsert
• subagentJobs:byId
• subagentJobs:listRecent
• supabase:recordHealth
• supabase:currentHealth
• supabase:pollHealth
• swarmTasks:upsert
• swarmTasks:byGoal
• swarmTasks:listGoals
• swarmTasks:goalsByAgent
• systemResources:current
• tasks:listByColumn
• tasks:create
• tasks:moveColumn
• tasks:update
• tasks:remove
• teamPresets:create
• teamPresets:update
• teamPresets:remove
• teamPresets:list
• teamPresets:get
• teamPresets:incrementUsage
• toolExecutions:insert
• toolExecutions:recentExecutions
• toolExecutions:successRate
• toolExecutions:avgDuration
• toolExecutions:listBySession
• toolGovernance:listGovernance
• toolGovernance:setToolDisabled
• v6Mutations:insertMemoryPreflight
• v6Mutations:insertDreamingCycle
• v6Mutations:insertDreamingFact
• v6Mutations:insertAdvisorEvent
• v6Mutations:insertConversationImport
• v6Mutations:insertStartupEvent
• v6Mutations:upsertAuthAlias
• v6Mutations:upsertWarRoom
• v6Mutations:deleteWarRoom
• v6Mutations:insertWarRoomEvent
• v6Mutations:upsertVoiceCall
• v6Mutations:insertCallTranscript
• v6Mutations:upsertMeetingBotSession
• v6Mutations:insertMissionControlTask
• v6Mutations:updateMissionControlTask
• voiceCalls:listActiveCalls
• voiceCalls:listRecentCalls
• voiceCalls:getCallTranscripts
• warRoom:listRooms
• warRoom:getRoomEvents
• webhookDelivery:getChannels
• webhookDelivery:setChannel
• webhookDelivery:removeChannel
• webhookDelivery:testWebhook
• webhookDelivery:getPreferences
• webhookDelivery:setPreferences
• webhookDelivery:getNotificationChannels
• webhookDelivery:getNotificationPreferences
• webhookDelivery:getDigestInterval
• webhookDelivery:logDeliveryAttempt
• webhookDelivery:sendAlertWebhook
• webhookDelivery:sendDigest
• webhookDelivery:getDigestAlerts
• webhookDelivery:updateLastDigestAt
• wizardDrafts:save
• wizardDrafts:get
• wizardDrafts:list
• wizardDrafts:remove
• worktreeEvents:insert
• worktreeEvents:recent
• worktrees:recordEvent
• worktrees:recentEvents
• worktrees:activeWorktrees
• worktrees:byAgent
• wsl2:upsertStatus
• wsl2:getByDistro
• wsl2:listAll
• inbox:raise
• inbox:ack
• inbox:dismiss
• inbox:listByProfile
• inbox:listAll
• inbox:listHeldUnacked
• inbox:dismissAllCards
• activeEngine:latestByProfile
• activeEngine:recordRouting
• activeEngine:pruneUnresolved
• costBudgets:create
• costBudgets:get
• costBudgets:getByScope
• costBudgets:list
• costBudgets:remove
• costBudgets:seedFromLegacyCaps
• costBudgets:update
• costDerived:billedOverTime
• costDerived:costBreakdown
• costDerived:costOverTime
• costDerived:unpricedModels
• modelPricing:create
• modelPricing:get
• modelPricing:list
• modelPricing:remove
• modelPricing:seedDefaults
• modelPricing:update
• toolAnalytics:usageOverTime
• toolAnalytics:usageByTool
• toolAnalytics:recentExecutionsBySource
• toolPolicyEvents:record
• toolPolicyEvents:recent
• toolPolicyEvents:lastReceivedAt
• toolPolicyEvents:countsByKind
• controlVerbSwaps:record
• controlVerbSwaps:listByScope
• controlVerbSwaps:listGlobal
• galdr:list
• galdr:lookup
• galdr:listVersions
• galdr:listCategories
• galdr:createPrompt
• galdr:updatePrompt
• galdr:restoreVersion
• galdr:archivePrompt
• galdr:toggleFavorite
• galdr:recordUsage
```

(The `deliveryLogs:insertGenericWebhookLog` → `reminders:listByProfile` span of the function list
was elided above as a length-reduction, not a redaction — every entry in that span is a plain
`module:functionName` identifier from this repo's own `convex/` directory, structurally identical
to every other line shown; the full unabridged CLI output was captured and reviewed for secret
content before this edit, and none was present anywhere in it.)

**VERDICT: FAILED, as required.** `retention:listRetentionPolicy` does not exist on the deployed
backend. This is the known-absent control that makes a post-deploy success in Task 3 mean the
deploy landed, rather than meaning the CLI happened to work. The failure output also lists
`retention:startNightlyPrune` and `retention:pruneBatchV3` as currently deployed — both existed
before Phase 110 — which independently confirms the working tree's new Phase 110 additions
(`listRetentionPolicy` among them) are genuinely undeployed, not merely misspelled or misrouted in
this probe. **If this probe had unexpectedly succeeded, this plan would have stopped here per its
own instruction — it did not; execution proceeds to the Task 2 checkpoint.**

---

## Extra: distinct `period` values present in `aggregates` (requested by the orchestrator for the Task 2 authorization decision)

Rationale: `convex/schema.ts:955` types `period` as a bare `v.string()` (comment: `// "hourly" |
"daily"`), not an enforced union, and `PRUNE_PREDICATES.aggregates` (`doc.period !== "daily"`)
makes ANY non-`"daily"` value prunable at 90 days once deployed. If a third value exists in live
data, deploying makes it irreversibly deletable. Two independent bounded (`take(1000)`) samples
were taken from opposite ends of the data — `aggregates` is far too large for either single sample
to be exhaustive (Probe 3 above already shows ≥1000 rows in `period:"daily"` alone).

### Sample A — most recent 1000 rows by `_creationTime` (default index, descending)

```
$ npx convex run --env-file <selfhosted.envfile> --inline-query "const rows = await ctx.db.query('aggregates').order('desc').take(1000); const periods = {}; for (const r of rows) { periods[r.period] = (periods[r.period]||0)+1; } return { sampleSize: rows.length, periodCounts: periods, newestCreationTime: rows[0] ? rows[0]._creationTime : null };"
{
  "newestCreationTime": 1786397738944.3867,
  "periodCounts": {
    "hourly": 1000
  },
  "sampleSize": 1000
}
```

`newestCreationTime` 1786397738944.3867 ms = `2026-08-10T21:35:38.944Z` — today, the same day this
probe was run.

**Target-verification note:** this timestamp is also the independent evidence that `--env-file`
resolved to the LIVE self-hosted instance rather than the retired `tidy-whale-981` cloud
deployment: a frozen/retired deployment cannot produce a document written minutes-to-hours before
the probe that reads it. Combined with Probe 5 confirming this deployment carries this exact
codebase's full ~400-entry function set (not an empty or unrelated project), this establishes the
probes in this file answered from the correct target without ever needing to print or read the
target URL directly.

### Sample B — lowest 1000 rows by `(period, bucket_start)` index order, unfiltered

```
$ npx convex run --env-file <selfhosted.envfile> --inline-query "const rows = await ctx.db.query('aggregates').withIndex('by_period_bucket', q => q).order('asc').take(1000); const periods = {}; for (const r of rows) { periods[r.period] = (periods[r.period]||0)+1; } return { sampleSize: rows.length, periodCounts: periods, firstBucketStart: rows[0] ? rows[0].bucket_start : null };"
{
  "firstBucketStart": 1777939200,
  "periodCounts": {
    "daily": 1000
  },
  "sampleSize": 1000
}
```

`firstBucketStart` 1777939200 s = `2026-05-05T00:00:00Z`, matching Probe 1's oldest daily row
exactly — confirms `"daily"` genuinely is the lexicographically-first `period` value in this
table's live data, not an artifact of a different query shape.

**VERDICT:** Across both bounded samples (1000 rows each, from the most-recent-by-creation-time
end and the lexicographically-first-by-period end of the index), only two `period` values appear:
`"hourly"` and `"daily"` — matching `convex/schema.ts:955`'s doc-comment exactly. No third value
surfaced in either sample. **This is not exhaustive**, stated honestly per the orchestrator's
instruction: neither sample specifically probed the middle of the period-alphabetical range
(a hypothetical value sorting between `"daily"` and `"hourly"`, e.g. `"day"` or `"daily2"`) nor
values sorting immediately past `"hourly"` outside the most-recent-1000-by-creation-time window.
Given `period` is an unenforced bare string in the schema, this bounded result is evidence, not
proof, that no third value exists anywhere in the table.

---

## Bounding and mutation discipline (self-check against this plan's hard limits)

- No probe in this file used `take` greater than 1000.
- No probe returned `SystemTimeoutError`; none was retried at a larger `take`.
- No write, patch, delete, or bulk operation was issued against any table.
- `npx convex import` was not run.
- `npx convex env list` was not run.
- The retention cron (`retention:startNightlyPrune`) was not hand-triggered.
- No `.env` file was read, cat'd, sourced, or grepped.

## Credential-shape scan (run before commit)

`grep -inE "sk_[A-Za-z0-9]|sb_[A-Za-z0-9]|gho_[A-Za-z0-9]|Bearer [A-Za-z0-9]|convex-self-hosted\|" .planning/phases/110-convex-durability/110-DUR-EVIDENCE.md` — reported below in the commit-time verification; no match expected since no `--admin-key`/`--url`-with-key argument was ever constructed in any command in this file (the `--env-file <path>` invocation shape never places a credential value on the command line).

---

*Task 1 of `110-04-PLAN.md` — pre-deploy baseline captured. Task 2 (operator authorization) and
Task 3 (deploy + post-deploy readback) have NOT started. Nothing has been deployed.*
