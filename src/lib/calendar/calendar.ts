import type React from "react";

export const CATEGORIES = {
  assembly: { color: "#B79BFA", label: "Design" },
  electrical: { color: "#5FD0A0", label: "Electrical" },
  manufacturing: { color: "#F0A35A", label: "Manufacturing" },
  programming: { color: "#73B4FF", label: "Programming" },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;
export type ViewTransition = null | "from-left" | "from-right";

export const FILTER_CATEGORY_ORDER: CategoryKey[] = [
  "programming",
  "manufacturing",
  "electrical",
  "assembly",
];

export interface CalendarEvent {
  allDay: boolean;
  category?: CategoryKey;
  createdAt?: Date;
  end: Date;
  id: string;
  info?: string;
  location?: string;
  organizer?: string;
  snippet?: string;
  start: Date;
  subteams?: CategoryKey[];
  title: string;
}

export interface CalendarAnnouncement {
  date: Date;
  id: string;
  snippet: string;
  title: string;
}

export interface ConfirmationDialog {
  action: () => Promise<void>;
  confirmLabel: string;
  isDestructive?: boolean;
  message: string;
}

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
  if (durationDiff) {
    return durationDiff;
  }
  return String(a.title).localeCompare(String(b.title));
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
  if (h <= 0) {
    return `${m}m`;
  }
  return `${h}h ${m}m`;
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

export function esc(s: string | undefined): string {
  if (!s) {
    return "";
  }
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "'": "&#39;", '"': "&quot;", "&": "&amp;", "<": "&lt;", ">": "&gt;" })[
        c
      ] ?? c
  );
}

export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const value = String(hex).replace("#", "");
  if (value.length !== 6) {
    return hex;
  }
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function getEventColors(event: CalendarEvent): string[] {
  if (Array.isArray(event.subteams) && event.subteams.length) {
    const colors = event.subteams
      .map((key) => CATEGORIES[key as CategoryKey]?.color)
      .filter(Boolean) as string[];
    if (colors.length) {
      return colors;
    }
  }
  return [CATEGORIES[event.category as CategoryKey]?.color || "#999999"];
}

export function getEventBackground(colors: string[], alpha = 0.26): string {
  if (!colors.length) {
    return `rgba(153, 153, 153, ${alpha})`;
  }
  if (colors.length === 1) {
    return hexToRgba(colors[0], alpha);
  }
  const step = 100 / colors.length;
  return `linear-gradient(90deg, ${colors
    .map((color, index) => {
      const start = index * step;
      const end = (index + 1) * step;
      return `${hexToRgba(color, alpha)} ${start}% ${end}%`;
    })
    .join(", ")})`;
}

export function getEventBorderStyle(
  colors: string[],
  opts?: { borderAlpha?: number; glowAlpha?: number; glowSize?: number }
): React.CSSProperties {
  const { borderAlpha = 0.8, glowAlpha = 0.32, glowSize = 6 } = opts || {};
  const list = colors?.length ? colors : ["#999999"];

  if (list.length === 1) {
    const [primary] = list;
    const ring = hexToRgba(primary, borderAlpha);
    const glow = hexToRgba(primary, glowAlpha);
    return {
      background: ring,
      boxShadow: `0 0 ${glowSize}px ${glow}`,
    };
  }

  const n = list.length;
  const step = 100 / n;
  const ringStops = list
    .map(
      (color, i) =>
        `${hexToRgba(color, borderAlpha)} ${i * step}% ${(i + 1) * step}%`
    )
    .join(", ");
  const edgeGlowLeft = hexToRgba(list[0], glowAlpha * 0.7);
  const edgeGlowRight = hexToRgba(list[n - 1], glowAlpha * 0.7);
  return {
    background: `linear-gradient(90deg, ${ringStops})`,
    boxShadow: `-2px 0 ${glowSize}px ${edgeGlowLeft}, 2px 0 ${glowSize}px ${edgeGlowRight}`,
  };
}

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

export function fmtHourLabel(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  let hour12 = h % 12;
  if (hour12 === 0) {
    hour12 = 12;
  }
  return `${hour12} ${period}`;
}

export function eventSubteamKeys(event: CalendarEvent): CategoryKey[] {
  if (Array.isArray(event.subteams) && event.subteams.length) {
    return event.subteams;
  }
  if (event.category) {
    return [event.category];
  }
  return [];
}

export function isEventVisible(
  event: CalendarEvent,
  filter: Set<CategoryKey>
): boolean {
  const keys = eventSubteamKeys(event);
  if (!keys.length) {
    return true;
  }
  return keys.some((key) => filter.has(key));
}

export function normalizeSubteamName(name: string): CategoryKey | null {
  const lower = name.toLowerCase().trim();
  if (lower.includes("program")) {
    return "programming";
  }
  if (lower.includes("manufactur")) {
    return "manufacturing";
  }
  if (lower.includes("electrical") || lower.includes("electric")) {
    return "electrical";
  }
  if (lower.includes("design") || lower.includes("assembly")) {
    return "assembly";
  }
  return null;
}

export function positionPillIndicator(
  container: HTMLElement | null,
  indicator: HTMLElement | null
): void {
  if (!(container && indicator)) {
    return;
  }

  const activeButton = container.querySelector<HTMLElement>("button.active");
  if (!activeButton) {
    return;
  }

  const containerBox = container.getBoundingClientRect();
  const previousBox = indicator.getBoundingClientRect();
  const buttonBox = activeButton.getBoundingClientRect();
  const nextLeft = buttonBox.left - containerBox.left;
  const previousLeft = previousBox.left - containerBox.left;
  const hasPreviousIndicator = previousBox.width > 0;

  indicator.style.transform = `translateX(${nextLeft}px)`;
  indicator.style.width = `${buttonBox.width}px`;

  if (
    hasPreviousIndicator &&
    (Math.abs(previousLeft - nextLeft) > 0.5 ||
      Math.abs(previousBox.width - buttonBox.width) > 0.5)
  ) {
    indicator.animate(
      [
        {
          transform: `translateX(${previousLeft}px)`,
          width: `${previousBox.width}px`,
        },
        {
          transform: `translateX(${nextLeft}px)`,
          width: `${buttonBox.width}px`,
        },
      ],
      {
        duration: 220,
        easing: "cubic-bezier(.4,0,.2,1)",
        fill: "both",
      }
    );
  }
}
