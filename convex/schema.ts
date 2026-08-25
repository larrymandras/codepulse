import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================================
  // LEGACY — kept for backward compatibility during transition
  // ============================================================
  runtime_events: defineTable({
    eventType: v.string(),
    data: v.any(),
    timestamp: v.float64(),
    critical: v.boolean(),
    receivedAt: v.float64(),
    archived: v.optional(v.boolean()),
  })
    .index("by_type", ["eventType"])
    .index("by_timestamp", ["timestamp"])
    .index("by_critical", ["critical", "timestamp"]),

  // ============================================================
  // BUILD-TIME TABLES (9)
  // ============================================================

  events: defineTable({
    sessionId: v.string(),
    eventType: v.string(),
    toolName: v.optional(v.string()),
    filePath: v.optional(v.string()),
    payload: v.any(),
    hookType: v.optional(v.string()),
    timestamp: v.float64(),
    goalId: v.optional(v.string()),    // Phase 149 PULSE-01
    archived: v.optional(v.boolean()),
    idempotencyKey: v.optional(v.string()),   // Phase 88 D-04: producer dedup key
  })
    .index("by_session", ["sessionId", "timestamp"])
    .index("by_type", ["eventType", "timestamp"])
    .index("by_tool", ["toolName", "timestamp"])
    // by_timestamp was renamed by_timestamp2 (2026-07-21): the original index
    // accumulated so many un-GC'd tombstones (mass deletes from the 07-17
    // --replace-all reimport + nightly retention) that even single-row reads
    // exceeded the syscall budget. Renaming forces a clean backfill over live
    // rows only. Do not rename back while the old index's garbage may linger.
    .index("by_timestamp2", ["timestamp"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

  sessions: defineTable({
    sessionId: v.string(),
    startedAt: v.float64(),
    lastEventAt: v.float64(),
    status: v.string(), // "active" | "completed" | "errored"
    cwd: v.optional(v.string()),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
    eventCount: v.float64(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_status", ["status", "lastEventAt"])
    .index("by_provider", ["provider"]),

  agents: defineTable({
    sessionId: v.string(),
    agentId: v.string(),
    parentAgentId: v.optional(v.string()),
    agentType: v.string(),
    status: v.string(), // "running" | "completed" | "failed"
    startedAt: v.float64(),
    endedAt: v.optional(v.float64()),
    model: v.optional(v.string()),
  })
    .index("by_session", ["sessionId"])
    .index("by_agentId", ["agentId"])
    .index("by_status", ["status"]),

  avatars: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    capabilities: v.optional(v.array(v.string())),
    imageStorageId: v.optional(v.id("_storage")),
    emoji: v.optional(v.string()),
    color: v.optional(v.string()),
    createdAt: v.float64(),
  }).index("by_name", ["name"]),

  agentProfiles: defineTable({
    profileId: v.string(),
    name: v.string(),
    model: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    tools: v.optional(v.array(v.string())),
    avatarId: v.optional(v.id("avatars")),
    displayName: v.optional(v.string()),
    sortOrder: v.optional(v.float64()),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  }).index("by_profileId", ["profileId"])
    .index("by_sortOrder", ["sortOrder"]),

  contextSnapshots: defineTable({
    sessionId: v.string(),
    agentId: v.optional(v.string()),
    contextTokens: v.optional(v.float64()),
    summaryTokens: v.optional(v.float64()),
    statusLine: v.optional(v.string()),
    snapshot: v.optional(v.any()),
    timestamp: v.float64(),
  })
    .index("by_session", ["sessionId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  alerts: defineTable({
    severity: v.string(), // "info" | "warning" | "error" | "critical"
    source: v.string(),
    message: v.string(),
    details: v.optional(v.any()),
    acknowledged: v.boolean(),
    acknowledgedBy: v.optional(v.string()),
    acknowledgedAt: v.optional(v.float64()),
    createdAt: v.float64(),
    status: v.optional(v.string()),           // "active" | "acknowledged" | "resolved"
    resolvedAt: v.optional(v.float64()),
    ruleId: v.optional(v.string()),           // static rule id or custom rule _id
    linkedTaskId: v.optional(v.id("tasks")),  // for escalation (D-11)
    webhookStatus: v.optional(v.string()),    // "pending" | "delivered" | "failed" | "digest" | "skipped"
    webhookDeliveredAt: v.optional(v.float64()),
    webhookAttempts: v.optional(v.float64()),
  })
    .index("by_severity", ["severity", "createdAt"])
    .index("by_acknowledged", ["acknowledged", "createdAt"])
    .index("by_source", ["source", "createdAt"])
    .index("by_status", ["status", "createdAt"]),

  fileOps: defineTable({
    sessionId: v.string(),
    operation: v.string(), // "read" | "write" | "edit"
    filePath: v.string(),
    linesChanged: v.optional(v.float64()),
    timestamp: v.float64(),
  })
    .index("by_session", ["sessionId", "timestamp"])
    .index("by_file", ["filePath", "timestamp"]),

  metricSnapshots: defineTable({
    metricName: v.string(),
    value: v.float64(),
    tags: v.optional(v.any()),
    timestamp: v.float64(),
  })
    .index("by_metric", ["metricName", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // ============================================================
  // CAPABILITIES REGISTRY (10)
  // ============================================================

  environmentSnapshots: defineTable({
    sessionId: v.optional(v.string()),
    snapshot: v.any(),
    scannedAt: v.float64(),
  })
    .index("by_session", ["sessionId"])
    .index("by_scannedAt", ["scannedAt"]),

  mcpServers: defineTable({
    name: v.string(),
    url: v.optional(v.string()),
    status: v.string(), // "connected" | "disconnected" | "error"
    toolCount: v.optional(v.float64()),
    lastSeenAt: v.float64(),
    origin: v.optional(v.string()), // "native" | "bridge" | "cc" | "catalog"
  })
    .index("by_name", ["name"])
    .index("by_status", ["status"]),

  discoveredTools: defineTable({
    name: v.string(),
    source: v.string(), // "mcp" | "builtin" | "plugin"
    serverName: v.optional(v.string()),
    description: v.optional(v.string()),
    usageCount: v.float64(),
    lastUsedAt: v.optional(v.float64()),
    discoveredAt: v.float64(),
    origin: v.optional(v.string()), // "native" | "bridge" | "cc" | "catalog"
  })
    .index("by_name", ["name"])
    .index("by_source", ["source"])
    .index("by_usage", ["usageCount"]),

  plugins: defineTable({
    name: v.string(),
    version: v.optional(v.string()),
    enabled: v.boolean(),
    config: v.optional(v.any()),
    installedAt: v.float64(),
    origin: v.optional(v.string()), // "native" | "bridge" | "cc" | "catalog"
  }).index("by_name", ["name"]),

  skills: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    source: v.optional(v.string()),
    lastUsedAt: v.optional(v.float64()),
    discoveredAt: v.float64(),
    origin: v.optional(v.string()), // "native" | "bridge" | "cc" | "catalog" | "claude-code[:available|:project:<key>]"
    useCount: v.optional(v.float64()),
    // From SKILL.md frontmatter. `upstream` is "unknown" for hand-copied skills,
    // which is exactly the set that cannot be checked for updates.
    upstream: v.optional(v.string()),
    command: v.optional(v.string()), // explicit invocation, e.g. "/legal nda"
  })
    .index("by_name", ["name"])
    .index("by_name_origin", ["name", "origin"]),

  skillCategories: defineTable({
    name: v.string(),
    displayName: v.string(),
    description: v.string(),
    icon: v.string(),
    color: v.string(),
    sortOrder: v.float64(),
  }).index("by_name", ["name"]),

  skillOverrides: defineTable({
    skillName: v.string(),
    displayName: v.string(),
    categoryName: v.string(),
    description: v.optional(v.string()),
    hidden: v.boolean(),
    isAutoAssigned: v.boolean(),
    favorite: v.optional(v.boolean()),
  })
    .index("by_skillName", ["skillName"])
    .index("by_categoryName", ["categoryName"]),

  registeredHooks: defineTable({
    hookType: v.string(), // "PreToolUse" | "PostToolUse" | etc.
    command: v.string(),
    matcher: v.optional(v.string()),
    registeredAt: v.float64(),
    origin: v.optional(v.string()), // "native" | "bridge" | "cc" | "catalog"
  })
    .index("by_hookType", ["hookType"])
    .index("by_registeredAt", ["registeredAt"])
    .index("by_hookType_command", ["hookType", "command"]),

  cliTools: defineTable({
    name: v.string(),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    lastSeenAt: v.float64(),
    origin: v.optional(v.string()),
  }).index("by_name", ["name"]),

  slashCommands: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    source: v.optional(v.string()),
    discoveredAt: v.float64(),
  }).index("by_name", ["name"]),

  agentConfigs: defineTable({
    configKey: v.string(),
    value: v.any(),
    source: v.optional(v.string()), // "file" | "env" | "runtime"
    updatedAt: v.float64(),
  }).index("by_key", ["configKey"]),

  configChanges: defineTable({
    configKey: v.string(),
    oldValue: v.optional(v.any()),
    newValue: v.any(),
    changedBy: v.optional(v.string()),
    changedAt: v.float64(),
  })
    .index("by_key", ["configKey", "changedAt"])
    .index("by_changedAt", ["changedAt"]),

  // ============================================================
  // RUNTIME TABLES (9)
  // ============================================================

  dockerContainers: defineTable({
    containerId: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    status: v.string(), // "running" | "stopped" | "error"
    health: v.optional(v.string()),
    cpuPercent: v.optional(v.float64()),
    memoryMb: v.optional(v.float64()),
    updatedAt: v.float64(),
  })
    .index("by_containerId", ["containerId"])
    .index("by_status", ["status"])
    // pollHealth reads only rows already past its stale threshold. Without this
    // index it scanned the whole table, which put every freshly-reporting row
    // into its OCC read set and let any concurrent recordStatus write fail the
    // cron (see convex/docker.ts pollHealth and convex/crons.ts).
    .index("by_updatedAt", ["updatedAt"]),

  supabaseHealth: defineTable({
    projectRef: v.optional(v.string()),
    service: v.string(),
    status: v.string(), // "healthy" | "degraded" | "down"
    responseTimeMs: v.optional(v.float64()),
    details: v.optional(v.any()),
    checkedAt: v.float64(),
  })
    .index("by_service", ["service", "checkedAt"])
    .index("by_status", ["status"]),

  llmMetrics: defineTable({
    provider: v.string(),
    model: v.string(),
    promptTokens: v.float64(),
    completionTokens: v.float64(),
    totalTokens: v.float64(),
    latencyMs: v.float64(),
    cost: v.optional(v.float64()),
    sessionId: v.optional(v.string()),
    timestamp: v.float64(),
    archived: v.optional(v.boolean()),
    agentId: v.optional(v.string()),    // Phase 59 SCH-02
    toolName: v.optional(v.string()),   // Phase 59 SCH-02
    billingType: v.optional(v.string()),  // "api" | "subscription" — Phase 67
    goalId: v.optional(v.string()),     // Phase 149 PULSE-01 — swarm cost join
    traceId: v.optional(v.string()),    // Phase 94 TRACE-01 — per-turn trace grouping
    cacheReadInputTokens: v.optional(v.float64()),      // prompt-cache hit monitoring
    cacheCreationInputTokens: v.optional(v.float64()),  // prompt-cache write monitoring
    round: v.optional(v.float64()), // Phase 105 D-10 — per-round trace-waterfall join key
  })
    .index("by_provider", ["provider", "timestamp"])
    .index("by_model", ["model", "timestamp"])
    .index("by_session", ["sessionId", "timestamp"])
    .index("by_timestamp", ["timestamp"])
    .index("by_agent", ["agentId", "timestamp"])
    .index("by_goal", ["goalId", "timestamp"]),

  securityEvents: defineTable({
    eventType: v.string(),
    severity: v.string(), // "low" | "medium" | "high" | "critical"
    source: v.string(),
    description: v.string(),
    details: v.optional(v.any()),
    mitigated: v.boolean(),
    resolvedAt: v.optional(v.float64()),
    timestamp: v.float64(),
  })
    .index("by_severity", ["severity", "timestamp"])
    .index("by_type", ["eventType", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  selfHealingEvents: defineTable({
    component: v.string(),
    issue: v.string(),
    action: v.string(), // "restart" | "rollback" | "retry" | "escalate"
    outcome: v.string(), // "resolved" | "failed" | "pending"
    details: v.optional(v.any()),
    timestamp: v.float64(),
  })
    .index("by_component", ["component", "timestamp"])
    .index("by_outcome", ["outcome", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  versionHistory: defineTable({
    component: v.string(),
    version: v.string(),
    previousVersion: v.optional(v.string()),
    changedAt: v.float64(),
    changedBy: v.optional(v.string()),
    changeType: v.optional(v.string()),
  })
    .index("by_component", ["component", "changedAt"])
    .index("by_changedAt", ["changedAt"]),

  profileMetrics: defineTable({
    profileId: v.string(),
    metric: v.string(),
    value: v.float64(),
    tags: v.optional(v.any()),
    timestamp: v.float64(),
  })
    .index("by_profile", ["profileId", "timestamp"])
    .index("by_metric", ["metric", "timestamp"]),

  buildProgress: defineTable({
    component: v.string(),
    phase: v.string(),
    status: v.string(), // "pending" | "in_progress" | "completed" | "failed"
    progress: v.optional(v.float64()), // 0-100
    message: v.optional(v.string()),
    updatedAt: v.float64(),
  })
    .index("by_component", ["component"])
    .index("by_phase", ["phase", "status"])
    .index("by_status", ["status"]),

  pipelineExecutions: defineTable({
    pipelineId: v.string(),
    name: v.string(),
    status: v.string(), // "queued" | "running" | "completed" | "failed"
    stages: v.optional(v.any()),
    startedAt: v.float64(),
    completedAt: v.optional(v.float64()),
    triggeredBy: v.optional(v.string()),
  })
    .index("by_pipelineId", ["pipelineId"])
    .index("by_status", ["status", "startedAt"])
    .index("by_startedAt", ["startedAt"]),

  agentCoordination: defineTable({
    fromAgent: v.string(),
    toAgent: v.string(),
    eventType: v.string(), // "handoff" | "message" | "delegation" | "result"
    payload: v.optional(v.any()),
    status: v.optional(v.string()),
    timestamp: v.float64(),
  })
    .index("by_fromAgent", ["fromAgent", "timestamp"])
    .index("by_toAgent", ["toAgent", "timestamp"])
    .index("by_type", ["eventType", "timestamp"]),

  // ============================================================
  // AUTOMATION TABLES (6) — Astridr runtime event sync
  // ============================================================

  cronExecutions: defineTable({
    jobName: v.string(),
    startedAt: v.float64(),
    durationMs: v.float64(),
    success: v.boolean(),
    error: v.optional(v.string()),
    timestamp: v.float64(),
  })
    .index("by_jobName", ["jobName", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  heartbeatAlerts: defineTable({
    alerts: v.any(), // array of check results
    alertCount: v.float64(),
    timestamp: v.float64(),
  }).index("by_timestamp", ["timestamp"]),

  jobLifecycle: defineTable({
    jobId: v.string(),
    status: v.string(), // "pending" | "running" | "completed" | "failed" | "cancelled"
    trigger: v.optional(v.string()), // "manual" | "cron:..." | "webhook:..."
    error: v.optional(v.string()),
    timestamp: v.float64(),
  })
    .index("by_jobId", ["jobId", "timestamp"])
    .index("by_status", ["status", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  proactiveMessages: defineTable({
    messageType: v.string(), // "alert" | "reminder" | etc.
    channelId: v.optional(v.string()),
    chatId: v.optional(v.string()),
    timestamp: v.float64(),
  }).index("by_timestamp", ["timestamp"]),

  subagentExecutions: defineTable({
    agentId: v.string(),
    success: v.boolean(),
    durationMs: v.float64(),
    tokensUsed: v.float64(),
    error: v.optional(v.string()),
    timestamp: v.float64(),
  })
    .index("by_agentId", ["agentId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  webhookEvents: defineTable({
    hookId: v.string(),
    taskId: v.optional(v.string()),
    source: v.optional(v.string()),
    timestamp: v.float64(),
  })
    .index("by_hookId", ["hookId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // ============================================================
  // EPISODIC MEMORY TABLE
  // ============================================================

  episodicEvents: defineTable({
    agentId: v.optional(v.string()),
    eventType: v.string(), // "memory_stored" | "memory_recalled" | "memory_pruned"
    summary: v.string(),
    detail: v.optional(v.any()),
    occurredAt: v.float64(),
    timestamp: v.float64(),
  })
    .index("by_agent", ["agentId", "timestamp"])
    .index("by_type", ["eventType", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // ============================================================
  // TYPED RESPONSE BLOCKS (Phase 55)
  // ============================================================

  run_blocks: defineTable({
    sessionId: v.string(),
    blocks: v.array(v.any()),
    roundNum: v.optional(v.float64()),
    timestamp: v.float64(),
  })
    .index("by_session", ["sessionId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // ============================================================
  // PROFILE CONFIG TABLE — syncs Astridr ProfileConfig
  // ============================================================

  profileConfigs: defineTable({
    profileId: v.string(),
    channels: v.optional(v.any()), // array of channel configs
    budget: v.optional(v.any()), // spending limits
    modelPreferences: v.optional(v.any()),
    emailAddress: v.optional(v.string()), // delivery email for this profile
    updatedAt: v.float64(),
  })
    .index("by_profileId", ["profileId"])
    .index("by_updatedAt", ["updatedAt"]),

  // ============================================================
  // GIT INTEGRATION
  // ============================================================

  gitCommits: defineTable({
    sha: v.string(),
    message: v.string(),
    branch: v.string(),
    author: v.string(),
    filesChanged: v.float64(),
    timestamp: v.float64(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_branch", ["branch", "timestamp"]),

  // ============================================================
  // PROFILE SWITCHES
  // ============================================================

  profileSwitches: defineTable({
    fromProfile: v.string(),
    toProfile: v.string(),
    reason: v.optional(v.string()),
    timestamp: v.float64(),
  }).index("by_timestamp", ["timestamp"]),

  // ============================================================
  // WSL2 STATUS
  // ============================================================

  wsl2Status: defineTable({
    distro: v.string(),
    status: v.string(),
    memoryMb: v.optional(v.float64()),
    cpuPercent: v.optional(v.float64()),
    updatedAt: v.float64(),
  }).index("by_distro", ["distro"]),

  // ============================================================
  // CLAUDE CODE HOOK & OTEL TABLES
  // ============================================================

  toolExecutions: defineTable({
    sessionId: v.string(),
    toolName: v.string(),
    durationMs: v.optional(v.float64()),
    success: v.boolean(),
    decision: v.optional(v.string()),
    decisionSource: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    timestamp: v.float64(),
    archived: v.optional(v.boolean()),
    provider: v.optional(v.string()),
    // Phase 105 D-03/D-10 — per-call trace/turn-number join keys, populated
    // when the row originates from Ástríðr's `tool_executed` runtime event
    // (case "tool_executed" in runtimeIngest.ts). Claude Code hook rows
    // never carry these.
    traceId: v.optional(v.string()),
    round: v.optional(v.float64()),
  })
    .index("by_session", ["sessionId"])
    .index("by_tool", ["toolName", "timestamp"])
    .index("by_timestamp", ["timestamp"])
    .index("by_provider", ["provider"])
    // Phase 105 D-09 — Tools page's default Ástríðr-only drill-down reads
    // this on every page load; not speculative.
    .index("by_provider_time", ["provider", "timestamp"]),

  permissionRequests: defineTable({
    sessionId: v.string(),
    toolName: v.string(),
    decision: v.string(),
    decisionSource: v.string(),
    timestamp: v.float64(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_tool", ["toolName", "timestamp"]),

  // TOOL POLICY EVENTS (Phase 105 D-05/D-06) — 4 kinds, verified live against
  // astridr-repo: malformed_policy_boot/malformed_policy_reload_rejected send
  // `field`+`error` (no session, synthetic "system:bootstrap"); execution_denied
  // sends `tool`+`sessionId`; tool_call_leaked_as_text sends `tool`,
  // `taskCategory`, `sessionId`, plus D-08's `toolWasOffered`/`toolsOfferedCount`/
  // `round`/`agentId`. Fields are optional because only some kinds send them.
  // Prior to Phase 105 this event had no case/default and was silently dropped.
  toolPolicyEvents: defineTable({
    event: v.string(), // one of the four kinds above
    tool: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    taskCategory: v.optional(v.string()),
    toolWasOffered: v.optional(v.boolean()),
    toolsOfferedCount: v.optional(v.float64()),
    round: v.optional(v.float64()),
    field: v.optional(v.string()),
    error: v.optional(v.string()),
    timestamp: v.float64(),
  })
    .index("by_timestamp", ["timestamp"])
    // D-06's per-kind, time-range-bounded evaluator scan — a single-field
    // ["event"] index cannot range-bound on time, so this compound shape
    // is mandatory.
    .index("by_event", ["event", "timestamp"]),

  worktreeEvents: defineTable({
    sessionId: v.optional(v.string()),
    type: v.string(), // "created" | "merged" | "merge_failed" | "cleaned"
    worktreeId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    worktreePath: v.optional(v.string()),
    branch: v.optional(v.string()),
    baseBranch: v.optional(v.string()),
    proofPassed: v.optional(v.boolean()),
    timestamp: v.float64(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_agent", ["agentId", "timestamp"])
    .index("by_type", ["type", "timestamp"]),

  compactionEvents: defineTable({
    sessionId: v.string(),
    trigger: v.string(),
    timestamp: v.float64(),
  }).index("by_timestamp", ["timestamp"]),

  instructionsLoaded: defineTable({
    sessionId: v.string(),
    filePath: v.string(),
    timestamp: v.float64(),
  }).index("by_timestamp", ["timestamp"]),

  promptSubmissions: defineTable({
    sessionId: v.string(),
    promptLength: v.float64(),
    promptId: v.optional(v.string()),
    timestamp: v.float64(),
  }).index("by_timestamp", ["timestamp"]),

  apiErrors: defineTable({
    sessionId: v.string(),
    model: v.optional(v.string()),
    errorMessage: v.string(),
    statusCode: v.optional(v.string()),
    durationMs: v.optional(v.float64()),
    attempt: v.optional(v.float64()),
    timestamp: v.float64(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_model", ["model", "timestamp"]),

  gitActivity: defineTable({
    sessionId: v.string(),
    type: v.string(),
    linesAdded: v.optional(v.float64()),
    linesRemoved: v.optional(v.float64()),
    timestamp: v.float64(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_type", ["type", "timestamp"]),

  activeTime: defineTable({
    sessionId: v.string(),
    type: v.string(),
    durationSeconds: v.float64(),
    timestamp: v.float64(),
  }).index("by_timestamp", ["timestamp"]),

  // ============================================================
  // CREDENTIAL AUDIT (Feature #3: Vault Proxy)
  // ============================================================

  credentialAudit: defineTable({
    toolName: v.string(),
    credentialKey: v.string(), // masked, e.g. "GITH***"
    agentId: v.optional(v.string()),
    granted: v.boolean(),
    timestamp: v.float64(),
  })
    .index("by_tool", ["toolName", "timestamp"])
    .index("by_timestamp", ["timestamp"])
    .index("by_granted", ["granted", "timestamp"]),

  // ============================================================
  // MEMORY TIER STATS (Feature #1: L0/L1/L2 Tiered Context)
  // ============================================================

  memoryTierStats: defineTable({
    agentId: v.string(),
    contentLength: v.float64(),
    l0Length: v.float64(),
    l1Length: v.float64(),
    tokenSavingsPercent: v.float64(),
    hadLlmSummarizer: v.boolean(),
    timestamp: v.float64(),
  })
    .index("by_agent", ["agentId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // ============================================================
  // REFLECTION RESULTS (Feature #2: Memory Self-Evolution)
  // ============================================================

  reflectionResults: defineTable({
    agentId: v.string(),
    eventsAnalyzed: v.float64(),
    memoriesExtracted: v.float64(),
    categories: v.any(),
    avgConfidence: v.float64(),
    reflectionDurationMs: v.float64(),
    timestamp: v.float64(),
  })
    .index("by_agent", ["agentId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // ============================================================
  // PIPELINE CHECKPOINTS (Feature #6: Durable Pipeline Execution)
  // ============================================================

  pipelineCheckpoints: defineTable({
    executionId: v.string(),
    pipelineName: v.string(),
    stepIndex: v.float64(),
    stepName: v.string(),
    completedSteps: v.any(), // JSON array of step names
    status: v.string(), // "saved" | "resumed" | "completed" | "deleted"
    timestamp: v.float64(),
  })
    .index("by_execution", ["executionId", "timestamp"])
    .index("by_pipeline", ["pipelineName", "timestamp"])
    .index("by_status", ["status", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // ============================================================
  // INTEGRATION CALLS (Feature #7: Integrations-as-Data)
  // ============================================================

  integrationCalls: defineTable({
    integrationName: v.string(),
    endpointName: v.string(),
    method: v.string(),
    statusCode: v.float64(),
    durationMs: v.float64(),
    success: v.boolean(),
    error: v.optional(v.string()),
    timestamp: v.float64(),
  })
    .index("by_integration", ["integrationName", "timestamp"])
    .index("by_success", ["success", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // ============================================================
  // SANDBOX VIOLATIONS (Feature #8: Tool Capability Manifests)
  // ============================================================

  sandboxViolations: defineTable({
    toolName: v.string(),
    permission: v.string(),
    detail: v.optional(v.string()),
    strict: v.boolean(),
    timestamp: v.float64(),
  })
    .index("by_tool", ["toolName", "timestamp"])
    .index("by_permission", ["permission", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // ============================================================
  // GITHUB ACTIONS WORKFLOW RUNS
  // ============================================================

  githubWorkflowRuns: defineTable({
    workflowName: v.string(),
    repo: v.string(),
    status: v.string(), // "success" | "failure" | "in_progress" | "queued"
    conclusion: v.optional(v.string()), // "success" | "failure" | "cancelled" | null
    runUrl: v.optional(v.string()),
    runId: v.optional(v.float64()),
    triggeredAt: v.float64(),
    completedAt: v.optional(v.float64()),
  })
    .index("by_triggeredAt", ["triggeredAt"])
    .index("by_workflow", ["workflowName"]),

  // ============================================================
  // KG BENCHMARK RUNS (Phase 180, KG-BENCH-02, D-09)
  // ============================================================
  //
  // Insert-only append log — one immutable row per KG-vs-vector benchmark run
  // pushed by the CI workflow via the `kg_benchmark` runtime-ingest event.
  // Field shape mirrors docs/astridr-contract.md §2.33. `categories` is a
  // heterogeneous suite-driven nested shape, so v.any() (matching the existing
  // reflectionResults.categories / metricSnapshots.tags convention) rather than
  // a fixed object validator. Indexed by timestamp for the latest-N query.
  kgBenchmarkRuns: defineTable({
    runTag: v.string(),
    verdict: v.string(),            // "pass" | "fail" | "error"
    categories: v.any(),            // nested per-category scores (suite-driven shape)
    suiteSize: v.float64(),
    durationMs: v.float64(),
    workflowRunUrl: v.optional(v.string()),
    timestamp: v.float64(),
  }).index("by_timestamp", ["timestamp"]),

  // ============================================================
  // CHANNEL & PROVIDER HEALTH (Pattern 2)
  // ============================================================

  channelHealth: defineTable({
    channelId: v.string(),
    status: v.string(),
    messagesLastHour: v.float64(),
    avgResponseMs: v.float64(),
    errorCount: v.float64(),
    lastMessageAt: v.float64(),
    details: v.optional(v.any()),
    timestamp: v.float64(),
  })
    .index("by_channel", ["channelId"])
    .index("by_timestamp", ["timestamp"]),

  providerHealth: defineTable({
    providerName: v.string(),
    state: v.string(),
    latencyEmaMs: v.float64(),
    successRate: v.float64(),
    consecutiveFailures: v.float64(),
    lastSuccessAt: v.float64(),
    timestamp: v.float64(),
    authenticated: v.optional(v.boolean()),
    billingType: v.optional(v.string()),
    quotaRemaining: v.optional(v.float64()),
  })
    .index("by_provider", ["providerName"])
    .index("by_timestamp", ["timestamp"]),

  // ============================================================
  // NOTIFICATIONS (Pattern 8)
  // ============================================================

  notifications: defineTable({
    type: v.string(),
    category: v.string(),
    title: v.string(),
    message: v.string(),
    severity: v.string(),
    read: v.boolean(),
    createdAt: v.float64(),
    expiresAt: v.optional(v.float64()),
  })
    .index("by_type_read", ["type", "read"])
    .index("by_created", ["createdAt"]),

  // ============================================================
  // EXECUTION STATE MACHINE (Phase 25)
  // ============================================================

  // ============================================================
  // IDEATION FINDINGS (Phase 49)
  // ============================================================

  ideationFindings: defineTable({
    scanType: v.string(),
    severity: v.string(),
    category: v.string(),
    location: v.string(),
    description: v.string(),
    suggestedFix: v.optional(v.string()),
    contentHash: v.string(),
    dismissed: v.boolean(),
    dismissedAt: v.optional(v.number()),
    createdAt: v.number(),
    status: v.optional(v.string()),
    taskId: v.optional(v.string()),
    acknowledgedAt: v.optional(v.number()),
    convertedAt: v.optional(v.number()),
  })
    .index("by_scan_type", ["scanType"])
    .index("by_severity", ["severity"])
    .index("by_dismissed", ["dismissed"])
    .index("by_content_hash", ["contentHash"]),

  commandExecutions: defineTable({
    executionId: v.string(),
    toolName: v.string(),
    origin: v.string(),
    profileId: v.string(),
    channelId: v.optional(v.string()),
    status: v.string(),
    queuedAt: v.float64(),
    startedAt: v.optional(v.float64()),
    completedAt: v.optional(v.float64()),
    durationMs: v.optional(v.float64()),
    errorMessage: v.optional(v.string()),
    contextSnapshot: v.optional(v.any()),
    parentExecutionId: v.optional(v.string()),
    cancelRequested: v.optional(v.boolean()),
  })
    .index("by_executionId", ["executionId"])
    .index("by_status", ["status", "queuedAt"])
    .index("by_profile", ["profileId", "queuedAt"])
    .index("by_channel", ["channelId", "queuedAt"])
    .index("by_queuedAt", ["queuedAt"]),

  // ============================================================
  // TASK MANAGEMENT (Phase 04)
  // ============================================================

  tasks: defineTable({
    taskId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.string(),
    column: v.string(),
    agentId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
    source: v.optional(v.string()),
    progress: v.optional(v.float64()),
    dueAt: v.optional(v.number()),
    columnEnteredAt: v.number(),
    findingId: v.optional(v.id("ideationFindings")),
    alertId: v.optional(v.id("alerts")),
    createdAt: v.number(),
    goalId: v.optional(v.string()),     // Phase 149 PULSE-01
  })
    .index("by_column", ["column", "createdAt"])
    .index("by_findingId", ["findingId"])
    .index("by_taskId", ["taskId"])
    .index("by_alertId", ["alertId"]),

  // ============================================================
  // DATA PIPELINE — Aggregation + Retention (Phase 5)
  // ============================================================

  aggregates: defineTable({
    metric_type: v.string(),      // "cost" | "events" | "errors"
    period: v.string(),           // "hourly" | "daily"
    bucket_start: v.float64(),    // Unix epoch seconds, truncated to hour/day boundary
    value: v.float64(),           // Numeric aggregate value
    dimensions: v.optional(v.any()), // { provider?, model?, event_type?, error_category? }
    // Phase 107 / D-01. A missing value does NOT read as shard 0: the write path
    // matches with STRICT equality, so a pre-sharding legacy row (no `shard`
    // field) never matches an explicit shard and is never patched again. Readers
    // are unaffected — they sum every row in the bucket and never branch on
    // shard. (Corrected plan 107-07: this comment previously claimed "missing
    // value reads as shard 0", which contradicts the code 107-03 shipped.)
    shard: v.optional(v.float64()),
    // Phase 107 plan 07: `dimensions` is v.any() and cannot be indexed, so the
    // dimension is denormalised into an indexable string by
    // lib/aggregateDimensionKey.ts. Set only by the `events` / `sankey_edge`
    // ingest write path; absent on rows the hourly cron writes (cost, tokens,
    // tool_*), which key their own idempotency differently.
    dimension_key: v.optional(v.string()),
  })
    // Wide bucket index — READERS ONLY. 10 modules fold across it, summing all
    // shards and all dimension keys. Do not narrow it: correctness of every
    // rollup total depends on it returning the whole bucket.
    .index("by_type_period_bucket", ["metric_type", "period", "bucket_start"])
    // Phase 107 plan 07 — WRITE PATH ONLY. Pins every field with eq() so an
    // ingest's read set is a single row instead of the whole bucket, which is
    // what 107-06 identified as the unfixed half of OCC-01: Convex OCC conflicts
    // on documents read from OR written to, so a wide read collided with every
    // concurrent ingest in the same hour regardless of which row it wrote.
    .index("by_type_period_bucket_key_shard", [
      "metric_type",
      "period",
      "bucket_start",
      "dimension_key",
      "shard",
    ])
    .index("by_period_bucket", ["period", "bucket_start"]),

  // ============================================================
  // SWARM OBSERVABILITY (Phase 149 PULSE-01)
  // ============================================================

  swarmTasks: defineTable({
    goalId: v.string(),
    subtaskId: v.string(),
    state: v.string(),        // "pending"|"claimed"|"running"|"verifying"|"done"|"failed"|"verify_rejected"
    subtask: v.string(),
    dependsOn: v.array(v.string()),
    claimedBy: v.optional(v.string()),
    model: v.optional(v.string()),
    agentId: v.optional(v.string()),
    timestamp: v.float64(),
    updatedAt: v.optional(v.float64()),
  })
    .index("by_goal", ["goalId", "timestamp"])
    .index("by_subtask", ["subtaskId"])
    .index("by_state", ["state", "goalId"]),

  swarmGoals: defineTable({
    goalId: v.string(),
    firstSubtask: v.string(),
    latestState: v.string(),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_created", ["createdAt"]),

  // ============================================================
  // BACKGROUND SUBAGENT JOBS (Phase 168 — background subagents)
  // Standalone table, NOT an extension of swarmTasks (D-09) — /hive
  // semantics stay untouched. Mirrors a non-blocking delegate_task(
  // background=True) job through queued/running/completed/failed/
  // cancelled, keyed by jobId.
  // ============================================================

  subagentJobs: defineTable({
    jobId: v.string(),
    agentTypeId: v.string(),
    status: v.string(),        // "queued"|"running"|"completed"|"failed"|"cancelled"
    taskSnippet: v.string(),
    resultSnippet: v.optional(v.string()),
    error: v.optional(v.string()),
    channelId: v.optional(v.string()),
    chatId: v.optional(v.string()),
    submittedAt: v.float64(),
    finishedAt: v.optional(v.float64()),
    updatedAt: v.optional(v.float64()),
  })
    .index("by_jobId", ["jobId"])
    .index("by_status", ["status", "submittedAt"]),

  // ============================================================
  // ALERT ROUTING (Phase 6)
  // ============================================================

  alertRuleCustom: defineTable({
    name: v.string(),
    severity: v.string(),        // "critical" | "error" | "warning" | "info"
    enabled: v.boolean(),
    conditions: v.array(v.object({
      metric: v.string(),         // e.g., "cost_per_hour", "error_rate", "stall_duration"
      operator: v.string(),       // "gt" | "lt" | "gte" | "lte" | "eq"
      threshold: v.float64(),
      lookbackWindow: v.string(), // "5m" | "15m" | "30m" | "1h" | "24h"
    })),
    conditionLogic: v.string(),   // "AND" | "OR"
    conditionGroups: v.optional(v.array(v.object({
      conditions: v.array(v.object({
        metric: v.string(),
        operator: v.string(),
        threshold: v.float64(),
        lookbackWindow: v.string(),
      })),
      logic: v.string(),          // "AND" | "OR"
    }))),
    messageTemplate: v.optional(v.string()),
    pagerdutyConfig: v.optional(v.object({   // Phase 59 D-06
      enabled: v.boolean(),
      routingKey: v.string(),
      severity: v.optional(v.string()),
    })),
    githubTrigger: v.optional(v.object({     // Phase 59 D-05
      enabled: v.boolean(),
      repo: v.string(),
      workflowFile: v.string(),
      ref: v.string(),
    })),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  }).index("by_enabled", ["enabled"]).index("by_severity", ["severity"]),

  alertMutes: defineTable({
    targetType: v.string(),       // "alert" | "rule" | "customRule"
    targetId: v.string(),         // alert _id, static rule id, or custom rule _id
    duration: v.string(),         // "15m" | "1h" | "4h" | "24h" | "indefinite"
    expiresAt: v.optional(v.float64()), // null for indefinite
    mutedBy: v.optional(v.string()),
    createdAt: v.float64(),
  }).index("by_target", ["targetType", "targetId"]),

  webhookDeliveryLog: defineTable({
    alertId: v.id("alerts"),
    channel: v.string(),          // "discord" | "slack"
    attempt: v.float64(),
    status: v.string(),           // "success" | "failed"
    statusCode: v.optional(v.float64()),
    errorMessage: v.optional(v.string()),
    sentAt: v.float64(),
  }).index("by_alert", ["alertId", "sentAt"]),

  // ============================================================
  // SCHEMA FOUNDATION (Phase 59)
  // ============================================================

  callGraphEdges: defineTable({
    agentId: v.string(),
    toolName: v.string(),
    sessionId: v.string(),
    callCount: v.float64(),
    lastCallAt: v.float64(),
    lastErrorAt: v.optional(v.float64()),
    errorCount: v.float64(),
    status: v.string(),           // "healthy" | "errored"
    archived: v.optional(v.boolean()),
  })
    .index("by_agent_tool", ["agentId", "toolName"])
    .index("by_session", ["sessionId"])
    .index("by_timestamp", ["lastCallAt"]),

  // Tool kits — capability bundles emitted by Ástríðr via the `kits_snapshot`
  // runtime event. One row per kit, idempotent by name; `tools` is replaced
  // wholesale on each snapshot. Feeds the Tool Galaxy kit nodes (Phase 72).
  kits: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    tools: v.array(v.string()),
    updatedAt: v.float64(),
  }).index("by_name", ["name"]),

  // Tool governance flags (Phase 73, MCP-03). One row per tool name carrying a
  // `disabled` prune flag set by the operator from the MCP Inventory surface.
  // CodePulse-side governance state only: enforcement (Ástríðr refusing to load
  // a disabled tool) is a follow-up — this table is the source of truth the
  // enforcement endpoint would read. Idempotent by `toolName`.
  toolGovernance: defineTable({
    toolName: v.string(),
    disabled: v.boolean(),
    updatedAt: v.float64(),
    updatedBy: v.optional(v.string()),
    note: v.optional(v.string()),
  }).index("by_toolName", ["toolName"]),

  // Temporal-KG summary snapshot — pushed by Ástríðr's `kg_summary` telemetry
  // event (Phase 135 emitter). Single latest-snapshot semantics: one row,
  // upserted on every event, so the KG Explorer summary cards (Phase 74, KG-01)
  // render even when Ástríðr is offline or before any interactive fetch.
  // Field names mirror the live emitter (currentTripleCount / historicalTripleCount).
  kgSummary: defineTable({
    entitiesByType: v.record(v.string(), v.float64()),
    totalEntities: v.float64(),
    currentTripleCount: v.float64(),
    historicalTripleCount: v.float64(),
    contradictionCount: v.float64(),
    lastExtractionAt: v.optional(v.string()),  // ISO ts of last extraction, or undefined
    updatedAt: v.float64(),                    // epoch seconds — when CodePulse received it
  }),

  // Galaxy answer-sync latest source-node set — pushed by Ástríðr's
  // `kg_answer_sync` telemetry event (Phase 187 GLXY-01 emitter,
  // docs/astridr-contract.md §2.41). Single-row, latest-wins semantics —
  // mirrors kgSummary exactly: one row, upserted on every event, with no
  // per-session scoping, so /knowledge-graph's 3D galaxy can subscribe with
  // useQuery and replay the last sync on open (D-04/D-05).
  kgAnswerSync: defineTable({
    turnId: v.string(),
    sourceNodeIds: v.array(v.string()),
    primaryEntityName: v.optional(v.string()),
    updatedAt: v.float64(),
  }),

  // KG-10: Named saved views for the KG Explorer. Global scope (D-02) — no owner
  // field. Each view captures lens + filters (minus searchQuery, D-06) + focus
  // entityName + hops (D-05). Share links use the opaque shareToken (D-03).
  savedKgViews: defineTable({
    name: v.string(),           // operator-given label (1..100 chars)
    lens: v.string(),           // KgLens value
    filters: v.any(),           // KgFilters minus searchQuery
    focus: v.string(),          // entityName for Entity/Temporal lens (D-05)
    hops: v.float64(),          // hop depth (D-05)
    shareToken: v.string(),     // opaque random UUID for share links (D-03)
    createdAt: v.float64(),     // epoch ms
  })
    .index("by_shareToken", ["shareToken"])
    .index("by_createdAt", ["createdAt"]),

  emailDeliveryLog: defineTable({
    alertId: v.optional(v.id("alerts")),
    ruleId: v.string(),
    attempt: v.float64(),
    status: v.string(),           // "success" | "failed"
    errorMessage: v.optional(v.string()),
    recipient: v.optional(v.string()),
    subject: v.optional(v.string()),
    sentAt: v.float64(),
    archived: v.optional(v.boolean()),
  })
    .index("by_alert", ["alertId", "sentAt"])
    .index("by_rule", ["ruleId", "sentAt"])
    .index("by_timestamp", ["sentAt"]),

  pagerdutyDeliveryLog: defineTable({
    alertId: v.id("alerts"),
    ruleId: v.string(),
    attempt: v.float64(),
    status: v.string(),           // "success" | "failed" | "resolved"
    errorMessage: v.optional(v.string()),
    dedupKey: v.optional(v.string()),
    incidentKey: v.optional(v.string()),
    action: v.optional(v.string()),   // "trigger" | "resolve"
    sentAt: v.float64(),
    archived: v.optional(v.boolean()),
  })
    .index("by_alert", ["alertId", "sentAt"])
    .index("by_rule", ["ruleId", "sentAt"])
    .index("by_timestamp", ["sentAt"]),

  githubTriggerLog: defineTable({
    alertId: v.id("alerts"),
    ruleId: v.string(),
    attempt: v.float64(),
    status: v.string(),           // "success" | "failed" | "rate_limited"
    errorMessage: v.optional(v.string()),
    dispatchId: v.optional(v.string()),
    runUrl: v.optional(v.string()),
    rateLimited: v.optional(v.boolean()),
    repo: v.optional(v.string()),
    workflowFile: v.optional(v.string()),
    sentAt: v.float64(),
    archived: v.optional(v.boolean()),
  })
    .index("by_alert", ["alertId", "sentAt"])
    .index("by_rule", ["ruleId", "sentAt"])
    .index("by_timestamp", ["sentAt"]),

  // ============================================================
  // INTELLIGENCE LAYER (Phase 7)
  // ============================================================

  briefings: defineTable({
    type: v.string(),                    // "session" | "daily_digest"
    sessionId: v.optional(v.string()),   // for session briefings only
    date: v.optional(v.string()),        // "YYYY-MM-DD" for daily digests
    narrative: v.string(),               // full LLM-generated text
    summary: v.optional(v.string()),     // one-line summary for collapsed list view
    anomaliesDetected: v.optional(v.float64()),
    totalCost: v.optional(v.float64()),
    generatedAt: v.float64(),            // epoch seconds
  })
    .index("by_type_generated", ["type", "generatedAt"])
    .index("by_session", ["sessionId"])
    .index("by_date", ["date"]),

  anomalyEvents: defineTable({
    metric: v.string(),                  // "cost" | "errors" | "latency"
    value: v.float64(),                  // actual observed value
    mean: v.float64(),                   // rolling mean at detection time
    stdDev: v.float64(),                 // rolling stddev at detection time
    zScore: v.float64(),                 // computed z-score
    severity: v.string(),               // "warning" (2sigma) | "critical" (3sigma)
    alertId: v.optional(v.id("alerts")), // linked alert if auto-created
    detectedAt: v.float64(),            // epoch seconds
  })
    .index("by_metric_detected", ["metric", "detectedAt"])
    .index("by_severity", ["severity", "detectedAt"]),

  memoryQuality: defineTable({
    evaluatedAt: v.float64(),           // epoch seconds
    deduplicationRate: v.float64(),     // 0.0 to 1.0 (percentage as fraction)
    staleCount: v.float64(),            // count of memories beyond staleness threshold
    contradictionCount: v.float64(),    // count of contradicting memory pairs found
    staleMemoryIds: v.optional(v.array(v.string())),       // IDs of stale memories
    contradictionPairs: v.optional(v.array(v.object({      // detected contradiction pairs
      memoryA: v.string(),
      memoryB: v.string(),
      reason: v.optional(v.string()),
    }))),
  })
    .index("by_evaluated", ["evaluatedAt"]),

  // ============================================================
  // V6.0 TELEMETRY TABLES (9) — OpenClaw Intelligence + Security
  // ============================================================

  memoryPreflight: defineTable({
    sessionId: v.optional(v.string()),
    profileId: v.string(),
    hitCount: v.float64(),
    missCount: v.float64(),
    latencyMs: v.float64(),
    topMemoryIds: v.optional(v.array(v.string())),
    timestamp: v.float64(),
  }).index("by_timestamp", ["timestamp"])
    .index("by_profile", ["profileId", "timestamp"]),

  dreamingCycles: defineTable({
    runDate: v.string(),
    status: v.string(),
    rawCount: v.float64(),
    candidateCount: v.float64(),
    extractedCount: v.float64(),
    dedupedCount: v.float64(),
    storedCount: v.float64(),
    durationMs: v.optional(v.float64()),
    costUsd: v.optional(v.float64()),
    isBackfill: v.optional(v.boolean()),
    timestamp: v.float64(),
  }).index("by_timestamp", ["timestamp"])
    .index("by_runDate", ["runDate"]),

  dreamingFacts: defineTable({
    cycleId: v.optional(v.string()),
    factText: v.string(),
    category: v.string(),
    confidence: v.float64(),
    sourceMemoryIds: v.optional(v.array(v.string())),
    timestamp: v.float64(),
  }).index("by_timestamp", ["timestamp"])
    .index("by_category", ["category", "timestamp"]),

  executionModes: defineTable({
    executionId: v.string(),
    mode: v.string(),
    roundsDepth: v.float64(),
    fillerCount: v.optional(v.float64()),
    stalledAt: v.optional(v.float64()),
    timestamp: v.float64(),
  }).index("by_executionId", ["executionId"])
    .index("by_timestamp", ["timestamp"]),

  conversationImports: defineTable({
    importId: v.string(),
    source: v.string(),
    status: v.string(),
    conversationCount: v.float64(),
    memoriesCreated: v.optional(v.float64()),
    errorMessage: v.optional(v.string()),
    timestamp: v.float64(),
  }).index("by_timestamp", ["timestamp"])
    .index("by_importId", ["importId"]),

  runtimeCommands: defineTable({
    name: v.string(),
    description: v.string(),
    category: v.string(),
    jsonSchema: v.optional(v.any()),
    lastSeenAt: v.float64(),
  }).index("by_name", ["name"])
    .index("by_category", ["category"]),

  advisorEvents: defineTable({
    sessionId: v.optional(v.string()),
    provider: v.string(),
    model: v.optional(v.string()),
    used: v.boolean(),
    inputTokens: v.float64(),
    outputTokens: v.float64(),
    costUsd: v.float64(),
    standardCostUsd: v.float64(),
    latencyMs: v.optional(v.float64()),
    timestamp: v.float64(),
  }).index("by_timestamp", ["timestamp"])
    .index("by_provider", ["provider", "timestamp"]),

  startupEvents: defineTable({
    phase: v.string(),
    duration: v.float64(),
    totalMs: v.float64(),
    subsystem: v.optional(v.string()),
    order: v.optional(v.float64()),
    timestamp: v.float64(),
  }).index("by_timestamp", ["timestamp"]),

  authAliases: defineTable({
    alias: v.string(),
    provider: v.string(),
    userId: v.string(),
    createdAt: v.float64(),
  }).index("by_alias", ["alias"])
    .index("by_provider", ["provider"]),

  // ============================================================
  // HIVE MIND — cross-agent activity log (Phase 67)
  // ============================================================

  hiveMindEntries: defineTable({
    agentType: v.string(),
    instanceId: v.string(),
    profileId: v.string(),
    actionType: v.string(),
    toolName: v.optional(v.string()),
    target: v.optional(v.string()),
    resultSummary: v.optional(v.string()),
    success: v.boolean(),
    durationMs: v.optional(v.float64()),
    correlationId: v.optional(v.string()),
    sourceAgent: v.optional(v.string()),
    targetAgent: v.optional(v.string()),
    taskDescription: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    timestamp: v.float64(),
  }).index("by_timestamp", ["timestamp"])
    .index("by_agentType", ["agentType", "timestamp"])
    .index("by_correlationId", ["correlationId"])
    .index("by_profileId", ["profileId", "timestamp"]),

  // ============================================================
  // WAR ROOM + MEETING BOT (Phase 72)
  // ============================================================

  warRooms: defineTable({
    roomId: v.string(),
    name: v.string(),
    status: v.string(),          // "active" | "idle" | "closed"
    participantIds: v.optional(v.array(v.string())),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_roomId", ["roomId"])
    .index("by_status", ["status", "createdAt"]),

  warRoomEvents: defineTable({
    roomId: v.string(),
    eventType: v.string(),       // "transcript.chunk" | "participant.joined" | "participant.left"
    speakerId: v.optional(v.string()),
    speakerName: v.optional(v.string()),
    text: v.optional(v.string()),
    payload: v.optional(v.any()),
    timestamp: v.float64(),
    seq: v.optional(v.number()),  // D-07: monotonic per room; optional for backcompat with existing rows
  })
    .index("by_room", ["roomId", "timestamp"])        // kept — legacy reads / backcompat
    .index("by_room_seq", ["roomId", "seq"])           // ADDED — deterministic ordering (ROOM-04)
    .index("by_timestamp", ["timestamp"]),

  voiceCalls: defineTable({
    callId: v.string(),
    botSessionId: v.optional(v.string()),
    status: v.string(),          // "joining" | "live" | "ended" | "failed"
    platform: v.optional(v.string()),
    agentProfileId: v.optional(v.string()),
    durationMs: v.optional(v.float64()),
    participantCount: v.optional(v.float64()),
    costUsd: v.optional(v.float64()),
    startedAt: v.float64(),
    endedAt: v.optional(v.float64()),
  })
    .index("by_callId", ["callId"])
    .index("by_status", ["status", "startedAt"]),

  callTranscripts: defineTable({
    callId: v.string(),
    speakerId: v.optional(v.string()),
    speakerName: v.optional(v.string()),
    text: v.string(),
    timestamp: v.float64(),
  })
    .index("by_call", ["callId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  meetingBotSessions: defineTable({
    sessionId: v.string(),
    callId: v.optional(v.string()),
    recallBotId: v.optional(v.string()),
    agentProfileId: v.optional(v.string()),
    meetingUrl: v.optional(v.string()),
    status: v.string(),          // "scheduled" | "joining" | "live" | "ended" | "failed"
    wordCount: v.optional(v.float64()),
    summaryText: v.optional(v.string()),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_status", ["status", "createdAt"]),

  // ============================================================
  // HR SECTION TABLES (Phase 74)
  // ============================================================

  wizardDrafts: defineTable({
    catalogEntryId: v.optional(v.string()),
    currentStep: v.number(),
    formData: v.object({
      identity: v.optional(v.any()),
      personality: v.optional(v.any()),
      tools: v.optional(v.any()),
      deployment: v.optional(v.any()),
    }),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_status", ["status"]),

  teamPresets: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    agentIds: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),
    lastUsedAt: v.optional(v.number()),
    warRoomCount: v.optional(v.number()),
  }).index("by_name", ["name"]),

  approvalQueue: defineTable({
    requestId: v.string(),
    agentName: v.string(),
    agentId: v.string(),
    catalogEntryId: v.optional(v.string()),
    tier: v.string(),
    budgetFraction: v.optional(v.number()),
    status: v.string(),
    configSnapshot: v.optional(v.any()),
    requestedAt: v.number(),
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.string()),
  }).index("by_requestId", ["requestId"])
    .index("by_status", ["status"]),

  rosterViewPrefs: defineTable({
    userId: v.optional(v.string()),
    viewMode: v.string(),
    sortBy: v.optional(v.string()),
    filters: v.optional(v.any()),
  }),

  // ============================================================
  // CONFIG VERSIONING & ROLLBACK (Phase 80)
  // ============================================================

  agentConfigVersions: defineTable({
    agentId: v.string(),
    version: v.float64(),           // monotonically increasing per agent
    config: v.any(),                // full AgentTypeConfig snapshot
    changeSummary: v.string(),      // human-readable description of what changed
    changeType: v.string(),         // "create" | "update" | "clone" | "import" | "rollback"
    author: v.optional(v.string()), // who made the change
    parentVersion: v.optional(v.float64()), // version this was derived from (for rollbacks)
    createdAt: v.float64(),
  })
    .index("by_agent", ["agentId", "version"])
    .index("by_agent_created", ["agentId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  // ============================================================
  // OPERATOR SCORES (Phase 120)
  // ============================================================

  operatorScores: defineTable({
    score: v.float64(),
    memoryFreshness: v.float64(),
    skillRoi: v.float64(),
    activityLevel: v.float64(),
    uptime: v.float64(),
    trendDay: v.optional(v.string()),   // "up" | "down" | "flat" -- backend-computed
    trend7d: v.optional(v.string()),    // "improving" | "declining" | "flat" -- backend-computed
    computedAt: v.float64(),
  }).index("by_computedAt", ["computedAt"]),

  // ============================================================
  // AGENT PERFORMANCE METRICS (Phase 81)
  // ============================================================

  agentMetrics: defineTable({
    agentId: v.string(),
    timestamp: v.float64(),
    responseTimeMs: v.optional(v.float64()),
    taskOutcome: v.string(),
    inputTokens: v.float64(),
    outputTokens: v.float64(),
    modelUsed: v.optional(v.string()),
    archived: v.optional(v.boolean()),
    costUsd: v.optional(v.float64()),
    sessionId: v.optional(v.string()),
    toolCallCount: v.optional(v.float64()),
    turnNumber: v.optional(v.float64()),
    complexityTier: v.optional(v.string()),
    fromOverride: v.optional(v.boolean()),
    projectTag: v.optional(v.string()),
  })
    .index("by_agent_timestamp", ["agentId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // ============================================================
  // GATEWAY OBSERVABILITY (Phase 68)
  // ============================================================

  gatewayTasks: defineTable({
    taskId: v.string(),
    sessionId: v.optional(v.string()),
    provider: v.string(),
    billingType: v.optional(v.string()),
    status: v.string(),
    durationSeconds: v.optional(v.float64()),
    error: v.optional(v.string()),
    timestamp: v.float64(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_provider", ["provider", "timestamp"])
    .index("by_taskId", ["taskId"])
    .index("by_status", ["status", "timestamp"]),

  gatewayQuotaSnapshots: defineTable({
    provider: v.string(),
    billingType: v.string(),
    usedToday: v.float64(),
    dailyLimit: v.optional(v.float64()),
    spendUsd: v.float64(),
    spendCapUsd: v.optional(v.float64()),
    remainingPct: v.float64(),
    timestamp: v.float64(),
  })
    .index("by_provider", ["provider", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // ==== COST INTELLIGENCE (Phase 104) ====

  modelPricing: defineTable({
    model: v.string(),
    // Rates are PER TOKEN (already divided by 1_000_000), matching the
    // src/lib/modelPricing.ts literal convention. A per-Mtok value stored
    // here would mis-price every call by 1e6 — see modelPricing.ts's
    // create/update range validation, which enforces this.
    inputPerToken: v.float64(),
    outputPerToken: v.float64(),
    // Reserved slots for the deferred cache-token pricing idea (D-cache,
    // see 104-CONTEXT.md <deferred>). NOT read by Phase 104 — llmMetrics
    // already carries cacheReadInputTokens/cacheCreationInputTokens, but
    // no code in this phase multiplies against these fields.
    cacheReadPerToken: v.optional(v.float64()),
    cacheWritePerToken: v.optional(v.float64()),
    // D-06 fallback: when set, this row prices subscription turns whose
    // `provider` equals this value (one of GATEWAY_PROVIDERS). Never used
    // as a fallback for API-billed turns.
    shadowForProvider: v.optional(v.string()),
    source: v.string(), // "manual" | "seed"
    notes: v.optional(v.string()),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_model", ["model"])
    .index("by_shadow_provider", ["shadowForProvider"]),

  costBudgets: defineTable({
    scope: v.string(), // "global" | "model" | "provider" | "quota"
    scopeKey: v.string(), // "" for global; model id / provider id otherwise
    period: v.string(), // "daily" | "weekly" | "monthly"
    limit: v.float64(),
    warnFraction: v.float64(), // defaults to 0.8 at the call site (D-11)
    unit: v.string(), // "usd" | "quota_pct" (D-07: no fictional dollars in a quota budget)
    enabled: v.boolean(),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_enabled", ["enabled"])
    .index("by_scope_key_period", ["scope", "scopeKey", "period"]),

  routingDecisions: defineTable({
    taskId: v.string(),
    requestedProvider: v.string(),
    selectedProvider: v.string(),
    quotaScore: v.optional(v.float64()),
    latencyScore: v.optional(v.float64()),
    costScore: v.optional(v.float64()),
    finalScore: v.optional(v.float64()),
    fallbackUsed: v.boolean(),
    timestamp: v.float64(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_taskId", ["taskId"])
    .index("by_fallback", ["fallbackUsed", "timestamp"]),

  // ============================================================
  // GATEWAY PROVIDER CONFIG (Phase 69)
  // ============================================================

  providerConfig: defineTable({
    provider: v.string(),       // matches AnyProvider keys from providers.ts
    enabled: v.boolean(),
    priority: v.float64(),      // lower number = higher priority
    updatedAt: v.float64(),
  })
    .index("by_provider", ["provider"])
    .index("by_priority", ["priority"]),

  // ============================================================
  // FORGE INTEGRATION (Phase 78)
  // ============================================================

  // Mirrors the Forge Job model (D-04). hostId disambiguates Desktop vs laptop.
  // upserted idempotently by (hostId, forgeJobId) — last-writer-wins on updatedAt.
  forgeJobs: defineTable({
    forgeJobId:    v.string(),
    hostId:        v.string(),
    agent:         v.string(),
    mode:          v.string(),
    prompt:        v.union(v.string(), v.null()),
    workspaceId:   v.string(),
    status:        v.string(),
    pid:           v.union(v.number(), v.null()),
    exitCode:      v.union(v.number(), v.null()),
    startedAt:     v.union(v.string(), v.null()),
    finishedAt:    v.union(v.string(), v.null()),
    artifactCount: v.number(),
    model:         v.union(v.string(), v.null()),
    capabilities:  v.string(),  // JSON string — passed through from Forge as-is
    createdAt:     v.string(),
    updatedAt:     v.string(),
  })
    .index("by_forgeJobId",     ["hostId", "forgeJobId"])
    .index("by_host_status",    ["hostId", "status", "updatedAt"])
    .index("by_host_updatedAt", ["hostId", "updatedAt"])
    .index("by_updatedAt",      ["updatedAt"]),

  // Append-only log chunks from Forge daemon. Lines arrive pre-scrubbed (T-3-BYPASS upstream).
  // Retention enforced by sweep cron: 7-day TTL + ~1 MB per-job cap (D-2). Phase 81.
  forgeLogChunks: defineTable({
    hostId:     v.string(),
    forgeJobId: v.string(),
    lines:      v.array(v.string()),    // already scrubbed by Forge (T-3-BYPASS upstream)
    seq:        v.number(),             // D-1: monotonic per (host,job) — ordering + dedup (REQUIRED)
    sentAt:     v.optional(v.string()), // client flush time (ISO)
  })
    .index("by_host_job",     ["hostId", "forgeJobId"])          // listJobLogs / retention sweep
    .index("by_host_job_seq", ["hostId", "forgeJobId", "seq"]),  // D-1 idempotency unique-check

  // Phase 82: Per-job file metadata from Forge daemon. Idempotent per (hostId, forgeJobId, path).
  // Retention: 7-day TTL + per-job cap enforced by sweepForgeFileRecords cron. (FI-12 / D-05)
  forgeFiles: defineTable({
    hostId:     v.string(),
    forgeJobId: v.string(),
    path:       v.string(),     // relative path within workspace
    kind:       v.string(),     // "text"|"image"|"video"|"audio"|"pdf"|"binary"
    sizeBytes:  v.number(),
    createdAt:  v.string(),     // ISO timestamp — for TTL retention (not _creationTime)
  })
    .index("by_host_job",      ["hostId", "forgeJobId"])           // listJobFiles / sweep
    .index("by_host_job_path", ["hostId", "forgeJobId", "path"]),  // idempotency + upsert

  // Phase 82: Per-job artifact bytes from Forge daemon. Idempotent per (hostId, forgeJobId, path).
  // textContent for text/HTML (≤ ~1 MB string); storageId for image blobs (Convex File Storage).
  // Retention: same sweep as forgeFiles; image blobs deleted via ctx.storage.delete BEFORE doc row (D-05).
  forgeArtifacts: defineTable({
    hostId:      v.string(),
    forgeJobId:  v.string(),
    path:        v.string(),
    kind:        v.string(),                    // "text"|"image"
    sizeBytes:   v.number(),
    textContent: v.optional(v.string()),        // text/HTML bytes (≤ ~1 MB)
    storageId:   v.optional(v.id("_storage")), // image bytes (Convex File Storage)
    createdAt:   v.string(),
  })
    .index("by_host_job",      ["hostId", "forgeJobId"])
    .index("by_host_job_path", ["hostId", "forgeJobId", "path"]),  // idempotency + artifact lookup

  // Periodic workspace sync from Forge host (D-06). Full replace per host.
  forgeWorkspaces: defineTable({
    hostId:      v.string(),
    workspaceId: v.string(),
    class:       v.string(),  // "synced" | "local-only"
    name:        v.string(),
    rootPath:    v.string(),
    updatedAt:   v.string(),
  })
    .index("by_host_workspaceId", ["hostId", "workspaceId"]),

  // ============================================================
  // FORGE COMMAND BRIDGE (Phase 80)
  // ============================================================

  // Operator-issued commands (launch/stop) enqueued in Convex; the local Forge
  // daemon polls, claims, and executes them. Status state machine:
  //   queued → executing → done | failed
  //   queued (unclaimed past TTL) → expired   (via expireStaleCommands cron, D-12)
  // commandId is a client-generated ULID for optimistic pending-row reconciliation (D-10).
  // capabilities is a JSON string with dangerous stripped (D-06, Pitfall 7).
  forgeCommands: defineTable({
    hostId:      v.string(),
    commandId:   v.string(),  // client-generated ULID for optimistic reconciliation
    commandType: v.union(v.literal("launch"), v.literal("stop"), v.literal("intake"), v.literal("lifecycle")),

    // Launch payload (null for stop/intake commands)
    launchPayload: v.union(
      v.object({
        agent:        v.string(),
        workspaceId:  v.string(),
        mode:         v.string(),
        prompt:       v.union(v.string(), v.null()),
        model:        v.union(v.string(), v.null()),
        capabilities: v.union(v.string(), v.null()),  // JSON string; dangerous key stripped (D-06)
      }),
      v.null()
    ),

    // Stop payload (null for launch/intake commands)
    stopPayload: v.union(
      v.object({
        forgeJobId: v.string(),  // the job to stop
      }),
      v.null()
    ),

    // Intake payload (null for launch/stop commands). Skill-intake validation
    // request: exactly one of storageId (uploaded SKILL.md) or githubUrl,
    // never both, never neither (D-P6-05, enforced by enqueueIntake).
    // v.optional wrapper: pre-Phase-06 rows in the live deployment were
    // written before this field existed and omit it entirely — optional keeps
    // them schema-valid (operator-approved prod-data compat, Plan 06-04).
    // The inner union-with-null is unchanged so the Phase-06 insert sites
    // (buildLaunchRow/enqueueStop/buildIntakeRow) that explicitly supply
    // `intakePayload: null` still validate without modification.
    intakePayload: v.optional(v.union(
      v.object({
        destination:  v.union(v.literal("global"), v.literal("project"), v.literal("cold")),  // D-P6-03
        workspaceId:  v.union(v.string(), v.null()),  // required when destination === "project" (D-P6-04)
        storageId:    v.optional(v.id("_storage")),   // uploaded SKILL.md (D-P6-05)
        githubUrl:    v.optional(v.string()),          // GitHub URL/shorthand (D-P6-05, D-P6-06)
        subpath:      v.optional(v.string()),          // fan-out for a repo with N skills (D-P6-07)
      }),
      v.null()
    )),

    // Lifecycle payload (null for launch/stop/intake commands). Skill lifecycle
    // mutation request (Phase 98, LIFE-01..06): archive/restore/move/delete an
    // EXISTING named skill. v.optional wrapper mirrors intakePayload exactly —
    // pre-Phase-98 rows omit this field entirely and remain schema-valid.
    lifecyclePayload: v.optional(v.union(
      v.object({
        action:       v.union(v.literal("archive"), v.literal("restore"), v.literal("move"), v.literal("delete")),
        skillName:    v.string(),
        sourceOrigin: v.string(),
        destination:  v.union(v.literal("global"), v.literal("project"), v.literal("cold")),
        workspaceId:  v.union(v.string(), v.null()),
      }),
      v.null()
    )),

    // State machine value: queued | executing | done | failed | expired
    status:    v.string(),

    // Clerk provenance (D-13 fail-closed)
    issuedBy:  v.string(),   // identity.subject from getUserIdentity()

    // Timing + TTL (D-12)
    createdAt:   v.number(),
    expiresAt:   v.number(),  // createdAt + FORGE_COMMAND_TTL_MS; cron marks past this as expired
    claimedAt:   v.union(v.number(), v.null()),
    executedAt:  v.union(v.number(), v.null()),
    completedAt: v.union(v.number(), v.null()),

    // Ack fields
    resolvedForgeJobId: v.union(v.string(), v.null()),  // daemon sets on done (D-10 reconciliation)
    error:              v.union(v.string(), v.null()),

    // Intake validation report, set by the daemon on completion (D-P6-13).
    // Optional (not union-with-null) so existing launch/stop insert call
    // sites need no change to supply it.
    report: v.optional(v.any()),
  })
    .index("by_host_status_created", ["hostId", "status", "createdAt"])  // claim query
    .index("by_commandId",           ["commandId"])                        // optimistic reconciliation
    .index("by_expires",             ["expiresAt"])                        // TTL cron sweep
    .index("by_createdAt",           ["createdAt"])                        // all-hosts list, newest-first
    .index("by_commandType_createdAt", ["commandType", "createdAt"]),      // review #6: intake-panel list, no scan of launch/stop rows

  // Lightweight host liveness record — upserted on every daemon claim poll (D-09).
  // The UI derives "online" from lastSeenAt > Date.now() - ONLINE_THRESHOLD_MS (30s).
  forgeHosts: defineTable({
    hostId:     v.string(),
    lastSeenAt: v.number(),           // Date.now() ms, updated on each claim poll
    hostname:   v.optional(v.string()),
  })
    .index("by_hostId",     ["hostId"])
    .index("by_lastSeenAt", ["lastSeenAt"]),

  // ============================================================
  // GRAPH SNAPSHOT RECEIVER (Phase 83, GH-01)
  // ============================================================
  //
  // Row-based storage (D-01): a single-blob document would exceed Convex's
  // 8,192-element array-field limit (~9,000 links worst case) and the ~1 MiB
  // document-size limit. Three tables with versioned entity rows avoid both limits.
  //
  // Versioning (D-02): each ingest increments activeVersion; old version rows are
  // swept by the retention cron (D-03, keeps last N≈7 versions).
  //
  // Ingest auth: reuses validateIngestAuth / getCorsHeaders from /runtime-ingest
  // (no new auth surface). Producer: Ástríðr `graph:snapshot` nightly cron.

  // One meta row per snapshotId. Holds the activeVersion pointer and aggregate counts.
  graphSnapshots: defineTable({
    snapshotId:       v.string(),      // stable id e.g. "astridr-project-graph"
    activeVersion:    v.number(),      // monotonic int — incremented on each ingest (A1)
    sources:          v.array(v.object({
      source:             v.string(),
      kind:               v.string(),
      nodeCount:          v.float64(),
      linkCount:          v.float64(),
      emittedNodeCount:   v.float64(),
      emittedLinkCount:   v.float64(),
      truncated:          v.boolean(),
    })),                               // persisted verbatim from producer (D-05)
    nodeCount:        v.float64(),     // producer's total merged nodeCount
    linkCount:        v.float64(),     // producer's total merged linkCount
    storedNodeCount:  v.float64(),     // receiver-side: how many nodes actually persisted
    storedLinkCount:  v.float64(),     // receiver-side: after dangling-link drop
    generatedAt:      v.float64(),     // epoch seconds — producer's time.time() float (Pitfall 6)
    updatedAt:        v.float64(),     // epoch seconds — when CodePulse stored this version
    // The version list, kept on the META doc so the retention sweep can pick its
    // delete candidates by reading ONE row instead of scanning entity rows.
    //
    // This is the exact shape workspaceSnapshots.storedVersions has (see the note
    // at :2381) and it exists for the exact same reason. Before it, the sweep
    // derived the version set by .collect()ing EVERY graphSnapshotNodes row across
    // EVERY stored version — at ~10,000 rows per version and up to 7 kept, ~70,000
    // reads against a 4,096-read ceiling. That is the mechanism behind the
    // "times out on self-hosted Convex" note that kept the cron disabled from
    // 2026-07-14 until this field landed.
    //
    // OPTIONAL, unlike the workspaceSnapshots field, purely because this table
    // already had rows when the field was added: a required field would have made
    // every pre-existing meta doc invalid on deploy. `backfillGraphStoredVersions`
    // populates it; the sweep REFUSES to run against a doc where it is still
    // absent rather than treating absent as an empty list, because "no versions
    // stored" and "not yet backfilled" would otherwise be indistinguishable and
    // the second one silently means "delete nothing, forever".
    storedVersions:   v.optional(v.array(v.number())),
    // Set when a delete pass hit its per-invocation cap and a version is only
    // PARTIALLY removed. Mirrors workspaceSnapshots. The stale entry stays in
    // storedVersions so the next call re-selects and finishes it.
    pruneIncomplete:  v.optional(v.boolean()),
    // Phase 126, SWEEP-02, D-06-REVISED: how many chunk rows (in the new
    // blob-chunk table below) make up this activeVersion's serialized
    // {nodes,links} blob. Written by the writer at the same time it flips
    // activeVersion, so the reader (plan 126-05's getProjectGraph) can
    // compare "chunks found" against this count and fail loudly on a short
    // read instead of silently reassembling a truncated graph (JSON.parse
    // throw at best, plausible-but-wrong at worst). v.optional because meta
    // docs written before this field existed have none.
    blobChunkCount:   v.optional(v.number()),
  }).index("by_snapshotId", ["snapshotId"]),

  // Entity rows for graph nodes, keyed by (snapshotId, version).
  // community is optional float64 — vault nodes emit community: null (Pitfall 4 / T-83-04).
  //
  // Phase 126, SWEEP-02, D-06-REVISED: upsertGraphSnapshot STOPPED WRITING
  // these rows (2026-08-25) — getProjectGraph now reads the new blob-chunk
  // table below instead, and grepped across convex/**/*.ts, getProjectGraph
  // and sweepGraphSnapshotVersions were this table's only consumers, so
  // dual-writing would cost ~6,591 inserts per ingest with no reader. This
  // table's definition, its index, and the sweep's handling of it are
  // DELIBERATELY KEPT (not removed) so the sweep can drain legacy versions'
  // rows over its existing bounded rate, and so this schema deploy is
  // additive-only — removing a table here would print "Deleted table
  // indexes:" on deploy, the only announcement of a destructive schema
  // rollback (see CLAUDE.md).
  graphSnapshotNodes: defineTable({
    snapshotId: v.string(),
    version:    v.number(),
    nodeId:     v.string(),                  // pre-namespaced producer id — do NOT re-namespace
    label:      v.string(),
    type:       v.string(),
    community:  v.optional(v.float64()),     // nullable: vault nodes carry community: null
    source:     v.string(),
  }).index("by_snapshot_version", ["snapshotId", "version"]),

  // Entity rows for graph links, keyed by (snapshotId, version).
  // Phase 126, SWEEP-02, D-06-REVISED: same retire-writes-keep-table decision
  // as the node table above — see its comment.
  graphSnapshotLinks: defineTable({
    snapshotId: v.string(),
    version:    v.number(),
    source:     v.string(),   // namespaced node id (source node)
    target:     v.string(),   // namespaced node id (target node)
    relation:   v.string(),
  }).index("by_snapshot_version", ["snapshotId", "version"]),

  // Phase 126, SWEEP-02, D-06-REVISED: the graph blob read/write path.
  // D-05 measured `getProjectGraph`'s two entity-table .collect()s (the node
  // and link tables above) at nodeCount:4001 + linkCount:2590 = 6,591 rows in
  // one query, against Convex's 4,096-read ceiling — that is the /tool-galaxy defect.
  // D-06-REVISED rejected both a single-document blob (measured at 99-101% of
  // the 1 MiB document limit for this data) and Convex file storage (unreadable
  // from a `query` — StorageReader has no `get()`). The remedy: the writer
  // serializes {nodes, links} ONCE into a JSON string and splits it across N
  // rows carrying a monotonic `seq`, read back by one indexed range query and
  // rejoined in order.
  graphSnapshotBlobChunks: defineTable({
    snapshotId: v.string(),
    version:    v.number(),
    // 0-based, monotonic, dense — the REASSEMBLY order. NOT _creationTime.
    seq:        v.number(),
    // One slice of JSON.stringify({nodes, links}), sized under 1 MiB per row
    // with headroom (GRAPH_BLOB_CHUNK_CHARS in graphSnapshots.ts).
    chunk:      v.string(),
  })
    // Unlike forgeLogChunks.by_host_job_seq (schema.ts:1731, used ONLY for a
    // dedup/idempotency .unique() check, never for read ordering — its reader
    // listJobLogs sorts by _creationTime via by_host_job instead), THIS index
    // IS the read's ordering key. getProjectGraph must query through it and
    // sort by seq explicitly; reusing by_snapshot_version's
    // ["snapshotId","version"] shape here would fall back to implicit
    // _creationTime order after the equality prefix, which is silent
    // corruption for a JSON blob (a JSON.parse throw at best, a plausible
    // truncated graph at worst) — harmless as that fallback is for
    // forgeLogChunks' append-only log lines.
    .index("by_snapshot_version_seq", ["snapshotId", "version", "seq"]),

  // ============================================================
  // EVAL PIPELINE & QUALITY KPIs (Phase 93, EVAL-01)
  // ============================================================

  // Ástríðr task_quality scores (langfuse_eval.py) + Plan-02 LLM-judge scores.
  // Full judge-ready field set defined up front so this schema is never
  // re-touched by downstream plans (dimensions/rubricVersion/judgeModel are
  // populated only by the judge; task_quality ingest leaves them undefined).
  evalScores: defineTable({
    scoreName: v.string(), // "task_quality" | "llm_judge"
    profileId: v.string(),
    sessionId: v.string(),
    overall: v.float64(), // 0-1
    dimensions: v.optional(v.any()), // per-dimension { score, rationale } map — judge-only
    rubricVersion: v.optional(v.string()), // judge-only
    judgeModel: v.optional(v.string()), // judge-only (E5 version stamping)
    idempotencyKey: v.optional(v.string()),
    timestamp: v.float64(),
  })
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_profileId", ["profileId", "timestamp"])
    .index("by_scoreName", ["scoreName", "timestamp"]),

  // ============================================================
  // REMINDERS & CALENDAR COMMAND CENTER (Phase 101, REM-01)
  // ============================================================

  // Source of truth for reminders (D-01) — both CodePulse (direct mutations)
  // and Ástríðr (authed /reminders-ingest, /reminders-read, D-07) read/write
  // this table. `source` records origin only and never gates a write (D-09).
  // Timestamps are epoch SECONDS (profiles.ts Date.now()/1000 convention).
  reminders: defineTable({
    profileId: v.string(), // "personal" | "business" | "consulting"
    title: v.string(),
    notes: v.optional(v.string()),
    dueAt: v.optional(v.float64()),
    priority: v.string(), // "low" | "med" | "high"
    status: v.string(), // "open" | "done" | "snoozed"
    recurrence: v.optional(
      v.object({
        freq: v.union(
          v.literal("daily"),
          v.literal("weekly"),
          v.literal("monthly")
        ),
        interval: v.float64(),
        byday: v.optional(v.array(v.string())),
        until: v.optional(v.float64()),
      })
    ),
    tags: v.optional(v.array(v.string())),
    source: v.string(), // "dashboard" | "astridr" (D-09 — audit only, never a write gate)
    notifiedAt: v.optional(v.float64()), // set by the Ástríðr nudge cron to dedupe (D-04/D-11)
    snoozedUntil: v.optional(v.float64()),
    completedAt: v.optional(v.float64()),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_profile", ["profileId", "status"])
    .index("by_status", ["status", "dueAt"]),

  // Read-only cache of Google Calendar events (D-02/D-03/D-10). Written ONLY
  // by /calendar-ingest (Ástríðr's calendar cron pushes normalized events);
  // no reminder or CodePulse write path exists — never write back to Google.
  // Each push upserts by googleEventId and prunes stale rows scoped to
  // (profileId, calendarAccount), so the cache tracks the pushed window only.
  calendarEvents: defineTable({
    profileId: v.string(), // "personal" | "business" | "consulting"
    googleEventId: v.string(),
    calendarAccount: v.string(), // the google alias/email the event came from
    title: v.string(),
    start: v.float64(), // epoch seconds
    end: v.float64(),
    allDay: v.boolean(),
    location: v.optional(v.string()),
    fetchedAt: v.float64(),
  })
    .index("by_profile", ["profileId", "start"])
    .index("by_googleEventId", ["googleEventId"]),

  // ============================================================
  // PERSONA DIALS & GAG LEDGER (Phase 189 Plan 10, DIAL-01, D-20/D-21)
  // ============================================================

  // Per-profile, per-persona humor/candor dial values (D-20). Deliberately
  // departs from 185 D-02/D-16's clears-on-restart brain-swap semantics — a
  // dial is a preference, not a swap, and rebuilds here are frequent enough
  // that clears-on-restart would make the feature useless. Scoped to
  // profileId AND personaId because other personas' tone stays locked per
  // 185 D-14 — the persona is part of the key, not an assumption. Written
  // via the authed /persona-dials-ingest httpAction (Ástríðr), reusing
  // ASTRIDR_INGEST_API_KEY (no new/second key — astridr/tools/reminders.py:41
  // precedent). ALL timestamps are epoch SECONDS — a millisecond value here
  // formats as a year-57000 date.
  personaDials: defineTable({
    profileId: v.string(),
    personaId: v.string(),
    humor: v.float64(), // clamped 0-100 server-side in personaDials.ts:set
    candor: v.float64(), // clamped 0-100 server-side in personaDials.ts:set
    updatedAt: v.float64(), // epoch SECONDS
  }).index("by_profile_persona", ["profileId", "personaId"]),

  // Propose/confirm running-gag callback ledger (D-21). A row can only ever
  // be created by /gag-ledger-ingest's "propose" op with status "proposed"
  // — there is no code path by which a single ingest call creates a
  // "confirmed" row, and `source` is hardcoded "astridr" server-side exactly
  // like remindersIngest.ts:55, for the same "never trust the caller"
  // reason. A "proposed" entry is never eligible for callback until
  // "confirm" flips it. ALL timestamps are epoch SECONDS — a wrong-unit
  // lastUsedAt/cooldown comparison would pass or fail by accident, not by
  // logic.
  gagLedger: defineTable({
    profileId: v.string(),
    text: v.string(), // the callback line
    status: v.string(), // "proposed" | "confirmed" | "retired"
    source: v.string(), // server-set, always "astridr" — never trust body.source
    proposedAt: v.float64(), // epoch SECONDS
    confirmedAt: v.optional(v.float64()),
    lastUsedAt: v.optional(v.float64()),
    useCount: v.float64(),
    retiredAt: v.optional(v.float64()),
  })
    .index("by_profile_status", ["profileId", "status"])
    // The cooldown query (gagLedger.ts eligible()) reads this index; without
    // it, eligibility would be a full scan on every turn.
    .index("by_last_used", ["profileId", "lastUsedAt"]),

  // ============================================================
  // GOVERNOR INBOX (Phase 186 Plan 02, GOV-01, D-10) — sibling of reminders
  // ============================================================

  // The record-everything store the interrupt governor (Plan 04) writes to
  // unconditionally, regardless of the interrupt decision (D-15 — "suppressed
  // never means lost"). Written via /inbox-ingest (Ástríðr), read via
  // /inbox-read (per-profile) and /inbox-read-all (D-12 aggregate, all three
  // profiles) — both authed, never anonymous. `intentId` links a row back to
  // its Supabase intents lifecycle row (D-10 success criterion 4), passed
  // inline on raise only — there is NO setIntentId/update op (Blocker 3).
  inbox: defineTable({
    profileId: v.string(), // "personal" | "business" | "consulting"
    emitter: v.string(),
    priority: v.string(), // "money" | "high" | "normal" | "low" (D-06 enum, validated at the writer)
    title: v.string(),
    body: v.string(),
    spoken: v.boolean(), // whether should_speak() fired for this event
    itemType: v.string(), // "card" | "held" | "notification" | "alert" (Plan 07 UI union)
    heldReason: v.optional(v.string()), // "focus" | "quiet-hours" (D-07, held items only)
    intentId: v.optional(v.string()), // Supabase intents lifecycle row, set inline on raise only
    source: v.optional(v.string()),
    sourceId: v.optional(v.string()), // Phase 188.2 D-08 — stable per-item id for future dedup audits; forwarded unchanged, never backfilled
    createdAt: v.float64(),
    ackedAt: v.optional(v.float64()),
  })
    .index("by_profile", ["profileId", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    // WR-01 fix: backs listHeldUnacked() — a dedicated held-only read no
    // longer bounded by listAll()'s generic 200-row DEFAULT_LIST_ALL_LIMIT
    // across ALL itemTypes (focus_digest.py was silently dropping/never
    // acking older held-focus rows once other traffic pushed them past the
    // cutoff).
    .index("by_itemType", ["itemType", "createdAt"]),

  // ============================================================
  // ACTIVE ENGINE SNAPSHOTS (Phase 103, BSC-01/D-14) — per-profile
  // live-resolved brain-swap telemetry, append-only.
  // ============================================================

  // Latest-per-profile reactive readback for the per-profile brain-swap axis
  // (103-CONTRACT.md §4, model_routing event). This is the LIVE resolved
  // engine only — the persisted default stays Ástríðr-owned (D-03) and is
  // never written here; that lives in profileConfigs.modelPreferences.
  // Modeled field-for-field on gatewayQuotaSnapshots above. mode carries the
  // contract's "session" | "pinned" | "inherited" vocabulary but is kept
  // v.string() (not a Literal union) to match this schema's defensive-
  // boundary convention — validated at the ingest edge (convex/activeEngine.ts),
  // not the schema.
  activeEngineSnapshots: defineTable({
    profileId: v.string(),
    model: v.string(),
    mode: v.string(), // "session" | "pinned" | "inherited"
    selectionPath: v.optional(v.string()),
    expiresAt: v.optional(v.float64()), // epoch seconds, set only when mode === "session"
    timestamp: v.float64(),
  })
    .index("by_profileId", ["profileId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // ============================================================
  // CONTROL VERB SWAPS (Phase 108, TELE-02/D-13/D-14) — per-profile
  // swap-history audit trail, append-only.
  // ============================================================

  // astridr/engine/control_verbs/swap_model.py and swap_voice.py emit one
  // `control_verb_swap` event per swap attempt (restore/unresolved/
  // affinity-refused/success). D-13: every emit is stored here, INCLUDING
  // refusals — the refusal path is exactly where the affinity guard and the
  // resolver fail, and a history that stores only successes would claim
  // every swap worked. D-14: one table holds BOTH brain (verb:"swap_model")
  // and voice (verb:"swap_voice") swaps, discriminated by `verb`, because
  // both verbs emit the same event name on the same channel — the D-15
  // readout filters to verb:"swap_model"; voice rows are captured but not
  // yet surfaced (deferred, not dropped). `scope` is the one new column this
  // phase adds: the explicit profileId when a swap was scoped, absent when
  // global. `verb`/`path` are kept v.string() (not Literal unions) to match
  // this schema's defensive-boundary convention — validated at the ingest
  // edge (convex/controlVerbSwaps.ts), not the schema, so an unexpected
  // astridr value is stored and diagnosable rather than poisoning the batch.
  controlVerbSwaps: defineTable({
    verb: v.string(), // "swap_model" | "swap_voice"
    target: v.optional(v.string()), // raw utterance/tag target; absent on restore
    resolved: v.optional(v.string()), // resolved model id (swap_model) or voice display name (swap_voice)
    // swap_model only. 108-07 gap closure (second round, live proof): the
    // emitter (astridr/engine/control_verbs/swap_model.py:126,
    // get_provider_affinity() -> list[str] | None) always sends a real
    // JSON array on the success path — never a scalar. A v.string() model
    // here rejected 100% of successful swaps (isOptionalString refused the
    // array -> resolveControlVerbSwapEvent returned null -> the row was
    // silently skipped). See runtimeIngest.ts's isOptionalStringArray.
    providerAffinity: v.optional(v.array(v.string())),
    voiceId: v.optional(v.string()), // swap_voice only
    path: v.string(), // "claude-native" | "openrouter" | "refused" | "restore" | "swap"
    reason: v.optional(v.string()), // swap_model refusal discriminator only
    scope: v.optional(v.string()), // D-13: explicit profileId when scoped, absent when global
    sessionId: v.optional(v.string()),
    channel: v.string(),
    timestamp: v.float64(),
  })
    .index("by_scope", ["scope", "timestamp"])
    // by_timestamp: currently UNCONSUMED (adversarial-gate finding, gap 3,
    // post-108-02). No query in this repo reads it — controlVerbSwaps.ts's
    // only query (listByScope) uses by_scope, and the retention sweep
    // (convex/retention.ts) uses the built-in by_creation_time, not this
    // index. It was an explicit acceptance criterion in 108-02-PLAN.md
    // (lines 26, 116, 306) for a future cross-profile "recent swaps across
    // all scopes" read that hasn't been built yet — left in place rather
    // than removed so that plan's stated gate still holds. Do not assume
    // it is load-bearing; a future reader adding that cross-profile query
    // is what will finally consume it.
    .index("by_timestamp", ["timestamp"]),

  // ============================================================
  // GOVERNOR DECISIONS (Phase 112, D-04) — governor_decision audit
  // trail, append-only.
  // ============================================================

  // astridr's governor emits one `governor_decision` event per decision
  // (deliver/hold), carrying `emitter`, `priority`, `spoke`, and an
  // optional `held_reason`. Measured 2026-08-12: 83.3 rows/day (1,168 rows
  // in the 14-day window), 13 distinct emitters (`cron:task_delivery`,
  // `startup_test`, `cron_failure`, `focus_exit_digest`,
  // `watch_pulse_duplicate_alert`, every `cron:<taskname>`, etc.) — most
  // absent from the contract's illustrative list, so `emitter`/`priority`
  // are kept v.string(), never a Literal union, matching this schema's
  // defensive-boundary convention (activeEngineSnapshots/controlVerbSwaps
  // above). `timestamp` is epoch SECONDS, not milliseconds. No `profileId`
  // exists on this kind — do not add a by_profileId/by_scope index with
  // nothing to key on.
  governorDecisions: defineTable({
    emitter: v.string(),
    priority: v.string(),
    spoke: v.boolean(),
    heldReason: v.optional(v.string()),
    timestamp: v.float64(),
  })
    .index("by_timestamp", ["timestamp"]),

  // ============================================================
  // MESSAGE ROUTES (Phase 112, D-13) — message_routed audit trail,
  // append-only. Routed but not yet surfaced in the UI this phase.
  // ============================================================

  // astridr emits one `message_routed` event per routed message, carrying
  // `channel`, `profile`, `sender`, `session_id`. Measured 2026-08-12:
  // 0.7-1.2 rows/day (10 rows in the 14-day window) — low-volume, not a
  // firehose, but bounded pre-emptively per D-06 anyway. `sender` and
  // `sessionId` are OPTIONAL even though contract section 2.16 lists them
  // as required: a required field arriving as an explicit JSON `null`
  // makes the resolver refuse the whole event and the row is dropped
  // silently — the exact TELE-02 defect (Phase 108, control_verb_swap,
  // zero rows ever landed) this phase exists to avoid repeating. Storing
  // a partial row is strictly better than losing it silently. `channel`
  // and `profile` stay required. `timestamp` is epoch SECONDS, not
  // milliseconds. by_profile is currently UNCONSUMED — no UI reads it
  // this phase — kept in place because `profile` is a real field on this
  // kind (unlike governor_decision) and a future per-profile inbound view
  // is the obvious consumer, matching controlVerbSwaps' own precedent for
  // a deliberately-unconsumed index (schema.ts:2160-2171 above).
  messageRoutes: defineTable({
    channel: v.string(),
    profile: v.string(),
    sender: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    timestamp: v.float64(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_profile", ["profile", "timestamp"]),

  // ============================================================
  // GALDR PROMPT LIBRARY (Phase 116, Seiðr suite)
  // ============================================================

  // Phase 116 Galdr. `prompts` is the FIRST table in this schema with a
  // `slug` field, and Convex has no server-side unique constraint — the
  // `by_slug` index below speeds lookups, it does not enforce uniqueness.
  // Uniqueness on save is enforced by a transactional check-then-insert in
  // convex/galdr.ts (D-06: a slug collision is refused, never overwritten),
  // not by this index.
  // NOT the same thing as `promptSubmissions` (above, ~line 651) — that
  // table is unrelated Claude Code hook prompt-length telemetry, not a
  // prompt library entry. Keep the two distinct in module/hook names too.
  prompts: defineTable({
    title: v.string(),
    slug: v.string(),
    body: v.string(),
    category: v.string(), // plain string, not a categories table — see rationale below
    // No UI surface this phase (design doc §4.1 field list only) — carried
    // for a future filter/search surface.
    tags: v.optional(v.array(v.string())),
    favorite: v.optional(v.boolean()),
    // incremented only on resolved-body delivery: skill injection, UI Copy, UI Send-to-Chat —
    // never on listing, viewing, favoriting, or "Copy as command".
    usageCount: v.number(),
    lastUsedAt: v.optional(v.number()),
    archived: v.optional(v.boolean()), // D-16: delete = archive; no hard delete this phase
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"])
    .index("by_updatedAt", ["updatedAt"]),
  // Category model: a plain `category: v.string()` field, NOT a separate
  // categories table with per-category icon/color/sortOrder overrides (the
  // heavier pattern Skills uses — `api.skillCategories.getSkillsWithOverrides`,
  // `src/pages/Skills.tsx:78-79`). That pattern earns its cost when a surface
  // has 100+ auto-classified entries needing administered metadata; Galdr is
  // a curated library saved one prompt at a time via `/galdr-save`, and D-08
  // caps the skill surface with no `--category` flag. Filter chips are
  // derived at render time from the live distinct `category` values instead.

  // Phase 116 Galdr. Bounded by newest-N-per-prompt (cap 20), pruned inline
  // on write in convex/galdr.ts's save/restore mutations (D-14) — deliberately
  // NOT a convex/retention.ts RETENTION_DAYS entry. See the D-13 exemption
  // comment inside RETENTION_DAYS for why calendar-age pruning is wrong here.
  promptVersions: defineTable({
    promptId: v.id("prompts"),
    body: v.string(),
    savedAt: v.number(),
  }).index("by_promptId", ["promptId"]),

  // Phase 117 Bifröst (D-01). A curated hub of the URLs Larry actually opens.
  // Like `prompts`, this is deliberately EXEMPT from RETENTION_DAYS: a link is
  // curated, not telemetry, and deleting one for going a quarter unused would
  // be a bug. Do NOT add it to convex/retention.ts.
  links: defineTable({
    title: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    category: v.string(), // plain string, same rationale as prompts.category
    // A lucide icon NAME (e.g. "flame"), never inline SVG — keeps
    // navRegistry.ts's iconComponents map the single icon source.
    icon: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
    order: v.optional(v.number()),
    isLocalService: v.optional(v.boolean()),
    // D-02: liveness resolves by CONTAINER NAME, not host:port. The design
    // doc's "join on host:port" cannot be built — no port/host field exists
    // anywhere in this schema (verified 2026-08-10). This joins
    // dockerContainers.name, which is live and already rendered as a status
    // dot by DockerPanel.tsx:70. D-03: absent containerName renders NO dot,
    // never a green one — no signal must not read as "up".
    containerName: v.optional(v.string()),
    archived: v.optional(v.boolean()),
    // Launcher ranking. These exist so the command palette can order links by
    // what actually gets opened instead of by hand-maintained `order` — the
    // difference between a hub that survives 200 links and one that doesn't.
    //
    // OPTIONAL, unlike `prompts.usageCount` (:2282) which is required. That is
    // not an inconsistency to tidy up: `prompts` was greenfield when it shipped,
    // whereas `links` already holds rows written before this field existed, and
    // a required field would reject every one of them at deploy time. Absent
    // means zero — see comparePaletteLinks in src/lib/bifrostPaletteRank.ts,
    // where absent must coerce to 0 and NOT to the positive-infinity sentinel
    // `order` uses in compareLinks. The two fields sort by opposite rules.
    usageCount: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"])
    // No `by_usage` index on purpose. `bifrost.list` collects the whole table
    // and sorts in memory because the hub is curated and small; an index would
    // add write amplification on every open for a read path that never filters
    // on it. Revisit only if `list` ever grows a server-side ranked query.
    .index("by_order", ["order"]),

  // Phase 119 Loom (D-01). Curated pipelines: what the system is DESIGNED to
  // do, definition-first, optionally lit by live runs. Distinct from Phase
  // 111's Mission Board, which is post-hoc job history — see D-07.
  pipelines: defineTable({
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    owner: v.optional(v.string()), // "larry" | "astridr"
    // Per-step docs live IN the row so the UI never serves files from disk.
    steps: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        icon: v.optional(v.string()), // lucide icon NAME, never inline SVG
        docMd: v.optional(v.string()),
      })
    ),
    sourceRef: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  // D-05: stepEvents is append-only and BOUNDED, pruned inline on write. An
  // unbounded event array on a long-running pipeline is the same growth hazard
  // Phase 116 capped for promptVersions and Phase 110 is currently fighting in
  // `aggregates`. See LOOM_STEP_EVENT_CAP in convex/loom.ts.
  pipelineRuns: defineTable({
    pipelineSlug: v.string(),
    status: v.string(), // "running" | "complete" | "error"
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    currentStep: v.optional(v.string()),
    stepEvents: v.array(
      v.object({
        stepId: v.string(),
        event: v.string(), // start | action | complete | error | warn
        text: v.optional(v.string()),
        at: v.number(),
      })
    ),
  })
    .index("by_pipelineSlug", ["pipelineSlug"])
    .index("by_startedAt", ["startedAt"]),

  // ============================================================
  // WORKSPACE SCANNER (Phase 115, D-10/D-11/D-13)
  // ============================================================
  //
  // Row-based storage, one row per DIRECTORY not per file (D-13): 21,029 files
  // were measured across just .claude/.claude-alt/the vault at planning time,
  // and graphSnapshots' own header comment above records the same 8,192-element
  // array-field / ~1 MiB document limits that forced row-based storage there —
  // a per-file array field would blow both limits on this project's real tree.
  //
  // Versioned pointer-last contract (D-10), copied from graphSnapshots.ts
  // (:84-155): entity rows are inserted for a new version FIRST, and the meta
  // doc's activeVersion pointer is patched LAST, so a mid-scan crash can never
  // make a partial version visible to a reader.
  //
  // NOT a reuse of graphSnapshotNodes: that table's fixed fields (nodeId,
  // label, type, community, source) have nowhere for department/access/size/
  // mtime/withheldCount, so reuse would mean a lossy overload of a contract
  // Phase 83-87's /graphs hub already depends on.
  //
  // Growth is bounded by an INLINE, batch-capped prune inside the same ingest
  // mutation (D-11) — never a cron. graphSnapshots' own cron-based sweep
  // (sweepGraphSnapshotVersions) WAS disabled because its candidate-selection
  // read timed out on this self-hosted backend; it was RE-ENABLED 2026-08-21
  // (hourly) once graphSnapshots.storedVersions removed that read. This
  // module's design was the template for that fix: storedVersions lets the
  // prune discover which versions exist from the meta doc alone, with no scan
  // over entity rows at all (see convex/workspace.ts).
  //
  // Side-channel rule (Pitfall 1 / D-03): fileCount/totalSize count VISIBLE
  // files only. withheldCount is deliberately COUNT-ONLY — there is no
  // byte-total field for withheld files, because a byte total is a far
  // higher-resolution side channel onto a withheld (secret-classified) file
  // than a plain count.

  // One meta row per snapshotId. Holds the activeVersion pointer, coverage/
  // completeness flags, aggregate totals and inline-prune bookkeeping.
  workspaceSnapshots: defineTable({
    snapshotId:      v.string(),          // fixed "larry-workspace" (config/workspace.json)
    activeVersion:   v.number(),          // monotonic int — incremented on each ingest, never reused
    storedVersions:  v.array(v.number()), // versions whose workspaceDirs rows are still present;
                                           // bounded by WORKSPACE_KEEP_VERSIONS + 1 (~4 elements) —
                                           // this is the read the inline prune uses INSTEAD OF a scan
                                           // over workspaceDirs, see convex/workspace.ts.
    generatedAt:     v.float64(),         // epoch SECONDS — host scan time (graphSnapshots.ts convention)
    receivedAt:      v.float64(),         // epoch SECONDS — Convex ingest time
    rootCount:       v.number(),
    coveredRoots:    v.array(v.string()), // root ids whose walk actually, successfully enumerated
    scannedRootsComplete: v.boolean(),    // false when any declared root failed to enumerate —
                                           // paired with coveredRoots per hooks/skillScan.mjs's
                                           // coverage-honest convention: a partial walk must be
                                           // visible, never silently rendered as a complete map.
    unclassifiedRootIds: v.array(v.string()), // D-14/D-15/D-16 — small, bounded by root count
    accessDerivationOk: v.boolean(),      // false when the compose parse failed and every directory
                                           // fell back to local-only (D-09/Pitfall 4)
    localConfigStatus: v.string(),        // "merged" | "absent" | "version-mismatch" (D-17 fail-closed
                                           // loader status from hooks/workspaceConfig.mjs)
    totalDirs:          v.number(),
    totalFiles:          v.number(),
    totalWithheldFiles:  v.number(),
    totalBytes:          v.float64(),
    dryRunReportHash: v.string(),         // D-12 — the approved report hash this ingest was gated on
    prunedVersion:   v.optional(v.number()), // the version the last ingest's inline prune targeted;
                                              // absent on the very first ingest, when there is nothing
                                              // to prune (schema.ts:1913's optional-needs-a-reason precedent)
    pruneIncomplete: v.boolean(),         // true when the prune hit WORKSPACE_DELETE_CAP and left rows
                                           // behind for the next ingest to finish
  }).index("by_snapshotId", ["snapshotId"]),

  // Entity rows for directories, keyed by (snapshotId, version). One row per
  // DIRECTORY (D-13) — never a per-file array field on this table.
  workspaceDirs: defineTable({
    snapshotId: v.string(),
    version:    v.number(),
    rootId:     v.string(),   // which declared root this directory belongs to (D-06)
    dirPath:    v.string(),   // forward-slash relative to the root; "" means the root itself
    department: v.string(),   // "Work" | "Consulting" | "Personal" | "Unclassified" (D-07/D-14)
    access:     v.string(),   // "astridr-reachable" | "local-only" (D-09) — reflects DECLARED
                               // bind-mount coverage, not a live reachability probe (Pitfall 2)
    fileCount:  v.number(),   // VISIBLE files directly in this directory only — never withheld
                               // files, never subdirectories' files
    totalSize:  v.float64(),  // bytes of VISIBLE files only (Pitfall 1)
    latestMtime: v.float64(), // epoch seconds — max over visible files
    withheldCount: v.number(), // D-03 — secret-classified files whose paths are never transmitted;
                                // deliberately count-only, see the header note above
  }).index("by_snapshot_version", ["snapshotId", "version"]),

  // Phase 118 (Studio) D-01/D-05/D-07/D-08/D-13. One row per media file
  // ingested from the media-vault watcher. contentHash (D-05) is the row's
  // real identity — path/rename/restore-safe, unlike absPath. Every
  // provenance field is optional (D-07): a file with no sidecar is ingested
  // anyway, with provenance explicitly absent, never inferred from the
  // filename. Both thumbnail-transport fields are declared (D-01) even
  // though exactly one is populated per row — see the inline comment below;
  // this branch was resolved live in plan 118-01
  // (118-D01-EVIDENCE.md: BRANCH: convex-storage). No migration, seed or
  // backfill exists for this table (D-13) — it starts empty.
  media: defineTable({
    filename: v.string(),
    absPath: v.string(),
    mediaType: v.string(), // "image" | "video" | "audio"
    kind: v.string(), // "gen" | "ref" | "style"
    contentHash: v.string(), // SHA-256 hex of the file's bytes (D-05) — the row identity;
                              // required, not optional — a row without one is not a valid row
    sizeBytes: v.number(),
    starred: v.boolean(),
    createdAt: v.number(),

    // Provenance (D-07) — absent (not blank, not inferred) on a file ingested
    // with no sidecar JSON. The UI renders "No provenance recorded" for a row
    // where these are absent, never a blank field.
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
    prompt: v.optional(v.string()),
    project: v.optional(v.string()),
    styleId: v.optional(v.id("mediaStyles")),
    params: v.optional(v.string()), // sidecar's `params` object, serialised as JSON —
                                     // v.any() here would defeat validation for no benefit

    // Media facts — absent for kinds/types that don't carry them (e.g. no
    // width/height on audio).
    tags: v.optional(v.array(v.string())),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    durationSec: v.optional(v.number()),

    // Thumbnail transport (D-01): BOTH declared, exactly one populated per
    // row. This deployment resolved to BRANCH: convex-storage (118-01) —
    // thumbStorageId is the field every row currently populates.
    // thumbRelPath stays declared-but-unpopulated so the row shape survives
    // a future revisit of the local-static-origin fallback branch without a
    // schema migration.
    thumbStorageId: v.optional(v.id("_storage")),
    thumbRelPath: v.optional(v.string()),

    // Lifecycle (D-08): the mutation sets this; the watcher moves the file
    // to trash\ on its next cycle; the 30-day janitor deletes the file and
    // its thumb blob together, never at soft-delete time (so Restore stays
    // whole).
    deletedAt: v.optional(v.number()),
  })
    .index("by_contentHash", ["contentHash"]) // D-05/D-06 dedup lookup from ingest
    .index("by_createdAt", ["createdAt"]) // Gallery grid's newest-first sort
    .index("by_deletedAt", ["deletedAt"]) // Trash tab + D-08 janitor's 30-day sweep
    .index("by_kind", ["kind"]), // Kind filter Select

  // Phase 118 (Studio) D-12. Curated model cards — exist ONLY for models
  // proven end-to-end in this phase, never seeded wholesale from a provider's
  // model list (that would be transcription, not verification).
  mediaModels: defineTable({
    slug: v.string(),
    name: v.string(),
    type: v.string(), // "image" | "video" | "audio"
    provider: v.string(),
    recipeMd: v.string(), // D-12: references env-var NAMES only — Convex stores no keys.
                           // Plain string, never v.any() — rendered read-only, never
                           // dangerouslySetInnerHTML (T-118-05).
    docsUrl: v.optional(v.string()),
    aspect: v.optional(v.string()),
    resolution: v.optional(v.string()),
    duration: v.optional(v.number()),
    enabled: v.boolean(),
  }).index("by_slug", ["slug"]),

  // Phase 118 (Studio). Curated style presets referenced by media.styleId.
  mediaStyles: defineTable({
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    prompt: v.optional(v.string()),
    previewMediaId: v.optional(v.id("media")),
  }).index("by_slug", ["slug"]),
});
