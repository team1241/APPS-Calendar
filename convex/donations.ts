import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAuthedUser, requireAdmin } from "./users";

export const record = mutation({
  args: { dollarAmount: v.number() },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    return await ctx.db.insert("donations", {
      userId: user._id,
      dollarAmount: args.dollarAmount,
      updatedAt: Date.now(),
    });
  },
});

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthedUser(ctx);
    return await ctx.db
      .query("donations")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(200);
  },
});

export const listAll = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.query("donations").order("desc").paginate(args.paginationOpts);
  },
});
