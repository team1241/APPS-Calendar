import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type {
  CalendarAnnouncement,
  CalendarEvent,
  CategoryKey,
} from "./calendar";

/**
 * @brief Converts Convex event documents into calendar events, mapping subteam IDs to category keys.
 */
export function toCalendarEvents(
  convexEvents: Doc<"events">[] | undefined,
  subteamIdToKey: Map<Id<"subteams">, CategoryKey>
): CalendarEvent[] {
  if (!convexEvents) {
    return [];
  }
  return convexEvents.map((event) => ({
    allDay: event.allDay,
    createdAt: new Date(event.updatedAt),
    end: new Date(event.endTime),
    id: event._id,
    info: event.info ?? undefined,
    location: event.location,
    organizer: event.organizer,
    start: new Date(event.startTime),
    subteams: event.subteams
      .map((id) => subteamIdToKey.get(id))
      .filter((key): key is CategoryKey => key !== undefined),
    title: event.title,
  }));
}

/**
 * @brief Converts Convex announcement documents into calendar announcements.
 */
export function toCalendarAnnouncements(
  convexAnnouncements: Doc<"announcements">[] | undefined
): CalendarAnnouncement[] {
  if (!convexAnnouncements) {
    return [];
  }
  return convexAnnouncements.map((announcement) => ({
    date: new Date(announcement.updatedAt),
    id: announcement._id,
    snippet: announcement.snippet,
    title: announcement.title,
  }));
}
