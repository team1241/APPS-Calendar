import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./users";

// Seed values from the original spec: "holidays", "standard events",
// "robotics meetings", "announcements". Insert these once via `create`
// after the schema is pushed (e.g. from the Convex dashboard function
// runner, or a one-off script).

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("eventTypes").order("asc").take(50);
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();
    return await ctx.db.insert("eventTypes", {
      name: args.name,
      createdAt: now,
      updatedAt: now,
    });
  },
});
