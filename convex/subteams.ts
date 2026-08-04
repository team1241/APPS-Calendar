import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./users";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("subteams").order("asc").take(50);
  },
});

export const create = mutation({
  args: { subteamName: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.insert("subteams", {
      subteamName: args.subteamName,
      updatedAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: { subteamId: v.id("subteams"), subteamName: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch("subteams", args.subteamId, {
      subteamName: args.subteamName,
      updatedAt: Date.now(),
    });
    return null;
  },
});
