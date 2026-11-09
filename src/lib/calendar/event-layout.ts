import { isMultiDayEvent } from "./calendar-dates";
import type { CalendarEvent } from "./types";
export const DAY_START = 7;
export const DAY_END = 21;
export const HOUR_HEIGHT = 52;
export const WEEK_HEADER_HEIGHT = 72;

/** Events starting within this many minutes of each other share the row side by side. */
const SIDE_BY_SIDE_MINUTES = 30;
/** Horizontal indent, in percent of the day column, per level of cascading overlap. */
const CASCADE_INDENT_PERCENT = 14;
const MAX_CASCADE_INDENT_PERCENT = 42;
/** Events shorter than this render title and time on a single line. */
const COMPACT_MAX_MINUTES = 45;

export interface TimedEventLayout {
  /** Whether the event is too short for separate title and time lines. */
  compact: boolean;
  /** Duration in hours of the visible part of the event. */
  durationHours: number;
  event: CalendarEvent;
  /** Left edge, in percent of the day column. */
  leftPercent: number;
  /** Start offset in hours from DAY_START. */
  startHours: number;
  /** Width, in percent of the day column. */
  widthPercent: number;
  zIndex: number;
}

const minutesSinceDayStart = (date: Date): number =>
  date.getHours() * 60 + date.getMinutes() - DAY_START * 60;

const overlaps = (first: CalendarEvent, second: CalendarEvent): boolean =>
  first.start < second.end && first.end > second.start;

export function getTimedEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events
    .filter((event) => !(event.allDay || isMultiDayEvent(event)))
    .sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() ||
        b.end.getTime() - a.end.getTime()
    );
}

/** @brief Splits start-sorted events into runs that transitively overlap. */
function createTimedClusters(events: CalendarEvent[]): CalendarEvent[][] {
  const clusters: CalendarEvent[][] = [];
  let clusterEnd = Number.NEGATIVE_INFINITY;
  for (const event of events) {
    const current = clusters.at(-1);
    if (current && event.start.getTime() < clusterEnd) {
      current.push(event);
      clusterEnd = Math.max(clusterEnd, event.end.getTime());
    } else {
      clusters.push([event]);
      clusterEnd = event.end.getTime();
    }
  }
  return clusters;
}

/** @brief Groups a cluster's events that start close enough together to sit side by side. */
function createStartGroups(cluster: CalendarEvent[]): CalendarEvent[][] {
  const groups: CalendarEvent[][] = [];
  for (const event of cluster) {
    const current = groups.at(-1);
    const groupStart = current?.[0].start.getTime();
    const isNearGroupStart =
      groupStart !== undefined &&
      event.start.getTime() - groupStart < SIDE_BY_SIDE_MINUTES * 60_000;
    if (current && isNearGroupStart) {
      current.push(event);
    } else {
      groups.push([event]);
    }
  }
  return groups;
}

/**
 * @brief Lays out a day's timed events like Google Calendar: events starting together sit side by side,
 * and events starting later cascade on top with an indent so earlier titles stay visible.
 */
export function layoutTimedEvents(events: CalendarEvent[]): TimedEventLayout[] {
  const result: TimedEventLayout[] = [];
  for (const cluster of createTimedClusters(getTimedEvents(events))) {
    const groups = createStartGroups(cluster);
    const depths: number[] = [];
    for (const [groupIndex, group] of groups.entries()) {
      let depth = 0;
      for (let earlier = 0; earlier < groupIndex; earlier += 1) {
        const touches = groups[earlier].some((earlierEvent) =>
          group.some((event) => overlaps(earlierEvent, event))
        );
        if (touches) {
          depth = Math.max(depth, depths[earlier] + 1);
        }
      }
      depths.push(depth);

      const groupLeft = Math.min(
        depth * CASCADE_INDENT_PERCENT,
        MAX_CASCADE_INDENT_PERCENT
      );
      const memberWidth = (100 - groupLeft) / group.length;
      for (const [memberIndex, event] of group.entries()) {
        const startMinutes = Math.max(0, minutesSinceDayStart(event.start));
        const endMinutes = Math.max(
          startMinutes,
          Math.min((DAY_END - DAY_START) * 60, minutesSinceDayStart(event.end))
        );
        result.push({
          compact: endMinutes - startMinutes < COMPACT_MAX_MINUTES,
          durationHours: (endMinutes - startMinutes) / 60,
          event,
          leftPercent: groupLeft + memberIndex * memberWidth,
          startHours: startMinutes / 60,
          widthPercent: memberWidth,
          zIndex: 1 + depth * 2 + memberIndex,
        });
      }
    }
  }
  return result;
}
