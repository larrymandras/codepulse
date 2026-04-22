import { z } from "zod";

// Step 1: Template Selection
export const templateSchema = z.object({
  catalogEntryId: z.string().optional(),
  catalogEntryName: z.string().optional(),
});

// Step 2: Identity
export const identitySchema = z.object({
  agentId: z
    .string()
    .min(1, "Agent ID is required")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only")
    .max(50, "Agent ID must be 50 characters or less"),
  displayName: z.string().min(1, "Display name is required").max(100),
  tier: z.enum(["command", "domain", "shared"], {
    message: "Tier is required",
  }),
  description: z.string().max(500).optional(),
  profiles: z.array(z.string()).optional(),
  imageStorageId: z.string().optional(),
  emoji: z.string().optional(),
  emojiColor: z.string().optional(),
  // Advanced fields
  reportsTo: z.string().optional(),
  channels: z.array(z.string()).optional(),
  budgetFraction: z.number().min(0).max(1).optional(),
  timeoutSeconds: z.number().int().positive().optional(),
  maxRounds: z.number().int().positive().optional(),
});

// Step 3: Personality
export const personalitySchema = z.object({
  mode: z.enum(["template", "custom", "import"]),
  content: z.string().optional(),
  systemPromptOverride: z.string().optional(),
  soulVariantPath: z.string().optional(),
  l1Index: z.string().optional(),
  l2TopicsDir: z.string().optional(),
  l3LogsDir: z.string().optional(),
});

// Step 4: Tools
export const toolsSchema = z.object({
  mode: z.enum(["glob", "individual"]),
  patterns: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  autonomyRules: z
    .array(
      z.object({
        pattern: z.string(),
        level: z.enum(["full", "supervised", "manual"]),
      }),
    )
    .optional(),
  peerCommAllowed: z.array(z.string()).optional(),
  dailyRhythm: z
    .array(
      z.object({
        cron: z.string(),
        task: z.string(),
      }),
    )
    .optional(),
});

// Step 5: Deployment
export const deploymentSchema = z.object({
  type: z.enum(["permanent", "ephemeral"]),
  ttlSeconds: z.number().int().positive().optional(),
});

// Full wizard form
export const wizardFormSchema = z.object({
  template: templateSchema,
  identity: identitySchema,
  personality: personalitySchema,
  tools: toolsSchema,
  deployment: deploymentSchema,
});

export type WizardFormData = z.infer<typeof wizardFormSchema>;
export type TemplateData = z.infer<typeof templateSchema>;
export type IdentityData = z.infer<typeof identitySchema>;
export type PersonalityData = z.infer<typeof personalitySchema>;
export type ToolsData = z.infer<typeof toolsSchema>;
export type DeploymentData = z.infer<typeof deploymentSchema>;

// Step schemas indexed by step number (0-based)
export const stepSchemas = [
  templateSchema,
  identitySchema,
  personalitySchema,
  toolsSchema,
  deploymentSchema,
] as const;

export const STEP_LABELS = [
  "Template",
  "Identity",
  "Personality",
  "Tools",
  "Review & Deploy",
] as const;
