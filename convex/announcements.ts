import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireAuthedUser } from "./users";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("announcements")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(100);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    snippet: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    return await ctx.db.insert("announcements", {
      ...args,
      author: user._id,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { announcementId: v.id("announcements") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const ann = await ctx.db.get("announcements", args.announcementId);
    if (!ann) return null;
    await ctx.db.delete("announcements", args.announcementId);
    return null;
  },
});
