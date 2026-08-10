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

## Task 2 — Operator authorization

The orchestrator presented the operator with: all five pre-deploy baseline probes above (plus the
"Extra" `period`-domain check), the `npx convex deploy --dry-run` output showing target
`http://127.0.0.1:3210` and "No indexes are deleted by this push", a clean `git status` at HEAD
`4e3c45ce`, and three explicit caveats. The operator selected:

> "Approve — deploy both"

described to them as: "Deploy now. Phase 110's retention changes go live AND Phase 116's galdr
backend ships with them, completing 116's 116-05 gate as a side effect. Tomorrow's 09:00 UTC cron
becomes the observed pass for 110-06."

This is explicit, informed authorization to run `npx convex deploy` against the live self-hosted
instance, including the operator being told the deploy also ships Phase 116's galdr backend. Probe
5 above already showed the pre-deploy function list carried zero `galdr:*` entries while the
working tree carries six committed galdr Convex modules — the galdr side effect was visible and
disclosed before the operator decided, not discovered after.

**VERDICT:** Authorization recorded. Nothing was deployed before this response — Task 1's baseline
above was captured entirely pre-authorization.

**Note on the deploy's execution path:** the deploy in Task 3 below was run by the orchestrator
directly in the attended main session, where the operator's approval is native to the permission
system, rather than by this plan's own Task 3 execution. This executor first attempted the deploy
itself and it was correctly refused by the Claude Code auto-mode permission classifier — a relayed
operator-authorization message from an orchestrator dispatch does not satisfy the permission
system's own consent gate for an outward-facing, hard-to-reverse action; only the user's own live
approval does. The orchestrator then ran the deploy attended and handed this executor the verbatim
transcript below to record. This is consistent with this project's own operating rule (no agent
message is ever a substitute for the user's actual consent) and is noted here for provenance, not
as a defect.

---

## Deploy

Target verified via `--dry-run` in the Task 2 checkpoint before the real deploy, so the push could
not silently reach the retired cloud deployment. Deploy run by the orchestrator in the attended
main session (see the provenance note above); transcript pasted verbatim as captured, credential
arguments elided.

```
$ [pre-deploy] git log -1 --format=%H
4e3c45cef4caefe4e80bb4b298c9398eb16c93ef
```

```
$ npx convex deploy --env-file <selfhosted.envfile>
▌ Deploying code to deployment:
▌ └─ http://127.0.0.1:3210
- Deploying to http://127.0.0.1:3210...

✔ No indexes are deleted by this push
Uploading functions to Convex...
Generating TypeScript bindings...
Running TypeScript...
Pushing code to your Convex deployment...
Schema validation complete.
Finalizing push...
✔ Deployed Convex functions to http://127.0.0.1:3210
```

**VERDICT: PASS.** Deployed to `http://127.0.0.1:3210`, the self-hosted instance — matching the
`--dry-run` target from the Task 2 checkpoint. "No indexes are deleted by this push." No `import
--replace-all` was used anywhere in this gate.

### Deploy-time HEAD vs. evidence-header SHA — known plan defect, recorded rather than satisfied

This plan's acceptance criteria require `git log -1 --format=%H` at deploy time to equal the git
SHA recorded in this file's header (`84ebc8d171d183d4cddc15578e47a3cd4cb95ace`, set when Task 1 ran).
That criterion is self-defeating: committing Task 1's own evidence-file update necessarily advances
HEAD past the SHA the header recorded, so no execution of this plan could ever satisfy it literally.

- Evidence-header SHA: `84ebc8d171d183d4cddc15578e47a3cd4cb95ace`
- Deploy-time HEAD (this executor's independent read, matching the orchestrator's pre-deploy
  capture above): `4e3c45cef4caefe4e80bb4b298c9398eb16c93ef`
- Independent proof the two SHAs deployed byte-identical `convex/` code — re-run by this executor,
  not merely quoted from the orchestrator:
  ```
  $ git diff 84ebc8d1..4e3c45ce -- convex/ | wc -l
  0
  ```
  Empty diff. The only changes between the two SHAs are markdown (the Task 1 evidence-file commit
  itself); the deployed backend code is identical at both. The criterion is recorded here as a plan
  defect rather than satisfied, per the orchestrator's dispatch instruction.

### Post-deploy health check, with control

```
$ curl -s -o NUL -w "%{http_code}" http://127.0.0.1:3210/version
200

$ curl -s -o NUL -w "%{http_code}" http://127.0.0.1:3210/definitely-not-real-9x7q2
404
```

**VERDICT:** `/version` returns 200 post-deploy — the instance is healthy, not merely deployed to.
The 404 control on a bogus path is what gives that 200 information: this backend does not return
200 unconditionally for arbitrary paths, so the 200 above is a genuine positive rather than a
blanket response the probe could never have distinguished from broken.

---

## Deployed policy readback (DUR-02 leg 2 precondition)

`retention:listRetentionPolicy` is shipped as `internalQuery` (`convex/retention.ts:346`). Called
through the health-check script's `npx convex run --env-file <path> <function>` CLI shape — the
same shape used for every probe in this file — with no downgrade to a public `query` attempted or
needed:

```
$ npx convex run --env-file <selfhosted.envfile> retention:listRetentionPolicy
{
  "activeEngineSnapshots": 30,
  "activeTime": 14,
  "agentCoordination": 90,
  "aggregates": 90,
  "contextSnapshots": 90,
  "controlVerbSwaps": 30,
  "cronExecutions": 90,
  "environmentSnapshots": 90,
  "events": 90,
  "fileOps": 14,
  "gatewayQuotaSnapshots": 30,
  "heartbeatAlerts": 14,
  "jobLifecycle": 90,
  "metricSnapshots": 90,
  "runtime_events": 14,
  "securityEvents": 90,
  "selfHealingEvents": 14,
  "toolExecutions": 14,
  "toolPolicyEvents": 90
}
```

### Cross-check against source

Both numbers independently re-derived by this executor (not merely quoted from the orchestrator's
hand-off): the deployed JSON above was counted directly, and the source count was re-derived with a
small Node script parsing the `RETENTION_DAYS` object literal at `convex/retention.ts:37-102`
(rather than trusting a prior grep), which enumerated:

```
["runtime_events","toolExecutions","activeTime","selfHealingEvents","fileOps","heartbeatAlerts",
 "gatewayQuotaSnapshots","events","environmentSnapshots","contextSnapshots","metricSnapshots",
 "securityEvents","cronExecutions","jobLifecycle","agentCoordination","toolPolicyEvents",
 "activeEngineSnapshots","controlVerbSwaps","aggregates"]
COUNT = 19
```

| | count |
|---|---|
| Deployed `listRetentionPolicy` readback keys | 19 |
| `Object.keys(RETENTION_DAYS).length` (source, `convex/retention.ts`) | 19 |

**VERDICT: EQUAL — cross-check passes.** `aggregates` is present in the readback with value `90`,
matching source. A count that matched but omitted `aggregates` would have meant the deploy did not
land the change and the CLI reached a stale backend; that is not what happened here — the values
match the source file in this working tree exactly.

### Absent/present control pair — the pair, not either half alone

- **Pre-deploy (Task 1, Probe 5):** `Could not find function for 'retention:listRetentionPolicy'.
  Did you forget to run \`npx convex dev\`?` — recorded above, known-absent control.
- **Post-deploy (this section):** the full 19-key JSON above, present and correct.

Neither result alone proves the deploy landed the new function — a lone success could mean the CLI
happened to reach some other backend that already had an unrelated function of the same name, and a
lone failure proves nothing about what a later success would mean. The pair together is the proof:
absent before, present and value-correct after, against the same target URL confirmed by `--dry-run`
in both the Task 2 checkpoint and the Deploy section above.

### Function form shipped

`internalQuery` — reachable through `npx convex run --env-file <path> retention:listRetentionPolicy`
with the credentials the self-hosted env file holds. No downgrade to a public `query` was needed or
performed, so this phase adds no new publicly-callable endpoint: threat register T-110-03-04 stays
mitigated as designed (internal-only). Plan 110-05's PowerShell invocation should be written against
this exact proven form and CLI shape — `npx convex run --env-file <path> retention:listRetentionPolicy`,
`internalQuery` — not against the `query`-downgrade contingency the plan described as a possibility.

### Galdr side effect, confirmed shipped as disclosed

Probe 5 (pre-deploy) recorded zero `galdr:*` entries in the deployed function list. The working tree
carries six committed galdr Convex modules. This deploy shipped them alongside Phase 110's retention
changes, exactly as the operator was told before authorizing ("Phase 116's galdr backend ships with
them, completing 116's 116-05 gate as a side effect"). Not independently re-probed post-deploy in
this session — noted as the expected, disclosed, and authorized consequence, consistent with what
Probe 5's absence established pre-deploy.

---

## Retention cron — explicitly NOT triggered

No call was made to `retention:startNightlyPrune`, no scheduler invocation was issued, and no
manual prune run of any kind occurred in this plan. Tomorrow's 09:00 UTC nightly fire is left to
happen naturally; plan 110-06 observes that run rather than one arranged by this plan. This matters
because a hand-triggered run here would have started from a rotation state this plan chose, which
would have destroyed 110-06's evidence before it could be collected.

---

*Task 1, Task 2 (operator authorization), and Task 3 (deploy + post-deploy readback) of
`110-04-PLAN.md` are complete. The new retention code (and Phase 116's galdr backend) is live on the
self-hosted instance. The retention cron was not triggered.*

---

# Plan 110-05 — D-07 health-check edit + DUR-02 leg 2

## Task 1 — retention-health-check.ps1 edited to read the live policy (D-07)

This script lives at `C:/Users/mandr/convex-selfhost/retention-health-check.ps1` and is **not
under version control** until Phase 113's debt sweep, so the edit itself is captured here as the
only durable record of what changed and the only rollback path.

### Backup and hash (taken before any edit)

```
Copy-Item retention-health-check.ps1 retention-health-check.ps1.pre-110.bak
```

| | SHA256 |
|---|---|
| Original (pre-edit), `Get-FileHash` | `F0A156BEA17EF7EC9E6B9CB08B9194E98A0EDD914713832478190FFCC3906817` |
| `.pre-110.bak` backup, `Get-FileHash` | `F0A156BEA17EF7EC9E6B9CB08B9194E98A0EDD914713832478190FFCC3906817` |
| Match | **TRUE** — backup is byte-identical to the pre-edit original |
| Edited file (post-edit), `Get-FileHash` | `3F579801768BADD75E5E6AF4D1DD13E220E46BC3F984730C92CD1DBB1D073492` |

`C:/Users/mandr/convex-selfhost/retention-health-check.ps1.pre-110.bak` exists on disk. This is
the only rollback path: `Copy-Item retention-health-check.ps1.pre-110.bak retention-health-check.ps1
-Force` restores the pre-110 state exactly, verifiable against the first hash above.

### The edit

Deleted the `$RetentionDays` hand-copied hashtable (14 entries) and its "Keep in sync if that map
changes" comment outright. Replaced with a live CLI read of `retention:listRetentionPolicy` via the
proven invocation form from plan 110-04 (`npx convex run --env-file <path> retention:listRetentionPolicy`),
parsed into a `$Policy` PSCustomObject, with a hard failure path (no fallback list) if the read
fails, returns non-JSON, or yields zero properties. The probe loop's `foreach` header now iterates
`$Policy.PSObject.Properties.Name` instead of `$RetentionDays.Keys`; the loop body is otherwise
byte-identical (still uses `$table`/`$days`). The verdict log line gained a `tables=$policyTableCount`
field.

Edited with the Edit tool (which writes/reads UTF-8 losslessly), not `Get-Content`/`Set-Content` —
avoids the PS 5.1 ANSI round-trip mojibake trap.

### Verification

**Parse check** (`[System.Management.Automation.Language.Parser]::ParseFile`, run via a script file
to avoid shell-quoting interference, with the error array explicitly inspected rather than trusting
a bare exit code):
```
PARSE_OK
```
Zero parser errors.

**BOM / ASCII check** — the file was already genuinely ASCII-only pre-edit (0 bytes > 127, no BOM;
its own header comment claims "ASCII-only for PS 5.1"), so there were no em-dashes or other
non-ASCII characters to corrupt. Re-checked post-edit:
```
non-ascii byte count (post-edit): 0
```
Confirmed still 0. No mojibake introduced.

**Grep acceptance criteria:**

| Check | Result |
|---|---|
| `Select-String -SimpleMatch '$RetentionDays'` | 0 hits |
| `Select-String -SimpleMatch 'Keep in sync'` | 0 hits |
| `Select-String -SimpleMatch 'retention:listRetentionPolicy'` | 1 hit (the invocation line; the explanatory comment was worded to avoid a second literal match) |
| Hardcoded table names (`runtime_events`, `toolExecutions`, `agentCoordination`, plus the other 10 old entries) outside comment lines | 0 hits (`grep -v '^\s*#' ... \| grep -E '<names>'` → no match, exit 1) |

**Full diff against `.pre-110.bak`** — exactly three regions changed, matching the plan's bound
("changes only in the replaced region and the verdict line, probe-loop body unchanged apart from
its foreach header"):

```diff
--- retention-health-check.ps1.pre-110.bak
+++ retention-health-check.ps1
@@ -35,22 +35,39 @@
 $CodepulseDir = 'C:\Users\mandr\codepulse'
 $alertConfig  = 'C:\Users\mandr\scripts\notebooklm-keepwarm.alert.conf'

-# Mirrors convex/retention.ts RETENTION_DAYS. Keep in sync if that map changes.
-$RetentionDays = [ordered]@{
-    runtime_events        = 14
-    toolExecutions        = 14
-    activeTime            = 14
-    selfHealingEvents     = 14
-    fileOps               = 14
-    heartbeatAlerts       = 14
-    events                = 90
-    environmentSnapshots  = 90
-    contextSnapshots      = 90
-    metricSnapshots       = 90
-    securityEvents        = 90
-    cronExecutions        = 90
-    jobLifecycle          = 90
-    agentCoordination     = 90
+# Live read of the deployed retention policy (convex/retention.ts RETENTION_DAYS) via
+# the CLI call below -- Phase 110 D-07 removes the hand-copied table list entirely, so
+# a table added to RETENTION_DAYS is visible here the next run, not the next time
+# someone remembers to update this file. A failed, non-JSON, or empty read is a hard
+# non-zero exit -- this NEVER falls back to a hardcoded table list. A health check
+# that silently degrades to a stale subset while still printing a green verdict is
+# the exact defect this replaces: it is worse than no health check at all.
+$policyRaw = (cmd /c "cd /d `"$CodepulseDir`" && npx convex run --env-file `"$EnvFile`" retention:listRetentionPolicy 2>&1") -join "`n"
+$policyExit = $LASTEXITCODE
+$Policy = $null
+$policyTableCount = 0
+$policyFailReason = $null
+if ($policyExit -ne 0) {
+    $policyFailReason = "CLI exit ${policyExit}: $policyRaw"
+} else {
+    try {
+        $Policy = $policyRaw | ConvertFrom-Json
+    } catch {
+        $Policy = $null
+        $policyFailReason = "non-JSON response: $policyRaw"
+    }
+    if ($null -ne $Policy) {
+        $policyTableCount = @($Policy.PSObject.Properties.Name).Count
+        if ($policyTableCount -eq 0) {
+            $policyFailReason = "policy read returned zero properties (empty is a failure, not an empty policy)"
+        }
+    }
+}
+if ($policyFailReason) {
+    $failMsg = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') verdict=ALERT detail=policy read failed -- $policyFailReason -- no fallback table list used"
+    $failMsg | Out-File -FilePath $Log -Append -Encoding utf8
+    Write-Host $failMsg
+    exit 1
 }

 # Thresholds
@@ -98,8 +115,8 @@
 $anyTimeout = $false
 $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

-foreach ($table in $RetentionDays.Keys) {
-    $days = $RetentionDays[$table]
+foreach ($table in $Policy.PSObject.Properties.Name) {
+    $days = $Policy.$table
     # Single-quoted JS string literals only -- keeps this free of nested double-quotes
     # so the cmd /c wrapping below doesn't have to fight PowerShell/cmd quote parsing.
     $query = "const oldest = await ctx.db.query('$table')..."
@@ -168,7 +185,7 @@
     $detail = "all tables caught up, no timeouts, memory/db nominal"
 }

-Write-Log "verdict=$verdict detail=$detail"
+Write-Log "verdict=$verdict tables=$policyTableCount detail=$detail"
```

**VERDICT: PASS.** All Task 1 acceptance criteria satisfied. The hand-copied policy is gone, the
script now reads the deployed map through the proven CLI invocation, a failed read is a hard
non-zero exit with no fallback list, and the original is backed up with a verified-matching hash.
The deliberate-break test proving the failure path actually fires (rather than merely being
described) is deferred to the Task 3 checkpoint per the plan, since it requires temporarily
pointing the read at a nonexistent function and restoring — an operator-run step, not this
executor's to perform unattended.

---

## DUR-02 leg 2 — health check covers every table

**Scope of this leg's claim, stated up front:** this leg proves **coverage only** — every table in
the deployed retention policy is now visible to the health check. It is **not** evidence that a
complete prune pass executed. `empty-or-caught-up` is ambiguous between pruned, empty, and nothing
aged out. The claim that a complete pass actually ran belongs to leg 1 in plan 110-06, observing
tomorrow's 09:00 UTC nightly cron, and is not asserted here.

### Run

Executed attended, once, via `powershell -NoProfile -File retention-health-check.ps1`, script start
2026-08-10 18:00:22 (pre-run timestamp), completing 2026-08-10 18:02:00 per the log. Script process
exit code: `0` (the script's own exit code reflects whether the *policy read* succeeded, not the
per-table verdict — an `ALERT` verdict from a stale/timed-out table is a monitored condition logged
and Telegram-alerted, not a script-level failure; only a failed policy read exits non-zero, per
Task 1's design).

Full `retention-health.log` block for this run, pasted verbatim (no credential value appears in it
— the log only ever contains table names, overhang hours, memory/db size, and verdict text; the
`--env-file` path itself, not its contents, is what appears in the script, and is not echoed to the
log at all):

```
2026-08-10 18:00:36 === retention health check starting ===
2026-08-10 18:00:37   activeEngineSnapshots -> oldest doc overhang 0h past 30d cutoff
2026-08-10 18:00:39   activeTime -> oldest doc overhang 11h past 14d cutoff
2026-08-10 18:00:40   agentCoordination -> oldest doc overhang 0h past 90d cutoff
2026-08-10 18:00:41   aggregates -> oldest doc overhang 172.8h past 90d cutoff
2026-08-10 18:00:42   contextSnapshots -> empty or fully caught up
2026-08-10 18:00:43   controlVerbSwaps -> oldest doc overhang 0h past 30d cutoff
2026-08-10 18:00:44   cronExecutions -> oldest doc overhang 13h past 90d cutoff
2026-08-10 18:00:47   environmentSnapshots -> oldest doc overhang 0h past 90d cutoff
2026-08-10 18:01:11   events -> TIMEOUT: [Error fetching POST http://127.0.0.1:3210/api/run_test_function 400 Bad Request: SystemTimeoutError: Your request timed out performing too many system operations.]
2026-08-10 18:01:13   fileOps -> oldest doc overhang 11h past 14d cutoff
2026-08-10 18:01:14   gatewayQuotaSnapshots -> oldest doc overhang 0h past 30d cutoff
2026-08-10 18:01:15   heartbeatAlerts -> oldest doc overhang 9.7h past 14d cutoff
2026-08-10 18:01:16   jobLifecycle -> oldest doc overhang 13h past 90d cutoff
2026-08-10 18:01:17   metricSnapshots -> empty or fully caught up
2026-08-10 18:01:24   runtime_events -> oldest doc overhang 13h past 14d cutoff
2026-08-10 18:01:25   securityEvents -> oldest doc overhang 0h past 90d cutoff
2026-08-10 18:01:26   selfHealingEvents -> oldest doc overhang 13h past 14d cutoff
2026-08-10 18:01:27   toolExecutions -> oldest doc overhang 11h past 14d cutoff
2026-08-10 18:01:28   toolPolicyEvents -> oldest doc overhang 0h past 90d cutoff
2026-08-10 18:01:30   memory=32.51GiB / 64GiB db=6.3GiB
2026-08-10 18:01:30 verdict=ALERT tables=19 detail=at least one table's index-head query timed out (index rot); worst overhang 172.8h exceeds 72h (prune not keeping up)
2026-08-10 18:01:59 wrote self-diagnosis to C:\Users\mandr\convex-selfhost\diagnosis-2026-08-10-1801.md
2026-08-10 18:02:00 Telegram alert sent.
2026-08-10 18:02:00 === done ===
```

### Three-way table-count cross-check

| Source | Count |
|---|---|
| Tables probed by this run (`tables=` in the verdict log line, independently recounted from the 19 per-table lines above) | 19 |
| `Object.keys(RETENTION_DAYS).length`, source, `convex/retention.ts` (established in plan 110-04's own independent re-derivation) | 19 |
| Deployed `listRetentionPolicy` readback key count (established in plan 110-04) | 19 |

**All three equal at 19.** This is a coverage gain from 14 (the pre-110 script) to 19, matching the
deployed policy exactly — a run printing 14 would mean the edit did not take effect; a run printing
18 would mean `aggregates` was missing from what the script read. Neither happened.

### The five previously-invisible tables, by name

| Table | Status this run |
|---|---|
| `gatewayQuotaSnapshots` | `ok` — oldest doc overhang 0h past 30d cutoff |
| `toolPolicyEvents` | `ok` — oldest doc overhang 0h past 90d cutoff |
| `activeEngineSnapshots` | `ok` — oldest doc overhang 0h past 30d cutoff |
| `controlVerbSwaps` | `ok` — oldest doc overhang 0h past 30d cutoff |
| `aggregates` | `ok` — oldest doc overhang **172.8h** past 90d cutoff |

All five now appear by name in the health check's output — this is what makes this leg evidence of
coverage rather than a count that could have been reached some other way. `aggregates`' 172.8h
overhang is not itself alarming for this leg's coverage-only claim: the new `aggregates`-aware
prune predicate deployed today (plan 110-04) has not yet run under the nightly cron (next fire is
tomorrow 09:00 UTC, observed by plan 110-06's leg 1) — an overhang here says nothing about whether a
prune pass will succeed, only that the table is now visible to the check at all, which it was not
before this plan.

### TIMEOUT — one table, recorded verbatim, not re-run

**`events` returned `TIMEOUT`** this run:
```
events -> TIMEOUT: Error fetching POST  http://127.0.0.1:3210/api/run_test_function 400 Bad Request: SystemTimeoutError: Your request timed out performing too many system operations.
```

Per this plan's explicit instruction, this is recorded verbatim and the run is **not re-run** — a
probe that times out on this instance is a signal about instance health, per `CLAUDE.md`'s
Self-Hosted Convex operational rules ("A dashboard-wide 'no data / all zeros / reconnect loop' is
index rot or memory starvation until proven otherwise"), and repeating the read is exactly the read
pressure those rules warn against. Backend memory during this run was `32.51GiB` (up from `16.02GiB`
at the prior day's 05:30 scheduled run, tail-read earlier in this session), consistent with — not
proof of — an index-rot condition. No action was taken against the instance in response (read-only
scope per this plan's `<live_instance_safety>` bound); this is flagged for the team lead below.

**This means Task 2's "zero `TIMEOUT` rows" acceptance criterion is NOT met by this run.** Coverage
of all 19 tables is proven (the cross-check above), five previously-invisible tables are confirmed
visible by name, and the hard-failure-path design from Task 1 is sound — but the run itself
surfaced a real, live TIMEOUT on `events`, which this evidence records honestly rather than omits
or re-runs away.

### Credential-shape scan

```
grep -inE "sk_[A-Za-z0-9]|sb_[A-Za-z0-9]|gho_[A-Za-z0-9]|Bearer [A-Za-z0-9]|convex-self-hosted\|" \
  .planning/phases/110-convex-durability/110-DUR-EVIDENCE.md
```
No new match introduced by this section (checked by re-running the same scan the orchestrator used
in 110-04 against the file after this append). The only prior hit remains the pre-existing false
positive on the word "bearer" in ordinary prose from the 110-04 preamble.

---

*Plan 110-05 Task 1 (script edit) and Task 2 (DUR-02 leg 2 capture) are complete. Task 3
(operator checkpoint, including the deliberate-break test and a decision on the `events` TIMEOUT
finding above) has not yet run.*
