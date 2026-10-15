import type { QueryCtx } from "../_generated/server";

const MAX_EVENTS_PER_SIDE = 200;
const MAX_ANNOUNCEMENTS = 100;
const MAX_SUBTEAMS = 50;

/**
 * @brief Events overlapping [start, end], including ones that began before start.
 */
export async function listEventsInRange(
  ctx: QueryCtx,
  start: number,
  end: number
) {
  const startingInRange = await ctx.db
    .query("events")
    .withIndex("by_startTime", (q) =>
      q.gte("startTime", start).lte("startTime", end)
    )
    .order("asc")
    .take(MAX_EVENTS_PER_SIDE);

  const startingBeforeRange = await ctx.db
    .query("events")
    .withIndex("by_startTime", (q) => q.lt("startTime", start))
    .order("desc")
    .take(MAX_EVENTS_PER_SIDE);

  return [...startingBeforeRange, ...startingInRange].filter(
    (event, index, all) =>
      event.endTime >= start &&
      all.findIndex((candidate) => candidate._id === event._id) === index
  );
}

/**
 * @brief Most recently updated announcements, newest first.
 */
export async function listRecentAnnouncements(ctx: QueryCtx) {
  return await ctx.db
    .query("announcements")
    .withIndex("by_updatedAt")
    .order("desc")
    .take(MAX_ANNOUNCEMENTS);
}

/**
 * @brief All subteams.
 */
export async function listAllSubteams(ctx: QueryCtx) {
  return await ctx.db.query("subteams").order("asc").take(MAX_SUBTEAMS);
}
