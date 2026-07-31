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
import { mutation, query } from "./_generated/server";
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
