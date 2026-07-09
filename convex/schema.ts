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
    .index("by_timestamp", ["timestamp"])
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
    webhookStatus: v.optional(v.string()),    // "pending" | "delivered" | "failed"
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
    .index("by_status", ["status"]),

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
  })
    .index("by_session", ["sessionId"])
    .index("by_tool", ["toolName", "timestamp"])
    .index("by_timestamp", ["timestamp"])
    .index("by_provider", ["provider"]),

  permissionRequests: defineTable({
    sessionId: v.string(),
    toolName: v.string(),
    decision: v.string(),
    decisionSource: v.string(),
    timestamp: v.float64(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_tool", ["toolName", "timestamp"]),

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
  })
    .index("by_type_period_bucket", ["metric_type", "period", "bucket_start"])
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
    commandType: v.union(v.literal("launch"), v.literal("stop")),

    // Launch payload (null for stop commands)
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

    // Stop payload (null for launch commands)
    stopPayload: v.union(
      v.object({
        forgeJobId: v.string(),  // the job to stop
      }),
      v.null()
    ),

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
  })
    .index("by_host_status_created", ["hostId", "status", "createdAt"])  // claim query
    .index("by_commandId",           ["commandId"])                        // optimistic reconciliation
    .index("by_expires",             ["expiresAt"])                        // TTL cron sweep
    .index("by_createdAt",           ["createdAt"]),                       // all-hosts list, newest-first

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
  }).index("by_snapshotId", ["snapshotId"]),

  // Entity rows for graph nodes, keyed by (snapshotId, version).
  // community is optional float64 — vault nodes emit community: null (Pitfall 4 / T-83-04).
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
  graphSnapshotLinks: defineTable({
    snapshotId: v.string(),
    version:    v.number(),
    source:     v.string(),   // namespaced node id (source node)
    target:     v.string(),   // namespaced node id (target node)
    relation:   v.string(),
  }).index("by_snapshot_version", ["snapshotId", "version"]),

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
});
