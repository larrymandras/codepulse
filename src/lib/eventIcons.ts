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
  // Runtime
  llm_call: "🧠",
  security_event: "🛡️",
  self_healing: "🔄",
  docker_status: "🐳",
  supabase_health: "⚡",
  build_progress: "🏗️",
  pipeline_execution: "📦",
  agent_coordination: "🤝",
  profile_activity: "👤",
};

export function getEventIcon(eventType: string): string {
  return EVENT_ICONS[eventType] || "📋";
}

export function getEventColor(eventType: string): string {
  const colors: Record<string, string> = {
    SessionStart: "text-green-400",
    SessionEnd: "text-red-400",
    ToolUse: "text-blue-400",
    SubagentStart: "text-purple-400",
    llm_call: "text-yellow-400",
    security_event: "text-red-500",
    self_healing: "text-orange-400",
    docker_status: "text-cyan-400",
  };
  return colors[eventType] || "text-gray-400";
}
