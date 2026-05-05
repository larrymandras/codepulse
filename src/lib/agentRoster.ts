export interface AgentRosterEntry {
  id: string;
  name: string;
  profiles: string[];
  taskCategory: string;
  tier: string;
  description: string;
}

// SOURCE OF TRUTH: C:\Users\mandr\astridr-repo\config\agent-types.yaml
export const AGENT_ROSTER: AgentRosterEntry[] = [
  { id: "astridr", name: "Astridhr", profiles: ["personal", "business", "consulting"], taskCategory: "commander", tier: "command", description: "Commander agent -- orchestrates all other agents" },
  { id: "hervor", name: "Hervor", profiles: ["business"], taskCategory: "code", tier: "domain", description: "CTO Technical Agent -- reviews PRs, manages GitHub workflows" },
  { id: "freya", name: "Freya", profiles: ["business"], taskCategory: "general", tier: "domain", description: "CTO Executive Agent -- prepares meeting briefs, manages Slack digests" },
  { id: "brynhildr", name: "Brynhildr", profiles: ["consulting"], taskCategory: "general", tier: "domain", description: "Consulting Delivery Agent -- manages client knowledge bases" },
  { id: "ragnhildr", name: "Ragnhildr", profiles: ["consulting"], taskCategory: "general", tier: "domain", description: "Consulting BD Agent -- drafts proposals, manages pipeline" },
  { id: "gondul", name: "Gondul", profiles: ["business", "consulting"], taskCategory: "general", tier: "domain", description: "Content Strategy & Writing Agent" },
  { id: "skuld", name: "Skuld", profiles: ["personal", "business", "consulting"], taskCategory: "vision", tier: "shared", description: "Full Creative Production Agent" },
  { id: "hildr", name: "Hildr", profiles: ["personal", "business", "consulting"], taskCategory: "general", tier: "shared", description: "Marketing Strategy & Growth Agent" },
  { id: "idunn", name: "Idunn", profiles: ["personal"], taskCategory: "general", tier: "domain", description: "Personal Life Agent -- family calendar, health, travel" },
  { id: "urdhr", name: "Urdhr", profiles: ["personal", "business", "consulting"], taskCategory: "reasoning", tier: "shared", description: "Research & Memory Agent -- deep research, Obsidian vault" },
];
