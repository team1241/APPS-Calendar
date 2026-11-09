import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthedUser } from "./users";
import { requireEventCreator } from "./lib/auth";
import { getUserRole, isAdminRole } from "./lib/userAccess";
import { listEventsInRange } from "./lib/calendarReads";

export const listByRange = query({
  args: { start: v.number(), end: v.number() },
  handler: async (ctx, args) => {
    if (!(await getAuthedUser(ctx))) return [];
    return await listEventsInRange(ctx, args.start, args.end);
  },
});

export const get = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    if (!(await getAuthedUser(ctx))) return null;
    return await ctx.db.get("events", args.eventId);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    allDay: v.boolean(),
    eventTypeId: v.id("eventTypes"),
    subteams: v.array(v.id("subteams")),
    organizer: v.string(),
    location: v.string(),
    info: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireEventCreator(ctx);
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
    title: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    allDay: v.optional(v.boolean()),
    eventTypeId: v.optional(v.id("eventTypes")),
    subteams: v.optional(v.array(v.id("subteams"))),
    organizer: v.optional(v.string()),
    location: v.optional(v.string()),
    info: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireEventCreator(ctx);
    const { eventId, ...patch } = args;
    const event = await ctx.db.get("events", eventId);
    if (!event) throw new Error("Event not found");
    if (!isAdminRole(getUserRole(user)) && event.author !== user._id) {
      throw new Error("You can only edit events you created");
    }
    await ctx.db.patch("events", eventId, { ...patch, updatedAt: Date.now() });
    return null;
  },
});

export const remove = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const user = await requireEventCreator(ctx);
    const event = await ctx.db.get("events", args.eventId);
    if (!event) return null;
    if (!isAdminRole(getUserRole(user)) && event.author !== user._id) {
      throw new Error("You can only delete events you created");
    }
    await ctx.db.delete("events", args.eventId);
    return null;
  },
});
