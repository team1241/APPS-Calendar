import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  listAllSubteams,
  listEventsInRange,
  listRecentAnnouncements,
} from "./lib/calendarReads";

const MIN_DISPLAY_TOKEN_LENGTH = 32;

/**
 * @brief Constant-time check of a token against the DISPLAY_TOKEN env var.
 * @return false when DISPLAY_TOKEN is unset or too short to be safe.
 */
function isValidDisplayToken(token: string): boolean {
  const expected = process.env.DISPLAY_TOKEN;
  if (!expected || expected.length < MIN_DISPLAY_TOKEN_LENGTH) {
    return false;
  }
  if (token.length !== expected.length) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < expected.length; i++) {
    difference |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return difference === 0;
}

/**
 * @brief Read-only data for the wall display, authorized by the display token instead of a login.
 * @return null when the token is wrong.
 */
export const feed = query({
  args: { end: v.number(), start: v.number(), token: v.string() },
  handler: async (ctx, args) => {
    if (!isValidDisplayToken(args.token)) {
      return null;
    }
    const [events, announcements, subteams] = await Promise.all([
      listEventsInRange(ctx, args.start, args.end),
      listRecentAnnouncements(ctx),
      listAllSubteams(ctx),
    ]);
    return { announcements, events, subteams };
  },
});
