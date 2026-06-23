import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// KG-10: Saved Views persistence layer.
//
// Global-scope (D-02): no owner/user field. Any operator on this CodePulse
// instance can read all saved views. Matches single-operator/team reality where
// Clerk auth is optional and often off.
//
// Share tokens (D-03): generated client-side via crypto.randomUUID() in
// useSavedViews.saveView() and passed in as an arg. This avoids any uncertainty
// about Convex runtime crypto availability.

// ---------------------------------------------------------------------------
// save — persist a new named KG view
// ---------------------------------------------------------------------------

export const save = mutation({
  args: {
    name: v.string(),
    lens: v.string(),
    filters: v.any(),       // KgFilters minus searchQuery (D-06)
    focus: v.string(),      // entityName for Entity/Temporal (D-05)
    hops: v.float64(),      // hop depth (D-05)
    shareToken: v.string(), // opaque UUID generated client-side (D-03)
    createdAt: v.float64(), // epoch ms
  },
  handler: async (ctx, args) => {
    // T-87-01: reject empty and over-long names (ASVS V5 input validation)
    const trimmed = args.name.trim();
    if (trimmed.length < 1) {
      throw new Error("View name cannot be empty.");
    }
    if (trimmed.length > 100) {
      throw new Error("View name cannot exceed 100 characters.");
    }
    // Persist the validated (trimmed) name — don't rely on the client having
    // trimmed it. The server is the validation boundary.
    return await ctx.db.insert("savedKgViews", { ...args, name: trimmed });
  },
});

// ---------------------------------------------------------------------------
// list — return all views newest-first (by createdAt index)
// ---------------------------------------------------------------------------

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("savedKgViews")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
  },
});

// ---------------------------------------------------------------------------
// remove — delete a view by its Convex _id
// ---------------------------------------------------------------------------

export const remove = mutation({
  args: { id: v.id("savedKgViews") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ---------------------------------------------------------------------------
// getByShareToken — resolve a view by its opaque share token (D-03)
// T-87-02: exact index match on by_shareToken; malformed/non-matching token
// returns null with no reflected content and no error leak.
// ---------------------------------------------------------------------------

export const getByShareToken = query({
  args: { shareToken: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("savedKgViews")
      .withIndex("by_shareToken", (q) => q.eq("shareToken", args.shareToken))
      .first();
  },
});
