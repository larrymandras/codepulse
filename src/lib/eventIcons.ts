const EVENT_ICONS: Record<string, string> = {
  // Build-time
  SessionStart: "▶",
  SessionEnd: "⏹",
  ToolUse: "🔧",
  SubagentStart: "🤖",
  SubagentStop: "⏏",
  Write: "📝",
  Edit: "✏️",
  Read: "📖",
  Bash: "💻",
  // Runtime — LLM & providers
  llm_call: "🧠",
  provider_health: "🏥",
  "provider.state_change": "⚡",
  compaction: "🗜️",
  agent_metric: "📊",
  metric_snapshot: "📈",
  advisor_event: "📊",
  // Runtime — security
  security_event: "🛡️",
  sandbox_violation: "⛔",
  credential_access: "🔑",
  // Runtime — infrastructure
  docker_status: "🐳",
  supabase_health: "⚡",
  heartbeat: "💓",
  heartbeat_alerts: "🚨",
  channel_health: "📡",
  // Runtime — automation
  cron_execution: "⏰",
  pipe_execution: "🔀",
  pipeline_execution: "📦",
  job_lifecycle: "📋",
  proactive_message: "📢",
  command_execution: "⚙️",
  tool_execution: "🔧",
  // Runtime — coordination
  agent_coordination: "🤝",
  profile_activity: "👤",
  profile_switch: "🔄",
  self_healing: "🔄",
  build_progress: "🏗️",
  // Runtime — config & bootstrap
  capability_sync: "🔗",
  mcp_connection: "🔌",
  plugin_loaded: "🧩",
  startup_event: "🚀",
  version_bump: "📦",
  // Runtime — intelligence
  memory_tier_stats: "🧠",
  reflection_result: "🪻",
  episodic_event: "📝",
  operator_score: "🎯",
  // Runtime — integration
  integration_call: "🌐",
  git_commit: "📌",
  worktree_event: "🌳",
  // Hook events
  PostToolUse: "🔧",
  PostToolUseFailure: "❌",
  PermissionRequest: "🔐",
  UserPromptSubmit: "💬",
  PreCompact: "🗜️",
  InstructionsLoaded: "📄",
  ConfigChange: "⚙️",
  Stop: "⏹",
  // Fallback for unknown types
  unknown: "❓",
};

export function getEventIcon(eventType: string): string {
  return EVENT_ICONS[eventType] || "📋";
}

export function getEventColor(eventType: string): string {
  const colors: Record<string, string> = {
    SessionStart: "text-green-400",
    SessionEnd: "text-red-400",
    Stop: "text-red-400",
    ToolUse: "text-blue-400",
    PostToolUse: "text-blue-400",
    SubagentStart: "text-purple-400",
    llm_call: "text-yellow-400",
    security_event: "text-red-500",
    sandbox_violation: "text-red-500",
    PostToolUseFailure: "text-red-500",
    heartbeat_alerts: "text-red-500",
    self_healing: "text-orange-400",
    docker_status: "text-cyan-400",
    capability_sync: "text-teal-400",
    startup_event: "text-green-400",
    mcp_connection: "text-blue-400",
  };
  return colors[eventType] || "text-gray-400";
}
