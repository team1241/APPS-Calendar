import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    // Grade level for students, or "mentor" for mentors
    userType: v.union(
      v.literal("9"),
      v.literal("10"),
      v.literal("11"),
      v.literal("12"),
      v.literal("mentor"),
    ),
    subteams: v.array(v.id("subteams")),
    clerkId: v.string(),
    isAdmin: v.boolean(),
    isSignupComplete: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  events: defineTable({
    startTime: v.number(),
    endTime: v.number(),
    eventTypeId: v.id("eventTypes"),
    subteams: v.array(v.id("subteams")),
    organizer: v.string(),
    author: v.id("users"),
    location: v.string(),
    info: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_startTime", ["startTime"])
    .index("by_eventTypeId", ["eventTypeId"])
    .index("by_author", ["author"]),

  subteams: defineTable({
    subteamName: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_subteamName", ["subteamName"]),

  subscriptions: defineTable({
    userId: v.id("users"),
    eventId: v.id("events"),
    subteamId: v.id("subteams"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_eventId", ["eventId"])
    .index("by_subteamId", ["subteamId"]),

  donations: defineTable({
    userId: v.id("users"),
    dollarAmount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  // Example values seen in the source spreadsheet: "holidays",
  // "standard events", "robotics meetings", "announcements".
  // Holiday-type events are populated from an external calendar library
  // and stored as normal rows in `events`.
  eventTypes: defineTable({
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),
});
