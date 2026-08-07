import { isMultiDayEvent } from "./calendar-dates";
import type { CalendarEvent } from "./types";
export const DAY_START = 7;
export const DAY_END = 21;
export const HOUR_HEIGHT = 52;
export const WEEK_HEADER_HEIGHT = 72;
export interface TimedEventLayout {
  event: CalendarEvent;
  height: number;
  left: string;
  top: number;
  width: string;
}
export function getTimedEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events
    .filter((event) => !(event.allDay || isMultiDayEvent(event)))
    .sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() ||
        a.end.getTime() - b.end.getTime()
    );
}
export function createTimedClusters(
  events: CalendarEvent[]
): CalendarEvent[][] {
  const clusters: CalendarEvent[][] = [];
  for (const event of events) {
    const cluster = clusters.find((candidate) =>
      candidate.some((item) => item.start < event.end && item.end > event.start)
    );
    if (cluster) {
      cluster.push(event);
    } else {
      clusters.push([event]);
    }
  }
  return clusters;
}
export function createTimedColumns(
  cluster: CalendarEvent[]
): CalendarEvent[][] {
  const columns: CalendarEvent[][] = [];
  for (const event of cluster.sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  )) {
    const column = columns.find((candidate) => {
      const lastEvent = candidate.at(-1);
      return lastEvent ? lastEvent.end <= event.start : false;
    });
    if (column) {
      column.push(event);
    } else {
      columns.push([event]);
    }
  }
  return columns;
}
export function getTimedEventLayout(
  event: CalendarEvent,
  columnIndex: number,
  columns: CalendarEvent[][]
): TimedEventLayout {
  let rightmostColumn = columnIndex;
  for (let index = columnIndex + 1; index < columns.length; index += 1) {
    const hasOverlap = columns[index].some(
      (candidate) => candidate.start < event.end && candidate.end > event.start
    );
    if (hasOverlap) {
      break;
    }
    rightmostColumn = index;
  }
  const startMinutes =
    event.start.getHours() * 60 + event.start.getMinutes() - DAY_START * 60;
  const endMinutes =
    event.end.getHours() * 60 + event.end.getMinutes() - DAY_START * 60;
  const visibleStartMinutes = Math.max(0, startMinutes);
  const visibleEndMinutes = Math.max(visibleStartMinutes, endMinutes);
  const top = (visibleStartMinutes / 60) * HOUR_HEIGHT;
  const height = ((visibleEndMinutes - visibleStartMinutes) / 60) * HOUR_HEIGHT;
  const columnCount = rightmostColumn + 1;
  return {
    event,
    height,
    left: `${(columnIndex / columnCount) * 100}%`,
    top,
    width: `${((rightmostColumn - columnIndex + 1) / columnCount) * 100}%`,
  };
}
export function layoutTimedEvents(events: CalendarEvent[]): TimedEventLayout[] {
  const timed = getTimedEvents(events);
  const result: TimedEventLayout[] = [];
  for (const cluster of createTimedClusters(timed)) {
    const columns = createTimedColumns(cluster);
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      for (const event of columns[columnIndex]) {
        result.push(getTimedEventLayout(event, columnIndex, columns));
      }
    }
  }
  return result;
}
