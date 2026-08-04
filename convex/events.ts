import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthedUser } from "./users";

export const listByRange = query({
  args: { start: v.number(), end: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_startTime", (q) =>
        q.gte("startTime", args.start).lte("startTime", args.end),
      )
      .order("asc")
      .take(200);
  },
});

export const get = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    return await ctx.db.get("events", args.eventId);
  },
});

export const create = mutation({
  args: {
    startTime: v.number(),
    endTime: v.number(),
    eventTypeId: v.id("eventTypes"),
    subteams: v.array(v.id("subteams")),
    organizer: v.string(),
    location: v.string(),
    info: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    return await ctx.db.insert("events", {
      ...args,
      author: user._id,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    eventId: v.id("events"),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    eventTypeId: v.optional(v.id("eventTypes")),
    subteams: v.optional(v.array(v.id("subteams"))),
    organizer: v.optional(v.string()),
    location: v.optional(v.string()),
    info: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    const { eventId, ...patch } = args;
    const event = await ctx.db.get("events", eventId);
    if (!event) throw new Error("Event not found");
    if (event.author !== user._id && !user.isAdmin) {
      throw new Error("Not authorized to edit this event");
    }
    await ctx.db.patch("events", eventId, { ...patch, updatedAt: Date.now() });
    return null;
  },
});

export const remove = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    const event = await ctx.db.get("events", args.eventId);
    if (!event) return null;
    if (event.author !== user._id && !user.isAdmin) {
      throw new Error("Not authorized to delete this event");
    }
    await ctx.db.delete("events", args.eventId);
    return null;
  },
});
