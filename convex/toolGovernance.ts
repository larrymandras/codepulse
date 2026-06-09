import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// TOOL GOVERNANCE — per-tool prune/disable flags (Phase 73, MCP-03)
// ============================================================
//
// The MCP Inventory surface lets an operator disable ("prune") a tool. We
// persist that decision here as a governance flag, idempotent by `toolName`.
//
// IMPORTANT: this is the CodePulse side of governance only. Actually preventing
// Ástríðr from loading/exposing a disabled tool requires an Ástríðr-side
// enforcement endpoint that reads this flag — that does NOT exist yet and is
// tracked as a follow-up. This table is the source of truth that endpoint would
// consume; flipping it here is a no-op on the agent until then.

export const listGovernance = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("toolGovernance").collect();
  },
});

/**
 * Toggle (or explicitly set) a tool's disabled flag. Upserts by toolName so the
 * chip can flip state idempotently without creating duplicate rows.
 *
 * - `disabled` omitted → flips the current value (defaults to disabling a tool
 *   that has no row yet).
 * - `disabled` provided → sets it exactly.
 */
export const setToolDisabled = mutation({
  args: {
    toolName: v.string(),
    disabled: v.optional(v.boolean()),
    updatedBy: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    const existing = await ctx.db
      .query("toolGovernance")
      .withIndex("by_toolName", (q) => q.eq("toolName", args.toolName))
      .first();

    const nextDisabled =
      args.disabled ?? (existing ? !existing.disabled : true);

    if (existing) {
      await ctx.db.patch(existing._id, {
        disabled: nextDisabled,
        updatedAt: now,
        updatedBy: args.updatedBy ?? existing.updatedBy,
        note: args.note ?? existing.note,
      });
    } else {
      await ctx.db.insert("toolGovernance", {
        toolName: args.toolName,
        disabled: nextDisabled,
        updatedAt: now,
        updatedBy: args.updatedBy,
        note: args.note,
      });
    }

    return { toolName: args.toolName, disabled: nextDisabled };
  },
});
