import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthedUser } from "./users";

export const subscribe = mutation({
  args: { eventId: v.id("events"), subteamId: v.id("subteams") },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("eventId"), args.eventId))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("subscriptions", {
      userId: user._id,
      eventId: args.eventId,
      subteamId: args.subteamId,
      updatedAt: Date.now(),
    });
  },
});

export const unsubscribe = mutation({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    const sub = await ctx.db.get("subscriptions", args.subscriptionId);
    if (!sub) return null;
    if (sub.userId !== user._id) throw new Error("Not authorized");
    await ctx.db.delete("subscriptions", args.subscriptionId);
    return null;
  },
});

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthedUser(ctx);
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(200);
  },
});
