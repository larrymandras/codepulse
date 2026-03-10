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
  })
    .index("by_session", ["sessionId", "timestamp"])
    .index("by_type", ["eventType", "timestamp"])
    .index("by_tool", ["toolName", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  sessions: defineTable({
    sessionId: v.string(),
    startedAt: v.float64(),
    lastEventAt: v.float64(),
    status: v.string(), // "active" | "completed" | "errored"
    cwd: v.optional(v.string()),
    model: v.optional(v.string()),
    eventCount: v.float64(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_status", ["status", "lastEventAt"]),

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
    createdAt: v.float64(),
    updatedAt: v.float64(),
  }).index("by_profileId", ["profileId"]),

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
  })
    .index("by_severity", ["severity", "createdAt"])
    .index("by_acknowledged", ["acknowledged", "createdAt"]),

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
  }).index("by_name", ["name"]),

  skills: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    source: v.optional(v.string()),
    lastUsedAt: v.optional(v.float64()),
    discoveredAt: v.float64(),
  }).index("by_name", ["name"]),

  registeredHooks: defineTable({
    hookType: v.string(), // "PreToolUse" | "PostToolUse" | etc.
    command: v.string(),
    matcher: v.optional(v.string()),
    registeredAt: v.float64(),
  })
    .index("by_hookType", ["hookType"])
    .index("by_registeredAt", ["registeredAt"]),

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
  })
    .index("by_provider", ["provider", "timestamp"])
    .index("by_model", ["model", "timestamp"])
    .index("by_session", ["sessionId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

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
  // PROFILE CONFIG TABLE — syncs Astridr ProfileConfig
  // ============================================================

  profileConfigs: defineTable({
    profileId: v.string(),
    channels: v.optional(v.any()), // array of channel configs
    budget: v.optional(v.any()), // spending limits
    modelPreferences: v.optional(v.any()),
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
  })
    .index("by_session", ["sessionId"])
    .index("by_tool", ["toolName", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

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
    sessionId: v.string(),
    type: v.string(),
    worktreePath: v.optional(v.string()),
    branch: v.optional(v.string()),
    timestamp: v.float64(),
  }).index("by_timestamp", ["timestamp"]),

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
});
