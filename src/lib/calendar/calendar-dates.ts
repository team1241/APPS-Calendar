import type { CalendarEvent } from "./types";

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function atTime(date: Date, h: number, m = 0): Date {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export function stripTime(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
export function diffCalendarDays(a: Date, b: Date): number {
  return Math.round(
    (stripTime(b).getTime() - stripTime(a).getTime()) / 86_400_000
  );
}
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
export function eventStartDay(event: CalendarEvent): Date {
  return stripTime(event.start);
}
export function eventEndDay(event: CalendarEvent): Date {
  return stripTime(event.end);
}
export function isMultiDayEvent(event: CalendarEvent): boolean {
  return !!(event.start && event.end) && !sameDay(event.start, event.end);
}
export function isSingleDayEvent(event: CalendarEvent): boolean {
  return !!(event.start && event.end) && sameDay(event.start, event.end);
}

export function compareCalendarEvents(
  a: CalendarEvent,
  b: CalendarEvent
): number {
  const aMulti = isMultiDayEvent(a);
  const bMulti = isMultiDayEvent(b);
  if (aMulti !== bMulti) {
    return aMulti ? -1 : 1;
  }
  const startDiff = a.start.getTime() - b.start.getTime();
  if (startDiff) {
    return startDiff;
  }
  const durationDiff =
    b.end.getTime() - b.start.getTime() - (a.end.getTime() - a.start.getTime());
  return durationDiff || String(a.title).localeCompare(String(b.title));
}

export function eventCreationRank(
  event: CalendarEvent,
  allEvents: CalendarEvent[]
): number {
  const createdAt =
    event.createdAt instanceof Date
      ? event.createdAt.getTime()
      : Number(event.createdAt);
  if (Number.isFinite(createdAt)) {
    return createdAt;
  }
  const index = allEvents.indexOf(event);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

export interface MultiDaySegment {
  colEnd: number;
  colStart: number;
  event: CalendarEvent;
  isTrueEnd: boolean;
  isTrueStart: boolean;
  lane: number;
}
export interface MultiDayLayout {
  colLaneCount: number[];
  colOccupiedLanes: number[][];
  laneCount: number;
  segments: MultiDaySegment[];
}

export function buildMultiDaySegments(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
  allEvents: CalendarEvent[]
): MultiDayLayout {
  const maxCol = diffCalendarDays(rangeStart, rangeEnd);
  const overlapping = events
    .filter(
      (event) =>
        eventEndDay(event) >= rangeStart && eventStartDay(event) <= rangeEnd
    )
    .sort(
      (a, b) =>
        eventCreationRank(a, allEvents) - eventCreationRank(b, allEvents) ||
        compareCalendarEvents(a, b)
    );
  const laneIntervals: { colStart: number; colEnd: number }[][] = [];
  const segments = overlapping.map((event) => {
    const rawStart = diffCalendarDays(rangeStart, eventStartDay(event));
    const rawEnd = diffCalendarDays(rangeStart, eventEndDay(event));
    const colStart = clamp(rawStart, 0, maxCol);
    const colEnd = clamp(rawEnd, 0, maxCol);
    const isTrueStart = rawStart >= 0;
    const isTrueEnd = rawEnd <= maxCol;
    let lane = laneIntervals.findIndex((intervals) =>
      intervals.every(
        (interval) => interval.colEnd < colStart || interval.colStart > colEnd
      )
    );
    if (lane === -1) {
      lane = laneIntervals.length;
      laneIntervals.push([]);
    }
    laneIntervals[lane].push({ colEnd, colStart });
    return { colEnd, colStart, event, isTrueEnd, isTrueStart, lane };
  });
  const colLaneCount = new Array(maxCol + 1).fill(0);
  const colOccupiedLanes = Array.from(
    { length: maxCol + 1 },
    () => [] as number[]
  );
  for (const seg of segments) {
    for (let c = seg.colStart; c <= seg.colEnd; c += 1) {
      colLaneCount[c] = Math.max(colLaneCount[c], seg.lane + 1);
      colOccupiedLanes[c].push(seg.lane);
    }
  }
  return {
    colLaneCount,
    colOccupiedLanes,
    laneCount: laneIntervals.length,
    segments,
  };
}

export function formatEventTimeRange(event: CalendarEvent): string {
  if (!(event.start && event.end)) {
    return event.start.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      weekday: "long",
      year: "numeric",
    });
  }
  if (event.allDay) {
    if (isSingleDayEvent(event)) {
      return event.start.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
      });
    }
    return `${event.start.toLocaleDateString("en-US", { day: "numeric", month: "short" })} - ${event.end.toLocaleDateString("en-US", { day: "numeric", month: "short" })}`;
  }
  if (isMultiDayEvent(event)) {
    return `${event.start.toLocaleDateString("en-US", { day: "numeric", month: "short", weekday: "short" })} ${fmtTime(event.start)} - ${event.end.toLocaleDateString("en-US", { day: "numeric", month: "short", weekday: "short" })} ${fmtTime(event.end)}`;
  }
  return `${event.start.toLocaleDateString("en-US", { day: "numeric", month: "short", weekday: "short" })} - ${fmtTime(event.start)} - ${fmtTime(event.end)}`;
}
export function fmtTime(d: Date): string {
  return d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(" ", "");
}
export function fmtWeekday(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
}
export function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
export function formatCountdown(target: Date, now: Date): string {
  const totalMin = Math.max(
    0,
    Math.round((target.getTime() - now.getTime()) / 60_000)
  );
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h <= 0 ? `${m}m` : `${h}h ${m}m`;
}
export function getMonthMatrix(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const gridStart = addDays(first, -first.getDay());
  const weeks: Date[][] = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w += 1) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d += 1) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}
export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function fmtHourLabel(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  let hour12 = h % 12;
  if (hour12 === 0) {
    hour12 = 12;
  }
  return `${hour12} ${period}`;
}
