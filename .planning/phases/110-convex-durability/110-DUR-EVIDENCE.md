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

### `events` TIMEOUT — pre-existing condition, not a regression from this edit (orchestrator follow-up)

The orchestrator checked whether the 14→19 table change caused the TIMEOUT above. It did not.
`retention-health.log` history, pasted verbatim:

```
2026-07-31 05:30:40 verdict=WATCH detail=memory 25.81GiB
2026-08-01 05:30:48 verdict=WATCH detail=memory 35.47GiB
2026-08-02 05:30:39 verdict=WATCH detail=memory 37.52GiB
2026-08-03 05:30:42 verdict=ALERT detail=memory 41.8GiB exceeds 40GiB
2026-08-04 05:30:52 verdict=ALERT detail=at least one table's index-head query timed out (index rot); memory 41.7GiB exceeds 40GiB
2026-08-05 05:30:43 verdict=ALERT detail=at least one table's index-head query timed out (index rot); memory 45.95GiB exceeds 40GiB
2026-08-06 05:30:38 verdict=WATCH detail=memory 25.34GiB
2026-08-07 05:30:41 verdict=OK detail=all tables caught up, no timeouts, memory/db nominal
2026-08-08 05:30:47 verdict=OK detail=all tables caught up, no timeouts, memory/db nominal
2026-08-09 05:30:47 verdict=OK detail=all tables caught up, no timeouts, memory/db nominal
2026-08-10 05:30:49 verdict=OK detail=all tables caught up, no timeouts, memory/db nominal
2026-08-10 18:01:30 verdict=ALERT tables=19 detail=at least one table's index-head query timed out (index rot); worst overhang 172.8h exceeds 72h (prune not keeping up)
```

**VERDICT:** Index-head timeouts are a pre-existing condition on this instance that tracks memory
pressure — two prior occurrences, `2026-08-04` at 41.7 GiB and `2026-08-05` at 45.95 GiB, both
before any Phase 110 code existed. They are not a regression introduced by probing five more
tables. The 08-06 → 08-10 runs were clean at lower memory.

Memory samples, each taken directly by the orchestrator via `docker stats --no-stream`, except the
05:30 figure which is the health log's own:

```
05:30  16.02 GiB   (health log's OK line)
16:44  23.57 GiB
18:00  32.51 GiB   (during the Task 2 run)
18:05  32.51 GiB   (flat — plateaued, not runaway)
```

Organic growth at the day's measured ~1.04 GiB/h accounts for only ~1.3 GiB of the ~8.9 GiB jump
between 16:44 and 18:00. The wave-3 `npx convex deploy` and this plan's 19-probe run both fall in
that window. **This is recorded as correlation with a plausible mechanism, not causation** — no
experiment isolated it, and none was funded. Container limit is 64 GiB; the instance has run at
45.95 GiB before without incident, and `ConvexNightlyRestart` fires at 02:00.

**Part of this ALERT is the check working as designed.** `aggregates` was *structurally invisible*
to every health check that ever ran before tonight — a table that cannot be seen cannot be alerted
on — so this is the first time any overhang on it has been observable at all.

**CORRECTION (2026-08-10, written after the above and before this file was finalised).** An earlier
version of this paragraph said the 172.8h overhang was "expected — the new predicate has not yet
run under cron," which implies it clears after the first nightly prune. **That is wrong**, and the
error is mine (the orchestrator's), not the executor's. Re-derived from this file's own baseline
probes:

```
retention window                  : 90 days
oldest hourly row past the cutoff : 172.8 h   <- prunable; removed by tomorrow's prune
oldest daily  row past the cutoff : 165.0 h   <- PROTECTED FOREVER by PRUNE_PREDICATES.aggregates
health check reported             : 172.8 h
```

Today's 172.8h figure matches the oldest **hourly** row exactly, so it is currently reporting a
genuinely prunable backlog. But the health check measures *the oldest document in the table*, not
*the oldest document the pruner would delete*. Once tomorrow's prune removes the aged hourly rows,
the oldest remaining document becomes the oldest **daily** row — still 165.0h past the cutoff, and
protected in perpetuity by the very predicate this phase shipped. The ALERT therefore does **not**
clear. It persists and grows by 24h every day, forever.

This is a real defect that Phase 110 *introduced*: making a table period-aware while its health
probe stayed period-blind guarantees a permanent false ALERT — the exact "green (or red) nobody
re-examines" failure mode that plan 110-05 exists to eliminate, arriving through a different door.
It was found by a concurrent session working in this checkout, which is building a
`summarizeOverhangProbe` / `oldestPrunableDoc` fix that measures lag against the predicate rather
than against the index head. That work is NOT part of Phase 110, is not deployed, and is not
covered by this evidence file.

Consequence for tomorrow's plan `110-06`: an `aggregates` ALERT persisting after a successful prune
is **expected under the currently deployed code** and must NOT be read as the prune having failed.
DUR-01's actual pass/fail signal remains the one this file's baseline established — the oldest
`period:"daily"` `_creationTime` must not move forward, and the oldest `period:"hourly"` one must.

### FOLLOW-UP (2026-08-11, plan 110-06) — the "does not clear, persists and grows" claim above is now itself stale

The block above is preserved verbatim above this note because it records what was believed at the
time and the mechanism it describes (index-head overhang measurement is period-blind, so a
permanently-protected daily row keeps a naive check ALERT-red forever) was **correct as a diagnosis
of the code that existed on 2026-08-10**. It is no longer an accurate description of the deployed
system as of this plan.

A concurrent session working in this same checkout shipped and deployed the fix the paragraph above
describes as "not part of Phase 110": commit `96a1df68` (2026-08-10 18:37:01 -0400,
`fix(retention): measure prunable lag, not index age, in the health probe`) adds
`retention:oldestPrunableDoc` (`convex/retention.ts:379-418`) and `summarizeOverhangProbe`
(`convex/retentionCursor.ts:203-231`), which measure the oldest doc the pruner would actually
**delete** — reusing `PRUNE_PREDICATES` and `partitionBatchForPrune`, the same objects `pruneBatchV3`
runs on — rather than the oldest doc in the table outright. `retention-health-check.ps1` was updated
to call it. This landed and deployed the same evening this correction paragraph was written, so the
paragraph was already stale within hours of being committed.

Verified live by this plan (110-06), re-reading `retention-health.log` directly rather than trusting
either the original claim or this correction on its own:

```
2026-08-11 05:30:09   aggregates -> caught up (nothing past the 90d cutoff that the pruner may delete)
...
2026-08-11 05:30:26 verdict=OK tables=19 detail=all tables caught up, no timeouts, memory/db nominal
2026-08-11 05:30:26 OK -- no Telegram alert sent (worst overhang 0.5h, mem 17.81GiB)
```

The `aggregates` ALERT **did in fact clear** — it reads `caught up`, and the run's overall verdict is
`OK`, not `ALERT`. The phrasing itself ("caught up (nothing past the ... cutoff **that the pruner may
delete**)") is the predicate-aware wording `summarizeOverhangProbe` introduces; the pre-fix script
only ever said "empty or fully caught up" with no such qualifier (compare the 2026-08-10 18:00 run
pasted above in DUR-02 leg 2). This is independent textual confirmation the new probe is the one
that ran, not merely that the alert happened to go quiet.

Two things NOT to conclude from this: (1) `96a1df68` is not part of Phase 110's plan set and this
plan does not claim it as Phase 110 work — it is recorded here only because it falsifies a claim
Phase 110's own evidence file made; (2) the ALERT clearing is not, by itself, evidence that a prune
ran successfully — `caught up` is also the reading an empty table would produce. DUR-02 leg 1 below
is what actually proves a complete pass occurred; this note only corrects the earlier claim that the
ALERT could never clear.

---

## Task 3 — Deliberate-break test and operator sign-off

### Operator decision 1 — how DUR-02 leg 2 closes

Presented with: the proven three-way coverage cross-check, the `events` TIMEOUT, the log history
above showing it is pre-existing, and the memory samples. Operator response, verbatim:

```
Record it, re-run clean tomorrow
```

Presented to them as: "Accept leg 2's coverage claim now with the TIMEOUT recorded verbatim and
the log history showing it's pre-existing and memory-correlated, NOT introduced by the edit. Then
take a clean zero-TIMEOUT run tomorrow morning after the 02:00 restart, in the same session as
110-06."

**Leg 2 therefore closes on COVERAGE only.** The zero-`TIMEOUT` acceptance criterion is NOT met by
this run and is not claimed to be. A clean run is deferred to tomorrow morning, after the 02:00
restart clears memory and before/alongside plan `110-06`. This is a recorded deviation from the
plan's acceptance criteria, not a silent pass.

### Operator decision 2 — who runs the break test

Operator chose "I run it, you review the output". The test was run by the orchestrator in the
attended main session. Transcript follows.

### Break test — proving the hard-failure path fires rather than being described

A snapshot was taken of the **edited** script first. Restoring from `.pre-110.bak` would have put
back the *pre-edit* original and silently undone this entire plan — the backup and the rollback
target are not the same file.

```
$ (Get-FileHash -Algorithm SHA256 retention-health-check.ps1).Hash        # edited script, before test
3F579801768BADD75E5E6AF4D1DD13E220E46BC3F984730C92CD1DBB1D073492

$ occurrences of 'retention:listRetentionPolicy' before : 1
$ after injecting the bogus name                        : real 0 / bogus 1
```

```
$ powershell -NoProfile -ExecutionPolicy Bypass -File retention-health-check.ps1

2026-08-10 18:23:52 verdict=ALERT detail=policy read failed -- CLI exit 1: ✖ Failed to run function "retention:definitelyNotARealFunction9x7q2":
Error: [Request ID: bc0a41b6a245d754] Server Error
Could not find function for 'retention:definitelyNotARealFunction9x7q2'. Did you forget to run `npx convex dev`?

Available functions:
[... the CLI's full available-functions list ...] -- no fallback table list used

EXIT CODE: 1
```

**VERDICT:** The hard-failure path is **proven to fire**, not merely described. It emitted the
distinct policy-read-failure verdict naming the policy read as the cause, exited **non-zero**,
probed **zero** tables, and explicitly recorded `no fallback table list used`. A health check that
degraded silently to a stale subset while still printing a verdict is the exact defect `D-07`
exists to remove, and this is the evidence that it cannot happen.

### Restore verification

```
expected (edited script) : 3F579801768BADD75E5E6AF4D1DD13E220E46BC3F984730C92CD1DBB1D073492
actual   (after restore) : 3F579801768BADD75E5E6AF4D1DD13E220E46BC3F984730C92CD1DBB1D073492
                           -> byte-identical

occurrences of 'retention:listRetentionPolicy' after restore : 1
occurrences of the bogus name after restore                  : 0
temp snapshot removed

.pre-110.bak present : True

Get-ScheduledTask ConvexRetentionHealthCheck  -> State = Ready
LastRunTime  8/10/2026 5:30:01 AM
NextRunTime  8/11/2026 5:30:00 AM      (unmodified)
```

**VERDICT:** The script is back to its post-edit state byte-for-byte, the only rollback path
(`.pre-110.bak`) is intact, and the scheduled task was never modified — it will run the edited
script tomorrow at 05:30 on its own.

### Incidental finding

The broken run's "Available functions" list ends with `galdr:list`, `galdr:lookup`,
`galdr:createPrompt`, `galdr:recordUsage` and siblings. This independently confirms the wave-3
deploy shipped Phase 116's galdr backend to the live instance, exactly as the operator was told it
would before they authorized it — recorded here because that side effect was disclosed as part of
the authorization and should be verifiable after the fact rather than taken on trust.

---

*Plan `110-05` complete. DUR-02 leg 2 closed on coverage, with a clean zero-TIMEOUT re-run deferred
to tomorrow morning. DUR-02 leg 1 and the DUR-01 before/after remain open — they belong to plan
`110-06`, which cannot start until the 09:00 UTC cron has fired against the deployed code.*

---

# Plan 110-06 — DUR-02 leg 1 and DUR-01 live confirmation

**Date:** 2026-08-11
**Driver:** Claude Code (sequential executor, plan `110-06`, `autonomous: false`)
**Target:** self-hosted Convex at `127.0.0.1:3210`, reached via `--env-file
C:\Users\mandr\convex-selfhost\selfhosted.envfile` — the same target every prior probe in this file
used. All probes below are read-only: no write, patch, delete, import, or scheduler call was issued
against the live instance in this plan. The retention cron (`retention:startNightlyPrune`) was not
hand-triggered — the 09:00 UTC fire this leg observes happened on its own, before this session
started. No `--push`, `--prod`, or `deploy` flag was passed to any `npx convex` command. `npx convex
env list` was not run.

## DUR-02 leg 1 — a complete pass observed on the running instance

### Source correction: the container-log source is provably unavailable (re-verified independently)

This plan's original Task 1 named `docker logs convex-backend` as the evidence source. The plan was
corrected before this executor started (commits `5b1a0f1a`, `3e190abc`) on the grounds that Convex
UDF `console.log` never reaches container stdout on this self-hosted backend. Rather than transcribe
that correction, every probe behind it was re-run independently in this session, against today's log
tail (not the tail the plan-correction session captured yesterday):

```
=== A: "nightly prune started" ===
0
=== B: "all tables pruned" ===
0
=== C: "done, pruned" ===
0
=== D: "nightly batch cap" ===
0
```

All four of the chain's log strings return **zero** hits from `docker logs convex-backend --tail
20000` (`cmd /c "docker logs convex-backend --tail 20000 2>&1"`, piped through `Select-String
-SimpleMatch`), run fresh in this session.

**Positive control 1 — the retained window covers the 09:00 UTC fire.** The retained tail spans:

```
first line: 2026-08-11T05:55:02.575713Z  ... "POST /runtime-ingest HTTP/1.1" 200 ...
last line:  2026-08-11T12:35:19.959043Z  ... "POST /forge-commands-claim HTTP/1.1" 200 ...
```

— i.e. `05:55:02Z` through `12:35:19Z`, which comfortably contains the entire 09:00–09:20 UTC cron
window. Count of lines timestamped `T09:0x`: **436**. (The window in this session's tail is wider
than the `05:10–12:22` window the plan-correction session recorded yesterday, because container
stdout is a rolling buffer and more log volume has accumulated since — the exact bound moving is
expected and does not weaken the control; what matters is that `T09:0x` lines are present in force,
and they are.)

**Positive control 2 — UDF-adjacent output does reach stdout, but none of it is this chain's
application logs.** `udf|function_log` (case-insensitive) hits: **100**. Sample (first 5), all
backend-internal (isolate memory-carryover restarts, an OCC retry) — not `console.log` from
`convex/retention.ts`:

```
2026-08-11T06:00:57.327106Z  WARN  local_backend: Running without a proxy in release mode -- UDF
  `fetch` requests are unrestricted!
2026-08-11T06:39:52.160851Z  INFO  isolate::client: Restarting Isolate memory_carry_over:
  TooMuchMemoryCarryOver("63.75 MiB", "99 MiB"), last request: "UDF: events.js:listRecentUnified"
2026-08-11T06:44:49.682842Z  INFO  isolate::client: Restarting Isolate memory_carry_over:
  TooMuchMemoryCarryOver("63.15 MiB", "99 MiB"), last request: "UDF: events.js:listRecentUnified"
2026-08-11T06:48:36.541863Z  INFO  isolate::client: Restarting Isolate memory_carry_over:
  TooMuchMemoryCarryOver("63.78 MiB", "99 MiB"), last request: "UDF: docker.js:currentStatus"
2026-08-11T07:01:20.386687Z  WARN  application::application_function_runner: Optimistic
  concurrency control failed (... "forgeHosts" table ...), retrying Udf(forge.js:claimAndUpsertHost)
```

Case-insensitive `retention` hits: **128** — all `database::retention` (Convex's own Rust tombstone
GC module, `go_delete_table_documents`), not this codebase's chain. Sample (first 5):

```
2026-08-11T06:00:57.310431Z  INFO  database::retention: go_delete_table_documents: Deleting
  documents in tablet AWZb63yPJOgyVeU-BQFQsA deleted at timestamp 1784729235689949555
2026-08-11T06:00:57.315032Z  INFO  database::retention: go_delete_table_documents: Deleting
  documents in tablet Avo_C5fUGsiJWpaqxkxQsA deleted at timestamp 1784729235689949555
2026-08-11T06:00:57.315409Z  INFO  cmd_util::env: Overriding DOCUMENT_RETENTION_DELAY to 1800 from
  environment
```

**`npx convex logs --history 3000` returns no queryable history.** Run against the live self-hosted
backend with a 12s process-kill bound (the CLI switches to an interactive streaming tail and does not
exit on its own):

```
- Showing logs of deployment:
  ??? http://127.0.0.1:3210
Watching logs for dev deployment...
```

No historical lines at all — it goes straight to live streaming. There is no queryable log history on
this self-hosted backend to bound with `--since`/`--tail`, confirming the plan-correction's finding
independently.

**Conclusion, re-derived, not transcribed:** the chain's log lines are unrecoverable from container
stdout by any of the three routes tried (raw grep, udf/function_log tag, `npx convex logs --history`),
with two positive controls proving the search itself was capable of finding output when output
exists. The claim moves to a durable record below.

### `_scheduled_functions` probe — the durable record

Window used (independently confirmed against the day's actual UTC boundaries before querying):
`1786438800000`–`1786440000000` ms = `2026-08-11T09:00:00Z`–`2026-08-11T09:20:00Z`.

```
$ npx convex run --env-file <selfhosted.envfile> --inline-query "
    const WINDOW_START = 1786438800000; const WINDOW_END = 1786440000000;
    const rows = await ctx.db.system.query('_scheduled_functions').order('desc').take(1000);
    const pruneRows = rows.filter(r => (r.name||'').includes('pruneBatchV3')
      && r.scheduledTime >= WINDOW_START && r.scheduledTime <= WINDOW_END);
    const tableIndices = [...new Set(pruneRows.map(r => r.args && r.args[0] && r.args[0].tableIndex))].sort((a,b)=>a-b);
    const stateCounts = {};
    for (const r of pruneRows) { const k = r.state ? r.state.kind : 'unknown'; stateCounts[k] = (stateCounts[k]||0)+1; }
    const nonSuccess = pruneRows.filter(r => !r.state || r.state.kind !== 'success')
      .map(r => ({scheduledTime: r.scheduledTime, tableIndex: r.args && r.args[0] && r.args[0].tableIndex, state: r.state}));
    const oldestRowInBoundedSet = rows.length ? rows[rows.length-1].scheduledTime : null;
    return { totalRowsReturnedByBoundedQuery: rows.length, oldestScheduledTimeInBoundedSet: oldestRowInBoundedSet,
      pruneBatchV3CountInWindow: pruneRows.length, distinctTableIndices: tableIndices, stateCounts,
      nonSuccessRows: nonSuccess,
      firstScheduledTime: pruneRows.length ? pruneRows[pruneRows.length-1].scheduledTime : null,
      lastScheduledTime: pruneRows.length ? pruneRows[0].scheduledTime : null };
  "
{
  "distinctTableIndices": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  "firstScheduledTime": 1786438826400,
  "lastScheduledTime": 1786439716219,
  "nonSuccessRows": [],
  "oldestScheduledTimeInBoundedSet": 1786179667042,
  "pruneBatchV3CountInWindow": 268,
  "stateCounts": { "success": 268 },
  "totalRowsReturnedByBoundedQuery": 1000
}
```

Note: `ctx.db.query` refuses system tables directly (`Error: System tables can only be accessed from
db.system.query()`) — `ctx.db.system.query('_scheduled_functions')` is the correct call, confirmed by
a failing first attempt in this session using the wrong form.

**Bound-not-truncated check.** `totalRowsReturnedByBoundedQuery` hit the `take(1000)` ceiling, so
this is a lower-bound read by construction (per this plan's `take` ceiling rule). What makes it
sufficient here: `oldestScheduledTimeInBoundedSet` is `1786179667042` = `2026-08-08T09:01:07.042Z`,
three days before the window start — i.e. the 1000 most-recent scheduled-function rows (descending
order) reach comfortably past the window on both sides without exhausting the bound, so the window
`1786438800000`–`1786440000000` is fully contained inside the returned set, not clipped at either
edge.

**Distinct `tableIndex` coverage.** `[0, 1, 2, ..., 18]` — 19 distinct values, `0..K-1` with `K=19`
(re-derived independently from `convex/retention.ts`'s `RETENTION_DAYS` object literal via a small
Node script parsing it directly: `["runtime_events","toolExecutions","activeTime",
"selfHealingEvents","fileOps","heartbeatAlerts","gatewayQuotaSnapshots","events",
"environmentSnapshots","contextSnapshots","metricSnapshots","securityEvents","cronExecutions",
"jobLifecycle","agentCoordination","toolPolicyEvents","activeEngineSnapshots","controlVerbSwaps",
"aggregates"]`, `COUNT=19` — matching the 19 recorded in plans 110-04/110-05). No gaps.

**Success state.** `stateCounts: { "success": 268 }` — every one of the 268 `pruneBatchV3`
invocations in the window reports `state.kind === "success"`. `nonSuccessRows` is the empty array
`[]`, pasted rather than summarized, per the acceptance criteria: there is nothing else to paste.

**Window timestamps.** `firstScheduledTime` = `1786438826400` = `2026-08-11T09:00:26.400Z`.
`lastScheduledTime` = `1786439716219` = `2026-08-11T09:15:16.219Z`. Both independently converted
(`[DateTimeOffset]::FromUnixTimeMilliseconds(...).UtcDateTime`) in this session, both inside the
09:00–09:20 UTC cron window.

### Rotation cursor — corroboration, presented with its ambiguity, not as standalone proof

`planRotationWrite` (`convex/retentionCursor.ts:269-273`) returns `0` for the `"done"` action AND
returns `tableIndex` for `"cap-reached"` — so a stored value of `0` is, on its own, equally
consistent with "the chain completed the whole 19-table pass" and "the chain hit the nightly cap
while still on table index 0." A bare `value: 0` reading does **not** by itself prove a complete
pass. It becomes decisive only in combination with the `tableIndex` coverage set above: a
cap-at-index-0 run could not have produced invocations at table indices 1 through 18, and the probe
above shows all 19 present. That is the reasoning this leg rests on, stated explicitly rather than
inferred.

The rotation cursor row read in this session (see the DUR-01 section below for the raw query and
full output): `{ "value": 0, "source": "runtime", "updatedAt": 1786439716.834 }`. `updatedAt`
1786439716.834 read as epoch **seconds** = `2026-08-11T09:15:16.834Z` — 0.615s after the window's
own `lastScheduledTime` (`09:15:16.219Z`), consistent with the cursor being patched at the tail end
of the final batch's own mutation.

### Independent corroboration — the post-prune 05:30-local health check

`retention-health.log`, read directly in this session (not quoted from the plan dispatch):

```
2026-08-11 05:30:03 === retention health check starting ===
2026-08-11 05:30:04   memory=17.81GiB / 64GiB db=6.38GiB uptime=Up 3 hours (healthy)
2026-08-11 05:30:06   activeEngineSnapshots -> caught up (nothing past the 30d cutoff that the pruner may delete)
2026-08-11 05:30:07   activeTime -> caught up (nothing past the 14d cutoff that the pruner may delete)
2026-08-11 05:30:08   agentCoordination -> caught up (nothing past the 90d cutoff that the pruner may delete)
2026-08-11 05:30:09   aggregates -> caught up (nothing past the 90d cutoff that the pruner may delete)
2026-08-11 05:30:10   contextSnapshots -> caught up (nothing past the 90d cutoff that the pruner may delete)
2026-08-11 05:30:12   controlVerbSwaps -> caught up (nothing past the 30d cutoff that the pruner may delete)
2026-08-11 05:30:13   cronExecutions -> caught up (nothing past the 90d cutoff that the pruner may delete)
2026-08-11 05:30:14   environmentSnapshots -> caught up (nothing past the 90d cutoff that the pruner may delete)
2026-08-11 05:30:15   events -> caught up (nothing past the 90d cutoff that the pruner may delete)
2026-08-11 05:30:16   fileOps -> caught up (nothing past the 14d cutoff that the pruner may delete)
2026-08-11 05:30:17   gatewayQuotaSnapshots -> caught up (nothing past the 30d cutoff that the pruner may delete)
2026-08-11 05:30:18   heartbeatAlerts -> caught up (nothing past the 14d cutoff that the pruner may delete)
2026-08-11 05:30:19   jobLifecycle -> caught up (nothing past the 90d cutoff that the pruner may delete)
2026-08-11 05:30:20   metricSnapshots -> caught up (nothing past the 90d cutoff that the pruner may delete)
2026-08-11 05:30:21   runtime_events -> oldest PRUNABLE doc overhang 0.5h past 14d cutoff
2026-08-11 05:30:22   securityEvents -> caught up (nothing past the 90d cutoff that the pruner may delete)
2026-08-11 05:30:23   selfHealingEvents -> oldest PRUNABLE doc overhang 0.5h past 14d cutoff
2026-08-11 05:30:25   toolExecutions -> caught up (nothing past the 14d cutoff that the pruner may delete)
2026-08-11 05:30:26   toolPolicyEvents -> caught up (nothing past the 90d cutoff that the pruner may delete)
2026-08-11 05:30:26 verdict=OK tables=19 detail=all tables caught up, no timeouts, memory/db nominal
2026-08-11 05:30:26 OK -- no Telegram alert sent (worst overhang 0.5h, mem 17.81GiB)
2026-08-11 05:30:26 === done ===
```

05:30 ET (local) = 09:30 UTC, 15 minutes after the chain's own last invocation at 09:15:16 UTC. All
19 tables report either `caught up` or a sub-1-hour overhang; `verdict=OK`. This is the control that
rules out the cap-at-index-0 reading: a chain that stopped early on table index 0 would leave tables
1 through 18 with whatever overhang they had accumulated since the last successful pass, and this run
shows none of them do. (The `caught up (... that the pruner may delete)` and `oldest PRUNABLE doc
overhang` phrasing is the predicate-aware wording from `summarizeOverhangProbe`/`oldestPrunableDoc` —
see the amended CORRECTION note above for why that matters for `aggregates` specifically.)

### Verdict

**Complete pass, starting at index 0, covering all 19 of 19 tables.** The durable
`_scheduled_functions` record shows 268 `pruneBatchV3` invocations inside the 09:00–09:20 UTC cron
window, spanning table indices `0` through `18` with no gaps, every one reporting
`state.kind === "success"`, timestamped `09:00:26.400Z` through `09:15:16.219Z` — inside the fire
window. The rotation cursor's `value: 0` is corroboration, not standalone proof, and is decisive only
together with the coverage set (a cap-at-index-0 run could not have produced indices 1–18). The
independent post-prune health check at 09:30 UTC shows all 19 tables caught up or within a sub-hour
overhang, which a chain that stopped early could not have produced either. This leg is closed on a
durable record; the container-log source was sought, found provably unavailable with controls, and
not used.

---

## DUR-01 live confirmation — daily rows survived, hourly rows aged out

All three baseline probes from plan 110-04 re-run byte-identical (same index, same predicate, same
`take`) in this session.

### Probe 1 — oldest `period:"daily"` row (D-01 hard-fail instrument)

```
$ npx convex run --env-file <selfhosted.envfile> --inline-query "const rows = await ctx.db.query('aggregates').withIndex('by_period_bucket', q => q.eq('period','daily')).order('asc').take(1); return rows.length ? { bucket_start: rows[0].bucket_start, _creationTime: rows[0]._creationTime, metric_type: rows[0].metric_type } : { empty: true };"
{
  "_creationTime": 1778029200021.6772,
  "bucket_start": 1777939200,
  "metric_type": "events"
}
```

| | Plan 110-04 baseline (2026-08-10, pre-deploy) | This run (2026-08-11, post-prune) |
|---|---|---|
| `_creationTime` | `1778029200021.6772` | `1778029200021.6772` |
| `bucket_start` | `1777939200` | `1777939200` |
| `metric_type` | `events` | `events` |

**IDENTICAL — byte-for-byte the same document.** The oldest daily row did not move forward.
**HARD GATE PASSED.**

### Probe 2 — oldest `period:"hourly"` row (control: opposite failure)

```
$ npx convex run --env-file <selfhosted.envfile> --inline-query "const rows = await ctx.db.query('aggregates').withIndex('by_period_bucket', q => q.eq('period','hourly')).order('asc').take(1); return rows.length ? { bucket_start: rows[0].bucket_start, _creationTime: rows[0]._creationTime, metric_type: rows[0].metric_type } : { empty: true };"
{
  "_creationTime": 1782314125926.0588,
  "bucket_start": 1777996800,
  "metric_type": "tokens"
}
```

| | Plan 110-04 baseline (2026-08-10, pre-deploy) | This run (2026-08-11, post-prune) |
|---|---|---|
| `_creationTime` | `1778001143716.9412` (`2026-05-05T17:12:23.717Z`) | `1782314125926.0588` (`2026-06-24T15:15:25.926Z`) |
| `bucket_start` | `1777996800` | `1777996800` |
| `metric_type` | `cost` | `tokens` |

`_creationTime` **moved forward by ~49.9 days**. This is a different document than the baseline read
(`metric_type` differs: `cost` → `tokens`), which is expected — `by_period_bucket` orders by
`(period, bucket_start)`, not `_creationTime`, and there are multiple `metric_type` rows sharing the
same `bucket_start`; once the row the baseline saw was deleted, the query surfaces whichever
remaining row sorts first by that index. `bucket_start` itself staying at `1777996800` is therefore
not informative on its own — what carries the signal is `_creationTime` moving forward, which is the
control this probe exists to provide, and it did.

**CONTROL SATISFIED** by the oldest-hourly-`_creationTime`-moved-forward reading (the plan's first
listed option). The `retention: aggregates done, pruned <n> docs` log line — the plan's second listed
option — was not available as corroboration; DUR-02 leg 1 above establishes that no chain log line is
recoverable from this instance at all, for any table, not only for `aggregates`. The hourly reading
alone is sufficient per the plan's "at least one of" wording.

### Probe 3 — bounded daily count at `take(1000)`

```
$ npx convex run --env-file <selfhosted.envfile> --inline-query "const rows = await ctx.db.query('aggregates').withIndex('by_period_bucket', q => q.eq('period','daily')).order('asc').take(1000); return { count: rows.length };"
{
  "count": 1000
}
```

| | Plan 110-04 baseline (2026-08-10) | This run (2026-08-11) |
|---|---|---|
| Bounded daily count (`take(1000)`) | `1000` (cap hit — lower bound, not exhaustive) | `1000` (cap hit — lower bound, not exhaustive) |

**Unchanged, and has not dropped.** Both readings hit the same `take(1000)` ceiling, so this remains
a lower bound rather than an exact count on both sides — the same limitation the 110-04 baseline
itself noted — but it is the identical shape of result, giving no indication of a shrinking daily
population.

### Rotation cursor (D-05/D-06)

```
$ npx convex run --env-file <selfhosted.envfile> --inline-query "const rows = await ctx.db.query('agentConfigs').withIndex('by_key', q => q.eq('configKey','retention.rotationCursor')).take(5); return { count: rows.length, rows: rows.map(r => ({ value: r.value, source: r.source, updatedAt: r.updatedAt })) };"
{
  "count": 1,
  "rows": [
    {
      "source": "runtime",
      "updatedAt": 1786439716.834,
      "value": 0
    }
  ]
}
```

Three assertions, each checked separately:

1. **Exists.** `count: 1` — present. Plan 110-04 Probe 4 recorded this row as `null` (absent)
   pre-deploy — that recorded absence (`.planning/phases/110-convex-durability/110-DUR-EVIDENCE.md`,
   Plan 110-04, "Probe 4 — Rotation cursor absence (D-06)") is what makes today's `value: 0` mean
   something rather than being indistinguishable from a row that never existed.
2. **Exactly one row**, not a growing set — queried with `.take(5)` to make an unexpected second row
   visible if one existed; only one came back. This is what distinguishes the patch idiom
   (`convex/retention.ts`'s `existingCursor ? ctx.db.patch(...) : ctx.db.insert(...)`) from an
   insert-only anti-pattern that would accumulate a row per run.
3. **`updatedAt` inside the run window, read as epoch seconds.** `1786439716.834` as epoch
   **seconds** = `2026-08-11T09:15:16.834Z` — 0.615s after the `_scheduled_functions` window's own
   `lastScheduledTime` (`09:15:16.219Z`), i.e. inside the observed run, not some other night's run. As
   epoch milliseconds this value would resolve to 1970-01-21, which is absurd and confirms the seconds
   interpretation is the correct one.

`value: 0` is consistent with the leg-1 outcome (a completed pass) — DUR-02 leg 1 above is what
establishes that reading is a completion rather than a cap-at-index-0, per the ambiguity already
documented there.

### Verdict

**DUR-01 confirmed on live data against the pre-deploy baseline.** The oldest `period:"daily"` row is
byte-identical to the 110-04 baseline — no daily rows were deleted, so cost-history re-pricing is
intact. The oldest `period:"hourly"` row's `_creationTime` moved forward ~49.9 days, satisfying the
opposite-failure control and confirming the predicate is actually pruning, not skipping everything.
The bounded daily count is unchanged in shape. The rotation cursor is exactly one row, patched (not
duplicated), holding `value: 0` with an `updatedAt` inside the observed run window read correctly as
epoch seconds, against a pre-deploy absence already on record.

---

## Credential-shape scan (this plan)

```
grep -inE "sk_[A-Za-z0-9]|sb_[A-Za-z0-9]|gho_[A-Za-z0-9]|Bearer [A-Za-z0-9]|convex-self-hosted\|" \
  .planning/phases/110-convex-durability/110-DUR-EVIDENCE.md
```

Result: the only hit is the same pre-existing false positive on the word "bearer" in ordinary prose
in the Plan 110-04 preamble ("no Convex admin key, deploy key, or bearer token"), already recorded in
110-04-SUMMARY.md. No new match introduced by this plan's additions. No `--admin-key`/`--url`-with-key
argument was ever constructed in any command pasted in this section — every invocation used
`--env-file <path>`, which never places a credential value on the command line.

## Bounding and mutation discipline (this plan's self-check)

- No probe in this plan used `take` greater than 1000.
- No probe returned `SystemTimeoutError`; none was retried at a larger `take`.
- No write, patch, delete, or bulk operation was issued against any table.
- `npx convex import` was not run.
- `npx convex env list` was not run.
- `npx convex deploy` was not run; no `--push`, `--prod`, or `deploy` flag appeared in any command.
- The retention cron (`retention:startNightlyPrune`) was not hand-triggered — the observed 09:00 UTC
  fire happened before this session began.
- No `.env` file was read, cat'd, sourced, or grepped.

---

*DUR-02 leg 1 and the DUR-01 live confirmation are complete. Task 3 (operator sign-off) is next and
is a blocking checkpoint — this plan does not close DUR-01/DUR-02 or update ROADMAP/STATE until the
operator responds.*
