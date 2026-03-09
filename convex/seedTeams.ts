import { mutation } from "./_generated/server";

const VALKYRJUR = [
  {
    profileId: "astridr",
    name: "Ástríðr",
    displayName: "Ástríðr — Commander",
    model: "claude-opus-4-6",
    emoji: "⚡",
    color: "#FBBF24",
    description: "Cross-profile commander. Orchestrates all agents, escalation point, human interface.",
    capabilities: ["Agent coordination", "Cross-profile decisions", "Budget enforcement", "Emergency stop", "Profile isolation"],
  },
  {
    profileId: "hervor",
    name: "Hervor",
    displayName: "Hervor — CTO Technical",
    model: "claude-opus-4-6",
    emoji: "⚔️",
    color: "#F87171",
    description: "CTO technical operations. Code review, architecture decisions, vendor evaluation.",
    capabilities: ["Code review", "ADRs", "Vendor eval", "Tech debt tracking", "API design", "GitHub"],
  },
  {
    profileId: "freya",
    name: "Freya",
    displayName: "Freya — CTO Executive",
    model: "claude-opus-4-6",
    emoji: "👑",
    color: "#A78BFA",
    description: "CTO executive operations. Meetings, stakeholders, OKRs, hiring.",
    capabilities: ["Meeting briefs", "Slack triage", "Board narratives", "OKR tracking", "Calendar strategy", "Hiring pipeline"],
  },
  {
    profileId: "brynhildr",
    name: "Brynhildr",
    displayName: "Brynhildr — Client Director",
    model: "claude-sonnet-4-6",
    emoji: "🛡️",
    color: "#60A5FA",
    description: "Consulting delivery operations. Moral center and guardian of project truth.",
    capabilities: ["Client knowledge bases", "SOW management", "Milestone tracking", "Client health scoring", "Retrospectives", "Capacity planning"],
  },
  {
    profileId: "ragnhildr",
    name: "Ragnhildr",
    displayName: "Ragnhildr — Business Development",
    model: "claude-sonnet-4-6",
    emoji: "🗡️",
    color: "#F472B6",
    description: "Consulting business development. Pipeline, proposals, prospecting.",
    capabilities: ["CRM pipeline", "Proposal drafting", "Outbound prospecting", "Speaking engagements", "Win/loss analysis", "ICP refinement"],
  },
  {
    profileId: "gondul",
    name: "Göndul",
    displayName: "Göndul — Content Strategy",
    model: "claude-sonnet-4-6",
    emoji: "✍️",
    color: "#34D399",
    description: "Content strategy and writing across both brands. Story strategist.",
    capabilities: ["YouTube scripts", "LinkedIn calendar", "Blog posts", "White papers", "Course design", "Content repurposing"],
  },
  {
    profileId: "skuld",
    name: "Skuld",
    displayName: "Skuld — Creative Production",
    model: "claude-sonnet-4-6",
    emoji: "🎨",
    color: "#FB923C",
    description: "Full creative production studio. Visual, video, animated, illustrated assets.",
    capabilities: ["Image gen (Flux)", "Video production", "UGC avatars (HeyGen)", "Diagrams (Mermaid)", "Animation (Remotion)", "Brand assets"],
  },
  {
    profileId: "hildr",
    name: "Hildr",
    displayName: "Hildr — Marketing & Growth",
    model: "claude-sonnet-4-6",
    emoji: "📈",
    color: "#22D3EE",
    description: "Marketing strategy and growth across both brands. Builds flywheels.",
    capabilities: ["Campaign planning", "SEO strategy", "Paid ads", "Email marketing", "Funnel analytics", "Attribution modeling"],
  },
  {
    profileId: "idunn",
    name: "Iðunn",
    displayName: "Iðunn — Personal Life",
    model: "claude-sonnet-4-6",
    emoji: "🍎",
    color: "#4ADE80",
    description: "Personal life management. Guardian of wellbeing and foundation.",
    capabilities: ["Family calendar", "Health tracking", "Travel planning", "Appointments", "Home maintenance", "Learning goals"],
  },
  {
    profileId: "urdhr",
    name: "Urðr",
    displayName: "Urðr — Research & Memory",
    model: "claude-opus-4-6",
    emoji: "📚",
    color: "#818CF8",
    description: "Research and memory across all profiles. Central nervous system of coordination.",
    capabilities: ["Deep research", "Knowledge graph", "Memory consolidation", "Entity tracking", "Intelligence digests", "Semantic search"],
  },
];

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded by looking for the commander
    const existing = await ctx.db
      .query("agentProfiles")
      .withIndex("by_profileId", (q) => q.eq("profileId", "astridr"))
      .first();

    if (existing) {
      return { seeded: false, message: "Valkyrjur already seeded" };
    }

    const now = Date.now() / 1000;
    let count = 0;

    for (const agent of VALKYRJUR) {
      const avatarId = await ctx.db.insert("avatars", {
        name: agent.name,
        emoji: agent.emoji,
        color: agent.color,
        description: agent.description,
        capabilities: agent.capabilities,
        createdAt: now,
      });

      await ctx.db.insert("agentProfiles", {
        profileId: agent.profileId,
        name: agent.name,
        displayName: agent.displayName,
        model: agent.model,
        avatarId,
        createdAt: now,
        updatedAt: now,
      });

      count++;
    }

    return { seeded: true, message: `Seeded ${count} Valkyrjur agents` };
  },
});

/** Wipe and re-seed (use if data was wrong) */
export const reseed = mutation({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("agentProfiles").collect();
    for (const p of profiles) {
      if (p.avatarId) {
        try {
          await ctx.db.delete(p.avatarId);
        } catch {
          // avatar may already be gone
        }
      }
      await ctx.db.delete(p._id);
    }

    const now = Date.now() / 1000;
    let count = 0;

    for (const agent of VALKYRJUR) {
      const avatarId = await ctx.db.insert("avatars", {
        name: agent.name,
        emoji: agent.emoji,
        color: agent.color,
        description: agent.description,
        capabilities: agent.capabilities,
        createdAt: now,
      });

      await ctx.db.insert("agentProfiles", {
        profileId: agent.profileId,
        name: agent.name,
        displayName: agent.displayName,
        model: agent.model,
        avatarId,
        createdAt: now,
        updatedAt: now,
      });

      count++;
    }

    return { seeded: true, message: `Re-seeded ${count} Valkyrjur agents` };
  },
});
