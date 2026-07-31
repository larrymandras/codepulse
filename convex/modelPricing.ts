/**
 * convex/modelPricing.ts — Phase 104 (Cost Intelligence).
 *
 * Rates live in Convex, not in code (D-02): an operator can add or correct a
 * model's rate here without a code change or a Convex deploy. This is the
 * runtime source of truth every dollar figure in the product is derived
 * from — src/lib/modelPricing.ts is a SEED SOURCE ONLY as of this phase
 * (see its own header comment).
 *
 * D-03 is load-bearing throughout this file: a model with no pricing row is
 * NEVER silently valued at a default rate. `resolveRate` below has exactly
 * two hit paths (exact model, then subscription shadow) and one miss path
 * (null) — there is no third branch and no `default`-row fallback.
 *
 * This file intentionally never reads the raw per-call LLM metrics table.
 * The "which models are unpriced" question has exactly one owner in this
 * phase — `convex/costDerived.ts` `unpricedModels` (plan 104-05) — so the
 * nudge count and the breakdown table can never disagree.
 */
import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { GATEWAY_PROVIDERS } from "./lib/providers";
import type { Id } from "./_generated/dataModel";

// ============================================================
// Types (exported — plans 03-11 consume these exact names)
// ============================================================

export type PricingRow = {
  _id: Id<"modelPricing">;
  model: string;
  inputPerToken: number;
  outputPerToken: number;
  cacheReadPerToken?: number;
  cacheWritePerToken?: number;
  shadowForProvider?: string;
  source: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

export type RateIndex = {
  byModel: Map<string, PricingRow>;
  byShadowProvider: Map<string, PricingRow>;
};

// ============================================================
// Pure helpers — no Convex ctx, unit-testable without convex-test
// (follows the SDKSpendGuard.tsx / gatewayQuota.ts:deduplicateByProvider
// convention of exporting pure functions for tests)
// ============================================================

/**
 * Builds a two-index lookup over the modelPricing rows: one keyed on exact
 * model id, one keyed on the D-06 shadow-provider fallback. Rows whose
 * `shadowForProvider` is undefined are skipped from the shadow index.
 */
export function buildRateIndex(rows: PricingRow[]): RateIndex {
  const byModel = new Map<string, PricingRow>();
  const byShadowProvider = new Map<string, PricingRow>();
  for (const row of rows) {
    byModel.set(row.model, row);
    if (row.shadowForProvider !== undefined) {
      byShadowProvider.set(row.shadowForProvider, row);
    }
  }
  return { byModel, byShadowProvider };
}

/**
 * Resolution order (D-03 — exactly this, no more):
 *   1. exact model hit  -> { rate, via: "model" }
 *   2. subscription turn whose provider has a shadow row -> { rate, via: "shadow" }
 *   3. otherwise -> null
 *
 * There is NO default-rate fallback. A row whose model id happens to be the
 * literal word default is matched only by an exact model-id lookup in step
 * 1, never treated as a catch-all.
 */
export function resolveRate(
  dims: { provider: string; model: string; billingType: string },
  index: RateIndex
): { rate: PricingRow; via: "model" | "shadow" } | null {
  const modelHit = index.byModel.get(dims.model);
  if (modelHit) {
    return { rate: modelHit, via: "model" };
  }
  if (dims.billingType === "subscription") {
    const shadowHit = index.byShadowProvider.get(dims.provider);
    if (shadowHit) {
      return { rate: shadowHit, via: "shadow" };
    }
  }
  return null;
}

/** Prices a call's tokens against a resolved rate row. Ignores cache-token fields this phase. */
export function priceTokens(
  promptTokens: number,
  completionTokens: number,
  rate: PricingRow
): number {
  return promptTokens * rate.inputPerToken + completionTokens * rate.outputPerToken;
}

// ============================================================
// Write mutations — every handler opens with the Clerk identity gate
// (T-104-01, reproduced verbatim from convex/alertRuleCustom.ts:46-48)
// ============================================================

const RATE_RANGE_MESSAGE =
  "Rates are per token (e.g. 0.000005 for $5/Mtok). Value must be greater than 0 and less than 1.";

function assertValidRate(value: number): void {
  if (!(value > 0 && value < 1)) {
    throw new ConvexError(RATE_RANGE_MESSAGE);
  }
}

function assertValidShadowProvider(shadowForProvider: string | undefined): void {
  if (shadowForProvider === undefined) return;
  if (!(GATEWAY_PROVIDERS as readonly string[]).includes(shadowForProvider)) {
    throw new ConvexError(
      `shadowForProvider must be one of ${GATEWAY_PROVIDERS.join(", ")}`
    );
  }
}

export const create = mutation({
  args: {
    model: v.string(),
    inputPerToken: v.float64(),
    outputPerToken: v.float64(),
    shadowForProvider: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // T-104-01: Require authenticated Clerk identity.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const model = args.model.trim();
    if (model.length === 0) {
      throw new ConvexError("Model id is required");
    }
    assertValidRate(args.inputPerToken);
    assertValidRate(args.outputPerToken);
    assertValidShadowProvider(args.shadowForProvider);

    const existing = await ctx.db
      .query("modelPricing")
      .withIndex("by_model", (q) => q.eq("model", model))
      .first();
    if (existing) {
      throw new ConvexError("A pricing rate already exists for this model");
    }

    const now = Date.now() / 1000;
    return await ctx.db.insert("modelPricing", {
      model,
      inputPerToken: args.inputPerToken,
      outputPerToken: args.outputPerToken,
      shadowForProvider: args.shadowForProvider,
      source: "manual",
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("modelPricing"),
    inputPerToken: v.optional(v.float64()),
    outputPerToken: v.optional(v.float64()),
    shadowForProvider: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // T-104-01: Require authenticated Clerk identity.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    if (args.inputPerToken !== undefined) assertValidRate(args.inputPerToken);
    if (args.outputPerToken !== undefined) assertValidRate(args.outputPerToken);
    if (args.shadowForProvider !== undefined) assertValidShadowProvider(args.shadowForProvider);

    const { id, ...rest } = args;
    await ctx.db.patch(id, {
      ...rest,
      updatedAt: Date.now() / 1000,
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("modelPricing"),
  },
  handler: async (ctx, args) => {
    // T-104-01: Require authenticated Clerk identity.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    await ctx.db.delete(args.id);
  },
});

// ============================================================
// Read queries — no identity gate (matches the sibling read convention)
// ============================================================

export const list = query({
  args: {},
  handler: async (ctx) => {
    // small table (order 10s of rows) — full scan is intentional and bounded by design (D-02)
    return await ctx.db.query("modelPricing").collect();
  },
});

export const get = query({
  args: { id: v.id("modelPricing") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ============================================================
// Seed — idempotent, additive-only
// ============================================================

/**
 * Manual invocation: `npx convex run modelPricing:seedDefaults '{}'`
 *
 * Must be run once before plan 104-09's surfaces (breakdown table, unpriced
 * nudge, budget panels) are useful — it is what populates the rate rows and
 * D-06 shadow rows those surfaces read. Not registered as a cron
 * (convex/crons.ts) — per CLAUDE.md's self-hosted Convex rules, no bulk
 * mutation runs unattended against the live instance; this is an
 * operator-triggered, one-time (idempotent) seed.
 *
 * IDEMPOTENT and ADDITIVE ONLY: for each seed entry, reads `by_model` first
 * and skips if a row already exists. Never patches an existing row and
 * never deletes anything.
 */
type SeedEntry = {
  model: string;
  inputPerToken: number;
  outputPerToken: number;
  shadowForProvider?: string;
  notes?: string;
};

const PER_MTOK = 1_000_000;

const SEED_MODELS: SeedEntry[] = [
  // ---- Part A: copied verbatim from src/lib/modelPricing.ts's PRICING map,
  // EXCLUDING its catch-all fallback key (D-03: no fallback row is ever
  // seeded). ----
  { model: "claude-opus-4-5", inputPerToken: 5.00 / PER_MTOK, outputPerToken: 25.00 / PER_MTOK },
  { model: "claude-opus-4-6", inputPerToken: 5.00 / PER_MTOK, outputPerToken: 25.00 / PER_MTOK },
  { model: "claude-opus-4-7", inputPerToken: 5.00 / PER_MTOK, outputPerToken: 25.00 / PER_MTOK },
  { model: "claude-opus-4-8", inputPerToken: 5.00 / PER_MTOK, outputPerToken: 25.00 / PER_MTOK },
  { model: "claude-sonnet-4-5", inputPerToken: 3.00 / PER_MTOK, outputPerToken: 15.00 / PER_MTOK },
  { model: "claude-sonnet-4-6", inputPerToken: 3.00 / PER_MTOK, outputPerToken: 15.00 / PER_MTOK },
  { model: "claude-haiku-3-5", inputPerToken: 0.80 / PER_MTOK, outputPerToken: 4.00 / PER_MTOK },
  { model: "claude-haiku-4-5", inputPerToken: 0.80 / PER_MTOK, outputPerToken: 4.00 / PER_MTOK },
  { model: "gpt-4o", inputPerToken: 2.50 / PER_MTOK, outputPerToken: 10.00 / PER_MTOK },
  { model: "gpt-4o-mini", inputPerToken: 0.15 / PER_MTOK, outputPerToken: 0.60 / PER_MTOK },
  { model: "gemini-2.5-pro", inputPerToken: 1.25 / PER_MTOK, outputPerToken: 10.00 / PER_MTOK },
  { model: "gemini-2.5-flash", inputPerToken: 0.30 / PER_MTOK, outputPerToken: 2.50 / PER_MTOK },
  { model: "gemini-3.5-flash", inputPerToken: 1.50 / PER_MTOK, outputPerToken: 9.00 / PER_MTOK },
  { model: "gemini-3.1-pro-preview", inputPerToken: 2.00 / PER_MTOK, outputPerToken: 12.00 / PER_MTOK },
  { model: "gemini-3.1-flash-lite", inputPerToken: 0.25 / PER_MTOK, outputPerToken: 1.50 / PER_MTOK },

  // ---- Part B: the three models REQUIREMENTS.md COST-01 names that have
  // no entry in the code table today (D-02's verified gap). Published
  // Anthropic list rates, expressed per token. ----
  {
    model: "claude-opus-5",
    inputPerToken: 5.00 / PER_MTOK,
    outputPerToken: 25.00 / PER_MTOK,
    notes: "Seeded Phase 104 — verify against the current published rate card",
  },
  {
    model: "claude-sonnet-5",
    inputPerToken: 3.00 / PER_MTOK,
    outputPerToken: 15.00 / PER_MTOK,
    notes: "Seeded Phase 104 — verify against the current published rate card",
  },
  {
    model: "claude-fable-5",
    inputPerToken: 3.00 / PER_MTOK,
    outputPerToken: 15.00 / PER_MTOK,
    notes: "Seeded Phase 104 — verify against the current published rate card",
  },

  // ---- Two live model ids RESEARCH.md observed in production metrics that
  // are the same model under a differently-prefixed id. ----
  { model: "claude-haiku-4-5-20251001", inputPerToken: 0.80 / PER_MTOK, outputPerToken: 4.00 / PER_MTOK },
  { model: "google/gemini-2.5-flash", inputPerToken: 0.30 / PER_MTOK, outputPerToken: 2.50 / PER_MTOK },

  // Deliberately NOT seeded: google/gemini-3.6-flash, gpt-4.1, grok-4.5 —
  // no verified rate exists for these; leaving them unseeded lets D-03's
  // Unpriced path and plan 104-09's nudge surface them for an operator to
  // price, rather than shipping a guessed rate.
];

const SHADOW_MTOK_OPUS = { input: 5.00 / PER_MTOK, output: 25.00 / PER_MTOK };
const SHADOW_MTOK_SONNET = { input: 3.00 / PER_MTOK, output: 15.00 / PER_MTOK };
const SHADOW_NOTES =
  "D-06 shadow rate — prices subscription turns to show what they would have cost on API billing. Not billed.";

// ---- Part C: one D-06 shadow-mapping row per subscription-billed
// GATEWAY_PROVIDERS entry. claude-sdk is deliberately excluded — it is
// "api"-billed and prices on its own reported model id. ----
const SEED_SHADOW_ROWS: SeedEntry[] = [
  {
    model: "claude-cli",
    inputPerToken: SHADOW_MTOK_OPUS.input,
    outputPerToken: SHADOW_MTOK_OPUS.output,
    shadowForProvider: "claude-cli",
    notes: SHADOW_NOTES,
  },
  {
    model: "codex",
    inputPerToken: SHADOW_MTOK_OPUS.input,
    outputPerToken: SHADOW_MTOK_OPUS.output,
    shadowForProvider: "codex",
    notes: SHADOW_NOTES,
  },
  {
    model: "antigravity",
    inputPerToken: SHADOW_MTOK_SONNET.input,
    outputPerToken: SHADOW_MTOK_SONNET.output,
    shadowForProvider: "antigravity",
    notes: SHADOW_NOTES,
  },
];

/** Pure — exported so the idempotency/content behavior is unit-testable without a live ctx. */
export function buildSeedSet(): SeedEntry[] {
  return [...SEED_MODELS, ...SEED_SHADOW_ROWS];
}

export const seedDefaults = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    let inserted = 0;
    for (const entry of buildSeedSet()) {
      const existing = await ctx.db
        .query("modelPricing")
        .withIndex("by_model", (q) => q.eq("model", entry.model))
        .first();
      if (existing) continue;
      await ctx.db.insert("modelPricing", {
        model: entry.model,
        inputPerToken: entry.inputPerToken,
        outputPerToken: entry.outputPerToken,
        shadowForProvider: entry.shadowForProvider,
        source: "seed",
        notes: entry.notes,
        createdAt: now,
        updatedAt: now,
      });
      inserted++;
    }
    return { inserted };
  },
});
