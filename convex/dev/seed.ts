import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { requireAdmin } from "../users";

function utcDay(offset: number, hour = 0): number { const today = new Date(); return Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset, hour); }

export const seedMockData = mutation({ args: {}, handler: async (ctx) => {
  const user = await requireAdmin(ctx); const eventTypeName = "standard events";
  const existingEventType = await ctx.db.query("eventTypes").withIndex("by_name", (q) => q.eq("name", eventTypeName)).unique();
  const eventTypeId = existingEventType?._id ?? (await ctx.db.insert("eventTypes", { name: eventTypeName, updatedAt: Date.now() }));
  const subteamNames = ["Programming", "Manufacturing", "Electrical", "Design"];
  const subteamIds = new Map<string, Id<"subteams">>();
  for (const subteamName of subteamNames) { const existingSubteam = await ctx.db.query("subteams").withIndex("by_subteamName", (q) => q.eq("subteamName", subteamName)).unique(); const subteamId = existingSubteam?._id ?? (await ctx.db.insert("subteams", { subteamName, updatedAt: Date.now() })); subteamIds.set(subteamName, subteamId); }
  const programming = subteamIds.get("Programming"); const manufacturing = subteamIds.get("Manufacturing"); const electrical = subteamIds.get("Electrical"); const design = subteamIds.get("Design");
  if (!programming || !manufacturing || !electrical || !design) throw new Error("Unable to prepare mock subteams");
  const mockEvents: Array<{ title: string; start: number; end: number; allDay?: boolean; subteams: Id<"subteams">[]; location: string; info: string }> = [
    { title: "[Demo] CAD Design Review", start: utcDay(-2, 18), end: utcDay(-2, 20), subteams: [design], location: "Design Lab", info: "Review the latest chassis and mechanism updates." },
    { title: "[Demo] Electrical Systems Check", start: utcDay(-1, 17), end: utcDay(-1, 19), subteams: [electrical], location: "Electrical Bay", info: "Run a wiring and battery inspection before integration." },
    { title: "[Demo] Programming Standup", start: utcDay(0, 16), end: utcDay(0, 17), subteams: [programming], location: "Programming Room", info: "Share blockers and confirm the next software tasks." },
    { title: "[Demo] Manufacturing Shop Session", start: utcDay(1, 18), end: utcDay(1, 20), subteams: [manufacturing], location: "Shop Bay 1", info: "Fabricate the remaining drivetrain brackets." },
    { title: "[Demo] Multi-team Integration", start: utcDay(2, 17), end: utcDay(2, 19), subteams: [programming, electrical, design], location: "Practice Field", info: "Verify that the robot subsystems work together." },
    { title: "[Demo] All-day Build Week", start: utcDay(3), end: utcDay(5, 23), allDay: true, subteams: [programming, manufacturing, electrical, design], location: "FRC 1241 Workshop", info: "A multi-day all-day event for testing calendar spanning behavior." },
    { title: "[Demo] Strategy & Outreach", start: utcDay(6, 10), end: utcDay(6, 11), subteams: [design], location: "Meeting Room", info: "Prepare the event plan and outreach materials." },
    { title: "[Demo] Weekend Fabrication Sprint", start: utcDay(9, 9), end: utcDay(9, 13), subteams: [manufacturing, electrical], location: "Workshop", info: "Longer timed event for testing week layout and overlap." },
    { title: "[Demo] Regional Competition", start: utcDay(14), end: utcDay(15, 23), allDay: true, subteams: [programming, manufacturing, electrical, design], location: "Regional Event", info: "A multi-day all-day event for testing month banners." },
  ];
  let created = 0;
  for (const mockEvent of mockEvents) { const existing = await ctx.db.query("events").withIndex("by_title", (q) => q.eq("title", mockEvent.title)).unique(); if (existing) continue; await ctx.db.insert("events", { title: mockEvent.title, startTime: mockEvent.start, endTime: mockEvent.end, allDay: mockEvent.allDay ?? false, eventTypeId, subteams: mockEvent.subteams, organizer: "APPS Calendar Demo", author: user._id, location: mockEvent.location, info: mockEvent.info, updatedAt: Date.now() }); created += 1; }
  return { created, total: mockEvents.length };
} });
