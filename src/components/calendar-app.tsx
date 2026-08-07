"use client";

import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useSignIn, useSignUp } from "@clerk/nextjs/legacy";
import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const CATEGORIES = {
  assembly: { color: "#B79BFA", label: "Design" },
  electrical: { color: "#5FD0A0", label: "Electrical" },
  manufacturing: { color: "#F0A35A", label: "Manufacturing" },
  programming: { color: "#73B4FF", label: "Programming" },
} as const;

type CategoryKey = keyof typeof CATEGORIES;
type ViewTransition = null | "from-left" | "from-right";

const FILTER_CATEGORY_ORDER: CategoryKey[] = [
  "programming",
  "manufacturing",
  "electrical",
  "assembly",
];

interface CalendarEvent {
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

interface CalendarAnnouncement {
  date: Date;
  id: string;
  snippet: string;
  title: string;
}

interface ConfirmationDialog {
  action: () => Promise<void>;
  confirmLabel: string;
  isDestructive?: boolean;
  message: string;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function atTime(date: Date, h: number, m = 0): Date {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

function stripTime(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function diffCalendarDays(a: Date, b: Date): number {
  return Math.round(
    (stripTime(b).getTime() - stripTime(a).getTime()) / 86_400_000
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function eventStartDay(event: CalendarEvent): Date {
  return stripTime(event.start);
}

function eventEndDay(event: CalendarEvent): Date {
  return stripTime(event.end);
}

function isMultiDayEvent(event: CalendarEvent): boolean {
  return !!(event.start && event.end) && !sameDay(event.start, event.end);
}

function isSingleDayEvent(event: CalendarEvent): boolean {
  return !!(event.start && event.end) && sameDay(event.start, event.end);
}

function compareCalendarEvents(a: CalendarEvent, b: CalendarEvent): number {
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

function eventCreationRank(
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

interface MultiDaySegment {
  colEnd: number;
  colStart: number;
  event: CalendarEvent;
  isTrueEnd: boolean;
  isTrueStart: boolean;
  lane: number;
}

interface MultiDayLayout {
  colLaneCount: number[];
  colOccupiedLanes: number[][];
  laneCount: number;
  segments: MultiDaySegment[];
}

function buildMultiDaySegments(
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

function formatEventTimeRange(event: CalendarEvent): string {
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

function fmtTime(d: Date): string {
  return d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(" ", "");
}

function fmtWeekday(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
}

function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatCountdown(target: Date, now: Date): string {
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

function getMonthMatrix(year: number, month: number): Date[][] {
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

function esc(s: string | undefined): string {
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

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const value = String(hex).replace("#", "");
  if (value.length !== 6) {
    return hex;
  }
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getEventColors(event: CalendarEvent): string[] {
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

function getEventBackground(colors: string[], alpha = 0.26): string {
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

function getEventBorderStyle(
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

function ColorSwatch({
  colors,
  size = 6,
}: {
  colors: string[];
  size?: number;
}) {
  if (colors.length <= 1) {
    return (
      <span
        className="cat-dot"
        style={{ background: colors[0], height: size, width: size }}
      />
    );
  }
  return (
    <span className="cat-dot subteam-dot" style={{ height: size, width: size }}>
      {colors.map((color, i) => (
        <span key={i} style={{ background: color }} />
      ))}
    </span>
  );
}

function SubteamTags({ event }: { event: CalendarEvent }) {
  if (!Array.isArray(event.subteams) || event.subteams.length === 0) {
    return null;
  }
  return (
    <div className="subteam-tags">
      {event.subteams.map((key) => {
        const team = CATEGORIES[key as CategoryKey];
        const color = team?.color || "#999999";
        const label = team?.label || key;
        return (
          <span
            className="subteam-tag"
            key={key}
            style={{
              background: hexToRgba(color, 0.18),
              border: `1px solid ${hexToRgba(color, 0.32)}`,
            }}
          >
            <span
              className="cat-dot"
              style={{ background: color, height: 6, width: 6 }}
            />
            {esc(label)}
          </span>
        );
      })}
    </div>
  );
}

function _IconCalendar({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <rect height="18" rx="2" width="18" x="3" y="4" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function IconChevronLeft({ size = 15 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconChevronRight({ size = 15 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <line x1="5" x2="19" y1="12" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function IconPlus({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <line x1="12" x2="12" y1="5" y2="19" />
      <line x1="5" x2="19" y1="12" y2="12" />
    </svg>
  );
}

function IconFilter({ size = 16 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <line x1="4" x2="20" y1="6" y2="6" />
      <circle cx="9" cy="6" fill="currentColor" r="2" stroke="none" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <circle cx="16" cy="12" fill="currentColor" r="2" stroke="none" />
      <line x1="4" x2="20" y1="18" y2="18" />
      <circle cx="11" cy="18" fill="currentColor" r="2" stroke="none" />
    </svg>
  );
}

function IconLogout({ size = 15 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

function IconX({ size = 17 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <line x1="18" x2="6" y1="6" y2="18" />
      <line x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
}

function IconTrash({ size = 16 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m19 6-1 14H6L5 6" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

function IconMapPin({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconUser({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconClock({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconMegaphone({ size = 20 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M3 11l18-5v12L3 13v-2z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}

const DAY_START = 7;
const DAY_END = 21;
const HOUR_HEIGHT = 52;
const WEEK_HEADER_HEIGHT = 72;

interface TimedEventLayout {
  event: CalendarEvent;
  height: number;
  left: string;
  top: number;
  width: string;
}

function getTimedEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events
    .filter((event) => !(event.allDay || isMultiDayEvent(event)))
    .sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() ||
        a.end.getTime() - b.end.getTime()
    );
}

function createTimedClusters(events: CalendarEvent[]): CalendarEvent[][] {
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

function createTimedColumns(cluster: CalendarEvent[]): CalendarEvent[][] {
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

function getTimedEventLayout(
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

function layoutTimedEvents(events: CalendarEvent[]): TimedEventLayout[] {
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

function fmtHourLabel(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  let hour12 = h % 12;
  if (hour12 === 0) {
    hour12 = 12;
  }
  return `${hour12} ${period}`;
}

function eventSubteamKeys(event: CalendarEvent): CategoryKey[] {
  if (Array.isArray(event.subteams) && event.subteams.length) {
    return event.subteams;
  }
  if (event.category) {
    return [event.category];
  }
  return [];
}

function isEventVisible(
  event: CalendarEvent,
  filter: Set<CategoryKey>
): boolean {
  const keys = eventSubteamKeys(event);
  if (!keys.length) {
    return true;
  }
  return keys.some((key) => filter.has(key));
}

function SignInScreen({
  authMode,
  onToggleMode,
}: {
  authMode: "signin" | "signup";
  onToggleMode: () => void;
}) {
  const {
    isLoaded: signInLoaded,
    signIn,
    setActive: setSignInActive,
  } = useSignIn();
  const {
    isLoaded: signUpLoaded,
    signUp,
    setActive: setSignUpActive,
  } = useSignUp();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationMode, setVerificationMode] = useState<
    "signin" | "signup" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getErrorMessage = (value: unknown): string => {
    if (value instanceof Error) {
      return value.message;
    }
    if (typeof value === "object" && value !== null && "errors" in value) {
      const { errors } = value as {
        errors?: Array<{ longMessage?: string; message?: string }>;
      };
      const firstError = errors?.[0];
      if (firstError) {
        return (
          firstError.longMessage ??
          firstError.message ??
          "Authentication failed."
        );
      }
    }
    return "Authentication failed. Please check your details and try again.";
  };

  const submitSignUpCode = async () => {
    if (!(signUpLoaded && signUp && setSignUpActive)) {
      throw new Error("Authentication is still loading.");
    }
    const result = await signUp.attemptEmailAddressVerification({
      code: verificationCode,
    });
    if (result.status !== "complete" || !result.createdSessionId) {
      throw new Error("The verification code was not accepted yet.");
    }
    await setSignUpActive({ session: result.createdSessionId });
  };

  const submitSignInCode = async () => {
    if (!(signInLoaded && signIn && setSignInActive)) {
      throw new Error("Authentication is still loading.");
    }
    const result = await signIn.attemptFirstFactor({
      code: verificationCode,
      strategy: "email_code",
    });
    if (result.status !== "complete" || !result.createdSessionId) {
      throw new Error("The verification code was not accepted yet.");
    }
    await setSignInActive({ session: result.createdSessionId });
  };

  const startSignIn = async () => {
    if (!(signInLoaded && signIn && setSignInActive)) {
      throw new Error("Authentication is still loading.");
    }
    const result = await signIn.create({
      identifier: email.trim(),
      strategy: "email_code",
    });
    if (result.status === "complete" && result.createdSessionId) {
      await setSignInActive({ session: result.createdSessionId });
    } else {
      setVerificationCode("");
      setVerificationMode("signin");
    }
  };

  const startSignUp = async () => {
    if (!(signUpLoaded && signUp && setSignUpActive)) {
      throw new Error("Authentication is still loading.");
    }
    const result = await signUp.create({
      emailAddress: email.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });
    if (result.status === "complete" && result.createdSessionId) {
      await setSignUpActive({ session: result.createdSessionId });
    } else {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerificationMode("signup");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (verificationMode === "signup") {
        await submitSignUpCode();
        return;
      }
      if (verificationMode === "signin") {
        await submitSignInCode();
        return;
      }
      if (!email.trim()) {
        throw new Error("Enter your email address to continue.");
      }
      if (authMode === "signin") {
        await startSignIn();
      } else {
        await startSignUp();
      }
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="signin-wrap">
      <div className="top-glow" style={{ height: 320 }} />
      <div className="signin-top">
        <div className="topbar-brand">
          <span className="team-logo">
            <Image
              alt="THEORY6 team logo"
              height={18}
              src="/Circle_Logo_Theory.svg"
              width={18}
            />
          </span>
          <span>FRC 1241</span>
        </div>
        <div className="micro-label">Preview</div>
      </div>
      <div className="signin-card-wrap">
        <div className="signin-card">
          <div className="glow" />
          <form onSubmit={handleSubmit} style={{ position: "relative" }}>
            {error && (
              <p className="signin-error" role="alert">
                {error}
              </p>
            )}
            {verificationMode ? (
              <>
                <div className="micro-label">Check your email</div>
                <h1>
                  Enter your
                  <br />
                  verification code.
                </h1>
                <p className="sub">We sent a verification code to {email}.</p>
                <div className="micro-label" style={{ marginBottom: 8 }}>
                  Verification code
                </div>
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="Enter your code"
                  style={{ marginBottom: 26 }}
                  value={verificationCode}
                />
                <button
                  className="primary-btn"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Verifying..." : "Verify"} <IconArrowRight />
                </button>
              </>
            ) : null}
            {!verificationMode && authMode === "signup" ? (
              <>
                <div className="micro-label">Get started</div>
                <h1>
                  Create your
                  <br />
                  team calendar account.
                </h1>
                <p className="sub">
                  Every meeting, deadline, and build session — in one place,
                  always up to date.
                </p>
                <div className="signin-name-row" style={{ marginBottom: 18 }}>
                  <div className="signin-field">
                    <div className="micro-label" style={{ marginBottom: 8 }}>
                      First name
                    </div>
                    <input
                      autoComplete="given-name"
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="First name"
                      value={firstName}
                    />
                  </div>
                  <div className="signin-field">
                    <div className="micro-label" style={{ marginBottom: 8 }}>
                      Last name
                    </div>
                    <input
                      autoComplete="family-name"
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder="Last name"
                      value={lastName}
                    />
                  </div>
                </div>
                <div className="micro-label" style={{ marginBottom: 8 }}>
                  Email address
                </div>
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email address"
                  style={{ marginBottom: 26 }}
                  type="email"
                  value={email}
                />
                <button
                  className="primary-btn"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Creating..." : "Continue"} <IconArrowRight />
                </button>
                <div className="signin-alt-row">
                  Already have an account?{" "}
                  <button
                    onClick={onToggleMode}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onToggleMode();
                      }
                    }}
                    type="button"
                  >
                    Sign in
                  </button>
                </div>
              </>
            ) : null}
            {!verificationMode && authMode !== "signup" ? (
              <>
                <div className="micro-label">Welcome back</div>
                <h1>
                  Sign in to your
                  <br />
                  team calendar.
                </h1>
                <p className="sub">
                  Every meeting, deadline, and build session — in one place,
                  always up to date.
                </p>
                <div className="micro-label" style={{ marginBottom: 8 }}>
                  Email address
                </div>
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email address"
                  style={{ marginBottom: 26 }}
                  type="email"
                  value={email}
                />
                <button
                  className="primary-btn"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Signing in..." : "Continue"}{" "}
                  <IconArrowRight />
                </button>
                <div className="signin-alt-row">
                  Don&apos;t have an account?{" "}
                  <button
                    onClick={onToggleMode}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onToggleMode();
                      }
                    }}
                    type="button"
                  >
                    Sign up
                  </button>
                </div>
              </>
            ) : null}
          </form>
        </div>
      </div>
      <p className="signin-footer">Powered by Clerk authentication.</p>
    </div>
  );
}

function TopBar({
  events,
  subteamFilter,
  filtersOpen,
  filtersJustOpened,
  isAdmin,
  onToggleFilters,
  onToggleSubteam,
  onOpenComposer,
  onSignOut,
  onOpenEvent,
  userName,
}: {
  events: CalendarEvent[];
  subteamFilter: Set<CategoryKey>;
  filtersOpen: boolean;
  filtersJustOpened: boolean;
  isAdmin: boolean;
  onToggleFilters: () => void;
  onToggleSubteam: (key: CategoryKey) => void;
  onOpenComposer: () => void;
  onSignOut: () => void;
  onOpenEvent: (id: string) => void;
  userName: string;
}) {
  const now = new Date();
  const visibleEventsList = events.filter((e) =>
    isEventVisible(e, subteamFilter)
  );
  const [nextEvent] = visibleEventsList
    .filter((e) => !e.allDay && e.start > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const isFilterActive = subteamFilter.size < Object.keys(CATEGORIES).length;

  return (
    <div className="topbar">
      <div className="topbar-brand">
        <span className="team-logo">
          <Image
            alt="THEORY6 team logo"
            height={18}
            src="/Circle_Logo_Theory.svg"
            width={18}
          />
        </span>
        <span>FRC 1241</span>
      </div>
      {nextEvent ? (
        <button
          className="next-event-pill"
          onClick={() => onOpenEvent(nextEvent.id)}
          type="button"
        >
          <ColorSwatch colors={getEventColors(nextEvent)} size={6} />
          <span className="countdown">
            in {formatCountdown(nextEvent.start, now)}
          </span>
          <span className="title">&middot; {nextEvent.title}</span>
        </button>
      ) : (
        <div />
      )}
      <div className="topbar-actions">
        <div className="filter-menu">
          <button
            className={`icon-btn filter-btn${filtersOpen ? " active" : ""}`}
            onClick={onToggleFilters}
            title="Filter by subteam"
            type="button"
          >
            <IconFilter />
            {isFilterActive && <span className="filter-dot" />}
          </button>
          {filtersOpen && (
            <FilterPopover
              filtersJustOpened={filtersJustOpened}
              onToggleSubteam={onToggleSubteam}
              subteamFilter={subteamFilter}
            />
          )}
        </div>
        {isAdmin ? (
          <button
            className="icon-btn"
            onClick={onOpenComposer}
            title="Create event or announcement"
            type="button"
          >
            <IconPlus />
          </button>
        ) : null}
        <button className="signout-btn" onClick={onSignOut} type="button">
          <IconLogout /> Sign out
        </button>
        <div className="avatar">{userName.charAt(0).toUpperCase()}</div>
      </div>
    </div>
  );
}

function FilterPopover({
  subteamFilter,
  filtersJustOpened,
  onToggleSubteam,
}: {
  subteamFilter: Set<CategoryKey>;
  filtersJustOpened: boolean;
  onToggleSubteam: (key: CategoryKey) => void;
}) {
  return (
    <fieldset
      aria-label="Subteam filters"
      className={`filter-popover${filtersJustOpened ? " just-opened" : ""}`}
      id="subteam-filter-popover"
    >
      <span className="filter-popover-label">Filter by subteam</span>
      <div className="subteam-pill-row">
        {FILTER_CATEGORY_ORDER.map((key) => {
          const c = CATEGORIES[key];
          return (
            <button
              aria-pressed={subteamFilter.has(key)}
              className={`subteam-pill${subteamFilter.has(key) ? " selected" : ""}`}
              key={key}
              onClick={() => onToggleSubteam(key)}
              style={
                {
                  "--pill-bg": hexToRgba(c.color, 0.16),
                  "--pill-border": hexToRgba(c.color, 0.55),
                  "--pill-glow": hexToRgba(c.color, 0.4),
                } as React.CSSProperties
              }
              type="button"
            >
              <span
                className="cat-dot"
                style={{ background: c.color, height: 7, width: 7 }}
              />
              {esc(c.label)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function positionPillIndicator(
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
  const buttonBox = activeButton.getBoundingClientRect();
  indicator.style.transform = `translateX(${buttonBox.left - containerBox.left}px)`;
  indicator.style.width = `${buttonBox.width}px`;
}

function BottomNav({
  view,
  onSetView,
}: {
  view: "month" | "week" | "announcements";
  onSetView: (v: "month" | "week" | "announcements") => void;
}) {
  const navRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!(nav && indicator)) {
      return;
    }

    const updateIndicator = () => {
      positionPillIndicator(nav, indicator);
    };

    updateIndicator();
    const frame = requestAnimationFrame(updateIndicator);
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(nav);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [view]);

  const items: ["month" | "week" | "announcements", string][] = [
    ["month", "Month"],
    ["week", "Week"],
    ["announcements", "Announcements"],
  ];

  return (
    <div className="bottom-nav" ref={navRef}>
      <div className="nav-indicator" ref={indicatorRef} />
      {items.map(([key, label]) => (
        <button
          className={view === key ? "active" : ""}
          key={key}
          onClick={() => onSetView(key)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MonthView({
  cursor,
  events,
  today,
  swipeEnter,
  onOpenEvent,
  onOpenDayList,
  onPrevMonth,
  onNextMonth,
  onToday,
  viewTransition,
}: {
  cursor: Date;
  events: CalendarEvent[];
  today: Date;
  swipeEnter: string | null;
  onOpenEvent: (id: string) => void;
  onOpenDayList: (dateKey: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  viewTransition: ViewTransition;
}) {
  const weeks = useMemo(
    () => getMonthMatrix(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );
  const isCompactMonth =
    typeof window !== "undefined" && window.innerWidth <= 600;
  const isTabletMonth =
    typeof window !== "undefined" && window.innerWidth <= 960;
  const isViewingCurrentMonth =
    cursor.getFullYear() === today.getFullYear() &&
    cursor.getMonth() === today.getMonth();
  const MAX_VISIBLE = isCompactMonth ? 2 : 3;
  const BANNER_TOP = isCompactMonth ? 27 : 36;
  let BANNER_LANE_H = 23;
  if (isCompactMonth) {
    BANNER_LANE_H = 7;
  } else if (isTabletMonth) {
    BANNER_LANE_H = 20;
  }
  const weekdayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const { map, multiDayEvents } = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of events) {
      if (event.allDay || isMultiDayEvent(event)) {
        let day = eventStartDay(event);
        const end = eventEndDay(event);
        while (day <= end) {
          const key = dateKey(day);
          if (!map[key]) {
            map[key] = [];
          }
          map[key].push(event);
          day = addDays(day, 1);
        }
      } else {
        const key = dateKey(event.start);
        if (!map[key]) {
          map[key] = [];
        }
        map[key].push(event);
      }
    }
    for (const list of Object.values(map)) {
      list.sort(compareCalendarEvents);
    }
    return { map, multiDayEvents: events.filter(isMultiDayEvent) };
  }, [events]);

  const rowBanners = useMemo(
    () =>
      weeks.map((rowDates) => {
        const [rowStart, , , , , , rowEnd] = rowDates;
        return buildMultiDaySegments(multiDayEvents, rowStart, rowEnd, events);
      }),
    [weeks, multiDayEvents, events]
  );

  return (
    <div
      className={`month-wrap view-slide${viewTransition ? ` view-transition-${viewTransition}` : ""}`}
    >
      <div className="month-header">
        <h1>{fmtMonthYear(cursor)}</h1>
        <div className="month-nav">
          <button
            aria-label="Previous month"
            className="nav-arrow"
            onClick={onPrevMonth}
            type="button"
          >
            <IconChevronLeft />
          </button>
          <button className="today-btn" onClick={onToday} type="button">
            Today
          </button>
          <button
            aria-label="Next month"
            className="nav-arrow"
            onClick={onNextMonth}
            type="button"
          >
            <IconChevronRight />
          </button>
        </div>
      </div>
      <div
        aria-label="Month calendar. Swipe left or right to change month."
        className={`month-grid${swipeEnter ? ` swipe-enter-${swipeEnter}` : ""}`}
        data-swipe-surface="month"
      >
        <div className="month-grid-header">
          {weekdayLabels.map((w) => (
            <div className="weekday-cell" key={w}>
              <div className="micro-label">{w}</div>
            </div>
          ))}
        </div>
        {weeks.map((rowDates, r) => {
          const laneCount = rowBanners[r].laneCount;
          const colOccupiedLanes = rowBanners[r].colOccupiedLanes;
          const isLastRow = r === weeks.length - 1;
          return (
            <div className="month-row" key={r}>
              <div className="month-row-grid">
                {rowDates.map((date, col) => {
                  const k = dateKey(date);
                  const isCurrentMonth = date.getMonth() === cursor.getMonth();
                  const isToday = sameDay(date, today);
                  const dayEvents = (map[k] || []).filter(
                    (e) => !isMultiDayEvent(e)
                  );
                  const occupiedLanes = new Set(colOccupiedLanes[col]);
                  const availableLanes = Array.from(
                    { length: MAX_VISIBLE },
                    (_, lane) => lane
                  ).filter((lane) => !occupiedLanes.has(lane));
                  const visible = dayEvents
                    .slice(0, availableLanes.length)
                    .map((event, index) => ({
                      event,
                      lane: availableLanes[index],
                    }));
                  const hiddenMultiDayCount = colOccupiedLanes[col].filter(
                    (lane) => lane >= MAX_VISIBLE
                  ).length;
                  const overflow =
                    hiddenMultiDayCount + dayEvents.length - visible.length;
                  const classes = ["day-cell"];
                  if (!isCurrentMonth) {
                    classes.push("other-month");
                  }
                  if (col === 6) {
                    classes.push("col-last");
                  }
                  if (isLastRow) {
                    classes.push("row-last");
                  }
                  if (isToday) {
                    classes.push("today-cell");
                  }
                  return (
                    <div className={classes.join(" ")} key={col}>
                      <div className="day-num-row">
                        <button
                          className={`day-num day-num-btn${isToday ? " today" : ""}`}
                          onClick={() => onOpenDayList(k)}
                          type="button"
                        >
                          {date.getDate()}
                        </button>
                        {date.getDate() === 1 && (
                          <span className="month-label">
                            {date.toLocaleDateString("en-US", {
                              month: "short",
                            })}
                          </span>
                        )}
                      </div>
                      <div className="day-events">
                        {visible.map(({ event: e, lane }) => {
                          const colors = getEventColors(e);
                          const isPastDay = date < today;
                          const showStripe = isViewingCurrentMonth && isPastDay;
                          const isMuted = !isViewingCurrentMonth;
                          const borderStyle = getEventBorderStyle(
                            colors,
                            showStripe || isMuted
                              ? { glowAlpha: 0, glowSize: 0 }
                              : undefined
                          );
                          return (
                            <button
                              className={`event-pill pill-glow${showStripe ? " is-past-event" : ""}`}
                              key={e.id}
                              onClick={() => onOpenEvent(e.id)}
                              style={{
                                gridRow: lane + 1,
                                opacity: isMuted ? 0.45 : undefined,
                                ...borderStyle,
                              }}
                              type="button"
                            >
                              <div className="pill-inner">
                                <ColorSwatch colors={colors} size={6} />
                                <span>{e.title}</span>
                              </div>
                            </button>
                          );
                        })}
                        {overflow > 0 && (
                          <button
                            className="more-btn"
                            onClick={() => onOpenDayList(k)}
                            style={{ gridRow: MAX_VISIBLE + 1 }}
                            type="button"
                          >
                            +{overflow} more{isCompactMonth ? "" : " events"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {laneCount > 0 && (
                <div className="banner-layer">
                  {rowBanners[r].segments
                    .filter((seg) => seg.lane < MAX_VISIBLE)
                    .map((seg) => {
                      const colors = getEventColors(seg.event);
                      const isPastBanner = eventEndDay(seg.event) < today;
                      const showStripe = isViewingCurrentMonth && isPastBanner;
                      const isMuted = !isViewingCurrentMonth;
                      const borderStyle = getEventBorderStyle(
                        colors,
                        showStripe || isMuted
                          ? { glowAlpha: 0, glowSize: 0 }
                          : undefined
                      );
                      return (
                        <button
                          className={`event-pill month-banner pill-glow${showStripe ? " is-past-event" : ""}${seg.isTrueStart ? "" : " join-left"}${seg.isTrueEnd ? "" : " join-right"}`}
                          key={seg.event.id}
                          onClick={() => onOpenEvent(seg.event.id)}
                          style={{
                            gridColumn: `${seg.colStart + 1} / ${seg.colEnd + 2}`,
                            marginTop: BANNER_TOP + seg.lane * BANNER_LANE_H,
                            opacity: isMuted ? 0.45 : undefined,
                            ...borderStyle,
                          }}
                          type="button"
                        >
                          <div
                            className={`pill-inner${seg.isTrueStart ? "" : " join-left"}${seg.isTrueEnd ? "" : " join-right"}`}
                          >
                            {seg.isTrueStart && (
                              <>
                                <ColorSwatch colors={colors} size={6} />
                                <span>{seg.event.title}</span>
                              </>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  events,
  today,
  mobileWeekOffset,
  swipeEnter,
  onOpenEvent,
  onWeekPrev,
  onWeekNext,
  viewTransition,
}: {
  events: CalendarEvent[];
  today: Date;
  mobileWeekOffset: number;
  swipeEnter: string | null;
  onOpenEvent: (id: string) => void;
  onWeekPrev: () => void;
  onWeekNext: () => void;
  viewTransition: ViewTransition;
}) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 760;
  const EVENT_LANE_H = 23;
  const _MOBILE_GUTTER_WIDTH = 38;
  const _MOBILE_COLUMN_GAP = 0;

  const timedEventsFor = useCallback(
    (date: Date) =>
      events
        .filter(
          (e) => !(e.allDay || isMultiDayEvent(e)) && sameDay(e.start, date)
        )
        .sort(compareCalendarEvents),
    [events]
  );

  const multiDayEvents = useMemo(
    () => events.filter(isMultiDayEvent),
    [events]
  );

  const renderBannerHtml = useCallback(
    (segments: MultiDaySegment[], colOffset: number) =>
      segments.map((seg) => {
        const colors = getEventColors(seg.event);
        const isPastBanner = eventEndDay(seg.event) < today;
        const borderStyle = getEventBorderStyle(
          colors,
          isPastBanner ? { glowAlpha: 0, glowSize: 0 } : undefined
        );
        return (
          <button
            className={`event-pill week-multi-banner pill-glow${isPastBanner ? " is-past-event" : ""}${seg.isTrueStart ? "" : " join-left"}${seg.isTrueEnd ? "" : " join-right"}`}
            key={seg.event.id}
            onClick={() => onOpenEvent(seg.event.id)}
            style={{
              gridColumn: `${seg.colStart + colOffset} / ${seg.colEnd + colOffset + 1}`,
              marginTop: seg.lane * EVENT_LANE_H,
              ...borderStyle,
            }}
            type="button"
          >
            <div
              className={`pill-inner${seg.isTrueStart ? "" : " join-left"}${seg.isTrueEnd ? "" : " join-right"}`}
            >
              {seg.isTrueStart && (
                <>
                  <ColorSwatch colors={colors} size={6} />
                  <span>{seg.event.title}</span>
                </>
              )}
            </div>
          </button>
        );
      }),
    [today, onOpenEvent]
  );

  const renderTimeGutter = useCallback(() => {
    const labels: React.ReactNode[] = [];
    for (let h = DAY_START; h <= DAY_END; h++) {
      const top = (h - DAY_START) * HOUR_HEIGHT;
      labels.push(
        <span className="hour-label" key={h} style={{ top }}>
          {fmtHourLabel(h)}
        </span>
      );
    }
    return (
      <div className="time-gutter">
        <div className="day-col-head">
          <div className="micro-label">&nbsp;</div>
          <div className="num">&nbsp;</div>
        </div>
        <div
          style={{
            height: (DAY_END - DAY_START) * HOUR_HEIGHT,
            position: "relative",
          }}
        >
          {labels}
        </div>
      </div>
    );
  }, []);

  const renderDayColumn = useCallback(
    (
      date: Date,
      dayEvents: CalendarEvent[],
      opts: { isPrev: boolean; isToday: boolean; big: boolean }
    ) => {
      const layouts = layoutTimedEvents(dayEvents);
      const classes = ["day-col"];
      if (opts.isToday) {
        classes.push("today-col");
      }
      if (opts.big) {
        classes.push("big");
      }
      return (
        <div className={classes.join(" ")} key={dateKey(date)}>
          <div className="day-col-head">
            <div className="micro-label">{fmtWeekday(date)}</div>
            <div className={`num${opts.isToday ? " today" : ""}`}>
              {date.getDate()}
            </div>
          </div>
          <div
            className="day-col-body"
            style={{
              height: (DAY_END - DAY_START) * HOUR_HEIGHT,
              position: "relative",
            }}
          >
            {Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => (
              <div className="hour-row" key={i} />
            ))}
            {layouts.map((layout) => {
              const colors = getEventColors(layout.event);
              const isPast =
                opts.isPrev || (opts.isToday && layout.event.end < new Date());
              const borderStyle = getEventBorderStyle(
                colors,
                isPast ? { glowAlpha: 0, glowSize: 0 } : undefined
              );
              return (
                <button
                  className={`week-event${isPast ? " is-past-event" : ""}`}
                  key={layout.event.id}
                  onClick={() => onOpenEvent(layout.event.id)}
                  style={{
                    height: layout.height,
                    left: layout.left,
                    opacity: isPast ? 0.55 : 1,
                    right: "auto",
                    top: layout.top,
                    width: layout.width,
                    zIndex:
                      1 +
                      Math.min(
                        3,
                        Math.round((Number.parseFloat(layout.left) / 100) * 3)
                      ),
                    ...borderStyle,
                  }}
                  type="button"
                >
                  <div className="week-event-inner">
                    <div className="t">{layout.event.title}</div>
                    <div className="tm">
                      {fmtTime(layout.event.start)} -{" "}
                      {fmtTime(layout.event.end)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    },
    [onOpenEvent]
  );

  if (isMobile) {
    const date = addDays(today, mobileWeekOffset);
    const _segments = buildMultiDaySegments(multiDayEvents, date, date, events);
    return (
      <div
        className={`view-slide${viewTransition ? ` view-transition-${viewTransition}` : ""}`}
        style={{ padding: "8px 16px 130px" }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <button
            aria-label="Previous day"
            className="nav-arrow"
            onClick={onWeekPrev}
            type="button"
          >
            <IconChevronLeft />
          </button>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {date.toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              weekday: "long",
            })}
          </div>
          <button
            aria-label="Next day"
            className="nav-arrow"
            onClick={onWeekNext}
            type="button"
          >
            <IconChevronRight />
          </button>
        </div>
        <div
          style={{ display: "flex", gap: 6, margin: "0 auto", maxWidth: 420 }}
        >
          {renderTimeGutter()}
          {renderDayColumn(date, timedEventsFor(date), {
            big: false,
            isPrev: mobileWeekOffset < 0,
            isToday: mobileWeekOffset === 0,
          })}
        </div>
      </div>
    );
  }

  const firstWindowDay = addDays(today, mobileWeekOffset - 1);
  const windowDays = Array.from({ length: 5 }, (_, index) =>
    addDays(firstWindowDay, index)
  );
  const lastWindowDay = addDays(firstWindowDay, 4);
  const segments = buildMultiDaySegments(
    multiDayEvents,
    firstWindowDay,
    lastWindowDay,
    events
  );
  const rangeLabel = `${firstWindowDay.toLocaleDateString("en-US", { day: "numeric", month: "short" })} - ${lastWindowDay.toLocaleDateString("en-US", { day: "numeric", month: "short" })}`;
  let weekClassName = "week-wrap view-slide";
  if (swipeEnter) {
    weekClassName += ` swipe-enter-${swipeEnter}`;
  } else if (viewTransition) {
    weekClassName += ` view-transition-${viewTransition}`;
  }

  return (
    <div
      aria-label="Week calendar. Swipe left or right to change week."
      className={weekClassName}
      data-swipe-surface="week"
    >
      <div className="week-header">
        <h1>{mobileWeekOffset === 0 ? "This week" : rangeLabel}</h1>
        <p>
          {mobileWeekOffset === 0
            ? "Yesterday, then today and the three days ahead."
            : "Swipe horizontally to move through weeks."}
        </p>
      </div>
      {segments.laneCount > 0 && (
        <div
          className="week-multi-row"
          style={{ height: segments.laneCount * EVENT_LANE_H }}
        >
          <span className="week-multi-label">ALL-DAY</span>
          {renderBannerHtml(segments.segments, 2)}
        </div>
      )}
      <div
        className="week-row"
        style={
          {
            "--week-header-height": `${WEEK_HEADER_HEIGHT}px`,
            "--week-hour-height": `${HOUR_HEIGHT}px`,
          } as React.CSSProperties
        }
      >
        {renderTimeGutter()}
        {windowDays.map((date) =>
          renderDayColumn(date, timedEventsFor(date), {
            big: sameDay(date, today),
            isPrev: stripTime(date) < today,
            isToday: sameDay(date, today),
          })
        )}
      </div>
    </div>
  );
}

function AnnouncementsView({
  announcements,
  onOpenAnnouncement,
  viewTransition,
}: {
  announcements: CalendarAnnouncement[];
  onOpenAnnouncement: (id: string) => void;
  viewTransition: ViewTransition;
}) {
  const sorted = useMemo(
    () =>
      [...announcements].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [announcements]
  );
  return (
    <div
      className={`ann-wrap view-slide${viewTransition ? ` view-transition-${viewTransition}` : ""}`}
    >
      <div className="ann-header">
        <IconMegaphone />
        <h1>Announcements</h1>
      </div>
      <div className="ann-list">
        {sorted.map((a, i) => (
          <button
            className={`ann-card${i === 0 ? " latest" : ""}`}
            key={a.id}
            onClick={() => onOpenAnnouncement(a.id)}
            type="button"
          >
            <span className="time">{fmtTime(a.date)}</span>
            <div className="main">
              <span className="title">{a.title}</span>
              <span className="date">
                {a.date.toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            <span className="chevron">
              <IconChevronRight />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EventModal({
  event,
  cameFromDayList,
  isAdmin,
  onRequestDelete,
  onClose,
  onBackToDayList,
}: {
  event: CalendarEvent | CalendarAnnouncement | null;
  cameFromDayList: boolean;
  isAdmin: boolean;
  onRequestDelete: (event: CalendarEvent | CalendarAnnouncement) => void;
  onClose: () => void;
  onBackToDayList: () => void;
}) {
  if (!event) {
    return null;
  }
  const isAnnouncement = "snippet" in event;
  const calEvent = event as CalendarEvent;
  const colors = isAnnouncement ? ["#999999"] : getEventColors(calEvent);
  const primaryColor = colors[0];

  let chip: React.ReactNode = null;
  if (
    !isAnnouncement &&
    Array.isArray(calEvent.subteams) &&
    calEvent.subteams.length
  ) {
    chip = <SubteamTags event={calEvent} />;
  } else if (!isAnnouncement && calEvent.category) {
    chip = (
      <div
        className="cat-chip"
        style={{ background: `${CATEGORIES[calEvent.category]?.color}22` }}
      >
        <span
          className="cat-dot"
          style={{
            background: CATEGORIES[calEvent.category]?.color,
            height: 7,
            width: 7,
          }}
        />
        <span className="lbl">{CATEGORIES[calEvent.category]?.label}</span>
      </div>
    );
  }

  let timeStr = "";
  if (isAnnouncement) {
    timeStr = (event as CalendarAnnouncement).date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      weekday: "long",
      year: "numeric",
    });
  } else if (calEvent.allDay) {
    timeStr = `${calEvent.start.toLocaleDateString("en-US", { day: "numeric", month: "short" })} - ${calEvent.end.toLocaleDateString("en-US", { day: "numeric", month: "short" })}`;
  } else {
    timeStr = `${calEvent.start.toLocaleDateString("en-US", { day: "numeric", month: "short", weekday: "short" })} · ${fmtTime(calEvent.start)} - ${fmtTime(calEvent.end)}`;
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="event-modal">
        <div
          className="glow"
          style={{
            background: `radial-gradient(ellipse, ${primaryColor}33 0%, transparent 70%)`,
          }}
        />
        <div style={{ position: "relative" }}>
          <div className="head">
            <div className="head-left">
              {cameFromDayList && (
                <button
                  aria-label="Back"
                  className="back-btn"
                  onClick={onBackToDayList}
                  title="Back to day events"
                  type="button"
                >
                  <IconChevronLeft />
                </button>
              )}
              {chip}
            </div>
            <button
              aria-label="Close event details"
              className="close-btn"
              onClick={onClose}
              title="Close"
              type="button"
            >
              <IconX />
            </button>
          </div>
          <h2>{event.title}</h2>
          <div className="info-rows">
            <div className="info-row">
              <IconClock />
              <span>{timeStr}</span>
            </div>
            {!isAnnouncement && calEvent.location && (
              <div className="info-row">
                <IconMapPin />
                <span>{calEvent.location}</span>
              </div>
            )}
            {!isAnnouncement && calEvent.organizer && (
              <div className="info-row">
                <IconUser />
                <span>{calEvent.organizer}</span>
              </div>
            )}
          </div>
          <p className="desc">
            {isAnnouncement
              ? (event as CalendarAnnouncement).snippet
              : calEvent.info || ""}
          </p>
          {isAdmin && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                aria-label="Delete event"
                className="close-btn"
                onClick={() => onRequestDelete(event)}
                title="Delete"
                type="button"
              >
                <IconTrash />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmationModal({
  confirmation,
  onClose,
}: {
  confirmation: ConfirmationDialog;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setError(null);
    setIsConfirming(true);
    try {
      await confirmation.action();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Action failed. Please try again."
      );
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div
      className="modal-overlay confirmation-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConfirming) {
          onClose();
        }
      }}
    >
      <div className="event-modal confirmation-modal">
        <div
          className="glow"
          style={{
            background: confirmation.isDestructive
              ? "radial-gradient(ellipse, rgba(224, 90, 90, 0.16) 0%, transparent 70%)"
              : "radial-gradient(ellipse, rgba(250,250,248,0.10) 0%, transparent 70%)",
          }}
        />
        <div style={{ position: "relative" }}>
          <h2>{confirmation.message}</h2>
          {error && <div className="composer-error">{error}</div>}
          <div className="form-actions confirmation-actions">
            <button
              className="secondary-btn"
              disabled={isConfirming}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className={`primary-btn${confirmation.isDestructive ? " destructive-btn" : ""}`}
              disabled={isConfirming}
              onClick={handleConfirm}
              type="button"
            >
              {isConfirming ? "Please wait..." : confirmation.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DayListModal({
  dateKeyStr,
  events,
  scrollTop,
  animate,
  onClose,
  onOpenEvent,
}: {
  dateKeyStr: string;
  events: CalendarEvent[];
  scrollTop: number;
  animate: boolean;
  onClose: () => void;
  onOpenEvent: (id: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [y, m, d] = dateKeyStr.split("-").map(Number);
  const date = new Date(y, m, d);
  const dayEvents = events.filter((e) => {
    if (e.allDay || isMultiDayEvent(e)) {
      return eventStartDay(e) <= date && eventEndDay(e) >= date;
    }
    return sameDay(e.start, date);
  });

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop]);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="day-list-modal"
        style={animate ? undefined : { animation: "none" }}
      >
        <div
          className="glow"
          style={{
            background:
              "radial-gradient(ellipse, rgba(255,255,255,0.08) 0%, transparent 70%)",
          }}
        />
        <div className="head">
          <div>
            <span className="t">
              {date.toLocaleDateString("en-US", {
                day: "numeric",
                month: "short",
                weekday: "long",
              })}
            </span>
            <span className="sub">
              {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
            </span>
          </div>
          <button
            aria-label="Close day events"
            className="close-btn"
            onClick={onClose}
            title="Close"
            type="button"
          >
            <IconX />
          </button>
        </div>
        <div className="list" ref={listRef}>
          {dayEvents.length ? (
            dayEvents.map((e) => {
              const colors = getEventColors(e);
              const glow = `linear-gradient(to right, ${hexToRgba(colors[0], 0.35)} 0%, ${hexToRgba(colors[0], 0)} 12.5%), ${getEventBackground(colors, 0.03)}`;
              return (
                <button
                  className="day-list-item"
                  key={e.id}
                  onClick={() => onOpenEvent(e.id)}
                  style={{ background: glow }}
                  type="button"
                >
                  <ColorSwatch colors={colors} size={8} />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      minWidth: 0,
                    }}
                  >
                    <span className="t">{e.title}</span>
                    <span className="tm">{formatEventTimeRange(e)}</span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="micro-label" style={{ padding: "14px 6px 8px" }}>
              No events on this day
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComposerModal({
  mode,
  error,
  onClose,
  onSwitchMode,
  onSubmit,
}: {
  mode: "event" | "announcement";
  error: string | null;
  onClose: () => void;
  onSwitchMode: (m: "event" | "announcement") => void;
  onSubmit: () => void;
}) {
  const todayStr = toDateInputValue(new Date());
  const tabsRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const tabs = tabsRef.current;
    const indicator = indicatorRef.current;
    if (!(tabs && indicator)) {
      return;
    }

    const updateIndicator = () => {
      positionPillIndicator(tabs, indicator);
    };

    updateIndicator();
    const frame = requestAnimationFrame(updateIndicator);
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(tabs);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [mode]);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="event-modal composer-modal">
        <div
          className="glow"
          style={{
            background:
              "radial-gradient(ellipse, rgba(250,250,248,0.10) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            position: "relative",
          }}
        >
          <div className="head">
            <div className="head-left">
              <div className="composer-tabs" ref={tabsRef}>
                <div className="tab-indicator" ref={indicatorRef} />
                <button
                  className={`composer-tab${mode === "event" ? " active" : ""}`}
                  onClick={() => onSwitchMode("event")}
                  type="button"
                >
                  Event
                </button>
                <button
                  className={`composer-tab${mode === "announcement" ? " active" : ""}`}
                  onClick={() => onSwitchMode("announcement")}
                  type="button"
                >
                  Announcement
                </button>
              </div>
            </div>
            <button
              aria-label="Close"
              className="close-btn"
              onClick={onClose}
              title="Close"
              type="button"
            >
              <IconX />
            </button>
          </div>
          <h2>{mode === "event" ? "New event" : "New announcement"}</h2>
          {error && <div className="composer-error">{error}</div>}
          <div className="composer-form">
            <label className="form-field">
              <span className="form-label">Title</span>
              <input
                className="form-input"
                id="cf-title"
                placeholder={
                  mode === "event"
                    ? "e.g. Drivetrain Build"
                    : "e.g. Regional Registration Confirmed"
                }
                type="text"
              />
            </label>
            {mode === "event" ? (
              <>
                <div className="form-row">
                  <label className="form-field date-time-field">
                    <span className="form-label">Start date</span>
                    <input
                      className="form-input"
                      defaultValue={todayStr}
                      id="cf-start-date"
                      type="date"
                    />
                  </label>
                  <label className="form-field date-time-field">
                    <span className="form-label">End date</span>
                    <input
                      className="form-input"
                      defaultValue={todayStr}
                      id="cf-end-date"
                      type="date"
                    />
                  </label>
                </div>
                <button
                  aria-pressed="false"
                  className="allday-toggle"
                  id="cf-allday"
                  onClick={(e) => {
                    const btn = e.currentTarget;
                    btn.classList.toggle("selected");
                    btn.setAttribute(
                      "aria-pressed",
                      btn.classList.contains("selected") ? "true" : "false"
                    );
                  }}
                  type="button"
                >
                  <span className="dot" />
                  <span>All-day event</span>
                </button>
                <div className="form-row">
                  <label className="form-field date-time-field">
                    <span className="form-label">Start time</span>
                    <input
                      className="form-input"
                      defaultValue="09:00"
                      id="cf-start-time"
                      type="time"
                    />
                  </label>
                  <label className="form-field date-time-field">
                    <span className="form-label">End time</span>
                    <input
                      className="form-input"
                      defaultValue="10:00"
                      id="cf-end-time"
                      type="time"
                    />
                  </label>
                </div>
                <div className="subteam-picker">
                  <span className="form-label">
                    Subteams - select at least one
                  </span>
                  <div className="subteam-pill-row">
                    {(
                      Object.entries(CATEGORIES) as [
                        CategoryKey,
                        { label: string; color: string },
                      ][]
                    ).map(([key, c]) => (
                      <button
                        className="subteam-pill"
                        data-subteam={key}
                        key={key}
                        onClick={(e) => {
                          const pill = e.currentTarget;
                          pill.classList.toggle("selected");
                          pill.setAttribute(
                            "aria-pressed",
                            pill.classList.contains("selected")
                              ? "true"
                              : "false"
                          );
                        }}
                        style={
                          {
                            "--pill-bg": hexToRgba(c.color, 0.16),
                            "--pill-border": hexToRgba(c.color, 0.55),
                            "--pill-glow": hexToRgba(c.color, 0.4),
                          } as React.CSSProperties
                        }
                        type="button"
                      >
                        <span
                          className="cat-dot"
                          style={{ background: c.color, height: 7, width: 7 }}
                        />
                        {esc(c.label)}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="form-field">
                  <span className="form-label">Location</span>
                  <input
                    className="form-input"
                    id="cf-location"
                    placeholder="e.g. Shop Bay 1"
                    type="text"
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Organizer</span>
                  <input
                    className="form-input"
                    id="cf-organizer"
                    placeholder="e.g. Alex Chen"
                    type="text"
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Details</span>
                  <textarea
                    className="form-input form-textarea"
                    id="cf-info"
                    placeholder="What's this event about?"
                    rows={3}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="form-field">
                  <span className="form-label">Message</span>
                  <textarea
                    className="form-input form-textarea"
                    id="cf-snippet"
                    placeholder="What should the team know?"
                    rows={4}
                  />
                </label>
                <p className="composer-hint">
                  Posted announcements are timestamped with the moment you
                  publish them.
                </p>
              </>
            )}
          </div>
          <div className="form-actions">
            <button className="secondary-btn" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="primary-btn" onClick={onSubmit} type="button">
              {mode === "event" ? "Create event" : "Post announcement"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeSubteamName(name: string): CategoryKey | null {
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

export default function CalendarApp() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();

  const currentUser = useQuery(api.users.currentUser);
  const ensureUser = useMutation(api.users.ensureUser);
  const convexSubteams = useQuery(api.subteams.list);
  const eventTypes = useQuery(api.eventTypes.list);
  const convexAnnouncements = useQuery(api.announcements.list);

  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [view, setView] = useState<"month" | "week" | "announcements">("month");
  const [cursor, setCursor] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventModalOrigin, setEventModalOrigin] = useState<null | "daylist">(
    null
  );
  const [dayListDate, setDayListDate] = useState<string | null>(null);
  const [dayListScrollTop, setDayListScrollTop] = useState(0);
  const [dayListJustOpened, setDayListJustOpened] = useState(false);
  const [mobileWeekOffset, setMobileWeekOffset] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<"event" | "announcement">(
    "event"
  );
  const [composerError, setComposerError] = useState<string | null>(null);
  const [subteamFilter, setSubteamFilter] = useState<Set<CategoryKey>>(
    new Set(Object.keys(CATEGORIES) as CategoryKey[])
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersJustOpened, setFiltersJustOpened] = useState(false);
  const [swipeEnter, setSwipeEnter] = useState<
    null | "from-left" | "from-right"
  >(null);
  const [viewTransition, setViewTransition] = useState<ViewTransition>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationDialog | null>(
    null
  );

  const today = useMemo(() => stripTime(new Date()), []);

  useEffect(() => {
    if (isSignedIn) {
      ensureUser();
    }
  }, [isSignedIn, ensureUser]);

  const eventQueryRange = useMemo(() => {
    let start: Date;
    let end: Date;
    if (view === "month") {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      start = addDays(first, -first.getDay());
      end = addDays(start, 41);
    } else {
      start = addDays(today, -14);
      end = addDays(today, 21);
    }
    return { end: end.getTime(), start: start.getTime() };
  }, [view, cursor, today]);

  const convexEvents = useQuery(api.events.listByRange, eventQueryRange);

  const subteamIdToKey = useMemo(() => {
    const map = new Map<Id<"subteams">, CategoryKey>();
    if (convexSubteams) {
      for (const st of convexSubteams) {
        const key = normalizeSubteamName(st.subteamName);
        if (key) {
          map.set(st._id, key);
        }
      }
    }
    return map;
  }, [convexSubteams]);

  const keyToSubteamId = useMemo(() => {
    const map = new Map<CategoryKey, Id<"subteams">>();
    if (convexSubteams) {
      for (const st of convexSubteams) {
        const key = normalizeSubteamName(st.subteamName);
        if (key && !map.has(key)) {
          map.set(key, st._id);
        }
      }
    }
    return map;
  }, [convexSubteams]);

  const defaultEventTypeId = useMemo(() => {
    if (!eventTypes || eventTypes.length === 0) {
      return null;
    }
    const standard = eventTypes.find((et) =>
      et.name.toLowerCase().includes("standard")
    );
    return standard?._id ?? eventTypes[0]._id;
  }, [eventTypes]);

  const events = useMemo<CalendarEvent[]>(() => {
    if (!convexEvents) {
      return [];
    }
    return convexEvents.map((e) => {
      const subteams = e.subteams
        .map((id) => subteamIdToKey.get(id))
        .filter(Boolean) as CategoryKey[];
      return {
        allDay: e.allDay,
        createdAt: new Date(e.updatedAt),
        end: new Date(e.endTime),
        id: e._id,
        info: e.info ?? undefined,
        location: e.location,
        organizer: e.organizer,
        start: new Date(e.startTime),
        subteams,
        title: e.title,
      };
    });
  }, [convexEvents, subteamIdToKey]);

  const visibleEvents = useMemo(
    () => events.filter((event) => isEventVisible(event, subteamFilter)),
    [events, subteamFilter]
  );

  const announcements = useMemo<CalendarAnnouncement[]>(() => {
    if (!convexAnnouncements) {
      return [];
    }
    return convexAnnouncements.map((a) => ({
      date: new Date(a.updatedAt),
      id: a._id,
      snippet: a.snippet,
      title: a.title,
    }));
  }, [convexAnnouncements]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) {
      return null;
    }
    return (
      events.find((e) => e.id === selectedEventId) ??
      announcements.find((a) => a.id === selectedEventId) ??
      null
    );
  }, [selectedEventId, events, announcements]);

  const createEventMutation = useMutation(api.events.create);
  const createAnnouncementMutation = useMutation(api.announcements.create);
  const removeEventMutation = useMutation(api.events.remove);
  const removeAnnouncementMutation = useMutation(api.announcements.remove);

  const handleSetView = useCallback(
    (v: "month" | "week" | "announcements") => {
      const viewOrder = { announcements: 2, month: 0, week: 1 } as const;
      if (v !== view) {
        setViewTransition(
          viewOrder[v] > viewOrder[view] ? "from-right" : "from-left"
        );
      }
      setView(v);
      if (v === "week") {
        setMobileWeekOffset(0);
      }
      setDayListDate(null);
      setDayListScrollTop(0);
      setSelectedEventId(null);
      setEventModalOrigin(null);
    },
    [view]
  );

  const handleOpenEvent = useCallback((id: string) => {
    setSelectedEventId(id);
    setEventModalOrigin(null);
  }, []);
  const handleOpenEventFromList = useCallback((id: string) => {
    setSelectedEventId(id);
    setEventModalOrigin("daylist");
  }, []);
  const handleCloseModal = useCallback(() => {
    setSelectedEventId(null);
    setEventModalOrigin(null);
    setDayListDate(null);
    setDayListScrollTop(0);
  }, []);
  const handleBackToDayList = useCallback(() => {
    setSelectedEventId(null);
    setEventModalOrigin(null);
  }, []);
  const handleOpenDayList = useCallback((dateKeyStr: string) => {
    setDayListDate(dateKeyStr);
    setDayListScrollTop(0);
    setDayListJustOpened(true);
  }, []);
  const handleCloseDayList = useCallback(() => {
    setDayListDate(null);
    setDayListScrollTop(0);
  }, []);
  const handleOpenComposer = useCallback(() => {
    if (!currentUser?.isAdmin) {
      return;
    }
    setComposerMode("event");
    setComposerError(null);
    setComposerOpen(true);
  }, [currentUser?.isAdmin]);
  const handleCloseComposer = useCallback(() => {
    setComposerOpen(false);
    setComposerError(null);
  }, []);
  const handleComposerTab = useCallback((m: "event" | "announcement") => {
    setComposerMode(m);
    setComposerError(null);
  }, []);

  const handleRequestDelete = useCallback(
    (event: CalendarEvent | CalendarAnnouncement) => {
      const isAnnouncement = "snippet" in event;
      setConfirmation({
        action: async () => {
          if (isAnnouncement) {
            await removeAnnouncementMutation({
              announcementId: event.id as Id<"announcements">,
            });
          } else {
            await removeEventMutation({ eventId: event.id as Id<"events"> });
          }
          handleCloseModal();
        },
        confirmLabel: "Delete",
        isDestructive: true,
        message: `Delete this ${isAnnouncement ? "announcement" : "event"}?`,
      });
    },
    [handleCloseModal, removeAnnouncementMutation, removeEventMutation]
  );

  const handleToggleSubteamFilter = useCallback((key: CategoryKey) => {
    setSubteamFilter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleToggleFilters = useCallback(() => {
    setFiltersOpen((open) => {
      const next = !open;
      setFiltersJustOpened(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!filtersOpen) {
      return;
    }

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (
        target.closest("#subteam-filter-popover") ||
        target.closest(".filter-btn")
      ) {
        return;
      }
      setFiltersOpen(false);
      setFiltersJustOpened(false);
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () =>
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [filtersOpen]);

  const handlePrevMonth = useCallback(() => {
    setCursor(
      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
    );
    setSwipeEnter("from-left");
  }, []);

  const handleNextMonth = useCallback(() => {
    setCursor(
      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
    );
    setSwipeEnter("from-right");
  }, []);

  const handleToday = useCallback(() => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  }, [today]);

  const handleWeekPrev = useCallback(() => {
    setMobileWeekOffset((offset) => offset - 1);
    setSwipeEnter("from-left");
  }, []);

  const handleWeekNext = useCallback(() => {
    setMobileWeekOffset((offset) => offset + 1);
    setSwipeEnter("from-right");
  }, []);

  const handleSubmitComposer = useCallback(async () => {
    const titleEl = document.getElementById(
      "cf-title"
    ) as HTMLInputElement | null;
    const title = (titleEl?.value || "").trim();
    if (!title) {
      setComposerError("Please enter a title.");
      return;
    }

    if (composerMode === "event") {
      const selectedPills = Array.from(
        document.querySelectorAll(".subteam-pill.selected")
      ).map((btn) => (btn as HTMLElement).dataset.subteam as CategoryKey);
      if (!selectedPills.length) {
        setComposerError("Please select at least one subteam.");
        return;
      }

      const startDateStr = (
        document.getElementById("cf-start-date") as HTMLInputElement
      )?.value;
      const endDateStr =
        (document.getElementById("cf-end-date") as HTMLInputElement)?.value ||
        startDateStr;
      if (!(startDateStr && endDateStr)) {
        setComposerError("Please choose a start and end date.");
        return;
      }

      const [sy, smo, sd] = startDateStr.split("-").map(Number);
      const [ey, emo, ed] = endDateStr.split("-").map(Number);
      const startDateObj = new Date(sy, smo - 1, sd);
      const endDateObj = new Date(ey, emo - 1, ed);
      if (endDateObj < startDateObj) {
        setComposerError("End date can't be before the start date.");
        return;
      }

      const allDayToggle = document.getElementById("cf-allday");
      const allDay = allDayToggle?.classList.contains("selected") ?? false;

      let start: Date;
      let end: Date;
      if (allDay) {
        start = stripTime(startDateObj);
        end = stripTime(endDateObj);
      } else {
        const startTimeStr =
          (document.getElementById("cf-start-time") as HTMLInputElement)
            ?.value || "09:00";
        const endTimeStr =
          (document.getElementById("cf-end-time") as HTMLInputElement)?.value ||
          "10:00";
        const [sh, smin] = startTimeStr.split(":").map(Number);
        const [eh, emin] = endTimeStr.split(":").map(Number);
        start = atTime(startDateObj, sh, smin);
        end = atTime(endDateObj, eh, emin);
        if (end <= start) {
          setComposerError("End time must be after the start time.");
          return;
        }
      }

      const location = (
        (document.getElementById("cf-location") as HTMLInputElement)?.value ||
        ""
      ).trim();
      const organizer = (
        (document.getElementById("cf-organizer") as HTMLInputElement)?.value ||
        ""
      ).trim();
      const info = (
        (document.getElementById("cf-info") as HTMLTextAreaElement)?.value || ""
      ).trim();
      const subteamIds = selectedPills
        .map((key) => keyToSubteamId.get(key))
        .filter(Boolean) as Id<"subteams">[];

      if (!defaultEventTypeId) {
        setComposerError("Event types not loaded yet. Please try again.");
        return;
      }

      try {
        await createEventMutation({
          allDay,
          endTime: end.getTime(),
          eventTypeId: defaultEventTypeId,
          info: info || undefined,
          location: location || "",
          organizer: organizer || "",
          startTime: start.getTime(),
          subteams: subteamIds,
          title,
        });
        setCursor(new Date(start.getFullYear(), start.getMonth(), 1));
        setComposerOpen(false);
        setComposerError(null);
      } catch (err) {
        setComposerError(
          err instanceof Error ? err.message : "Failed to create event"
        );
      }
    } else {
      const snippet = (
        (document.getElementById("cf-snippet") as HTMLTextAreaElement)?.value ||
        ""
      ).trim();
      if (!snippet) {
        setComposerError("Please add a message for the announcement.");
        return;
      }
      try {
        await createAnnouncementMutation({ snippet, title });
        setComposerOpen(false);
        setComposerError(null);
      } catch (err) {
        setComposerError(
          err instanceof Error ? err.message : "Failed to post announcement"
        );
      }
    }
  }, [
    composerMode,
    keyToSubteamId,
    defaultEventTypeId,
    createEventMutation,
    createAnnouncementMutation,
  ]);

  const handleSignOut = useCallback(() => {
    setConfirmation({
      action: async () => {
        await clerk.signOut();
      },
      confirmLabel: "Sign out",
      message: "Sign out of your account?",
    });
  }, [clerk]);

  useEffect(() => {
    if (swipeEnter) {
      const timer = setTimeout(() => setSwipeEnter(null), 300);
      return () => clearTimeout(timer);
    }
  }, [swipeEnter]);
  useEffect(() => {
    if (viewTransition) {
      const timer = setTimeout(() => setViewTransition(null), 340);
      return () => clearTimeout(timer);
    }
  }, [viewTransition]);
  useEffect(() => {
    if (filtersJustOpened) {
      const timer = setTimeout(() => setFiltersJustOpened(false), 200);
      return () => clearTimeout(timer);
    }
  }, [filtersJustOpened]);
  useEffect(() => {
    if (dayListJustOpened) {
      const timer = setTimeout(() => setDayListJustOpened(false), 200);
      return () => clearTimeout(timer);
    }
  }, [dayListJustOpened]);

  if (!isLoaded) {
    return (
      <div
        id="app"
        style={{
          alignItems: "center",
          display: "flex",
          height: "100vh",
          justifyContent: "center",
        }}
      >
        <div className="micro-label">Loading...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div id="app">
        <div className="backdrop">
          <div className="dots" />
        </div>
        <div className="content">
          <SignInScreen
            authMode={authMode}
            onToggleMode={() =>
              setAuthMode((m) => (m === "signin" ? "signup" : "signin"))
            }
          />
        </div>
      </div>
    );
  }

  const userName = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`.trim() || "User"
    : user?.fullName || "User";
  const isAdmin = currentUser?.isAdmin ?? false;

  return (
    <div id="app">
      <div className="backdrop">
        <div className="grad" />
        <div className="blob1" />
        <div className="blob2" />
        <div className="dots" />
      </div>
      <div className="content">
        <div className="top-glow" />
        <TopBar
          events={events}
          filtersJustOpened={filtersJustOpened}
          filtersOpen={filtersOpen}
          isAdmin={isAdmin}
          onOpenComposer={handleOpenComposer}
          onOpenEvent={handleOpenEvent}
          onSignOut={handleSignOut}
          onToggleFilters={handleToggleFilters}
          onToggleSubteam={handleToggleSubteamFilter}
          subteamFilter={subteamFilter}
          userName={userName}
        />
        {view === "month" && (
          <MonthView
            cursor={cursor}
            events={visibleEvents}
            onNextMonth={handleNextMonth}
            onOpenDayList={handleOpenDayList}
            onOpenEvent={handleOpenEvent}
            onPrevMonth={handlePrevMonth}
            onToday={handleToday}
            swipeEnter={swipeEnter}
            today={today}
            viewTransition={viewTransition}
          />
        )}
        {view === "week" && (
          <WeekView
            events={visibleEvents}
            mobileWeekOffset={mobileWeekOffset}
            onOpenEvent={handleOpenEvent}
            onWeekNext={handleWeekNext}
            onWeekPrev={handleWeekPrev}
            swipeEnter={swipeEnter}
            today={today}
            viewTransition={viewTransition}
          />
        )}
        {view === "announcements" && (
          <AnnouncementsView
            announcements={announcements}
            onOpenAnnouncement={handleOpenEvent}
            viewTransition={viewTransition}
          />
        )}
        <BottomNav onSetView={handleSetView} view={view} />
        {dayListDate && (
          <DayListModal
            animate={dayListJustOpened}
            dateKeyStr={dayListDate}
            events={events}
            onClose={handleCloseDayList}
            onOpenEvent={handleOpenEventFromList}
            scrollTop={dayListScrollTop}
          />
        )}
        {selectedEvent && (
          <EventModal
            cameFromDayList={eventModalOrigin === "daylist"}
            event={selectedEvent}
            isAdmin={isAdmin}
            onBackToDayList={handleBackToDayList}
            onClose={handleCloseModal}
            onRequestDelete={handleRequestDelete}
          />
        )}
        {composerOpen && (
          <ComposerModal
            error={composerError}
            mode={composerMode}
            onClose={handleCloseComposer}
            onSubmit={handleSubmitComposer}
            onSwitchMode={handleComposerTab}
          />
        )}
        {confirmation && (
          <ConfirmationModal
            confirmation={confirmation}
            onClose={() => setConfirmation(null)}
          />
        )}
      </div>
    </div>
  );
}
