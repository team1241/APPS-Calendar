"use client";

import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  stripTime,
  type ViewTransition,
} from "@/lib/calendar/calendar";
import {
  toCalendarAnnouncements,
  toCalendarEvents,
} from "@/lib/calendar/convex-mappers";
import { createSubteamMaps } from "@/lib/calendar/subteam-maps";
import { api } from "../../convex/_generated/api";
import { useCarouselRotation } from "../hooks/use-carousel-rotation";
import { AnnouncementsView } from "./calendar/AnnouncementsView";
import { MonthView } from "./calendar/MonthView";
import { WeekView } from "./calendar/WeekView";

type DisplayView = "month" | "week" | "announcements";

const MONTH_GRID_DAYS = 41;
const WEEK_DAYS_BEFORE = 14;
const WEEK_DAYS_AFTER = 21;
const VIEW_ORDER: Record<DisplayView, number> = {
  announcements: 2,
  month: 0,
  week: 1,
};
const VIEW_TRANSITION_MS = 460;
const noop = () => undefined;

/**
 * @brief Reads a value from the URL fragment (#token=...&theme=light), which browsers never send to the server.
 */
function readFragmentParam(key: string): string {
  return new URLSearchParams(window.location.hash.slice(1)).get(key) ?? "";
}

/**
 * @brief Read-only, login-free calendar for the wall display; always in carousel mode.
 */
export default function DisplayApp() {
  const today = useMemo(() => stripTime(new Date()), []);
  const cursor = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today]
  );
  const [view, setView] = useState<DisplayView>("month");
  const [viewTransition, setViewTransition] = useState<ViewTransition>(null);

  const token = useMemo(() => readFragmentParam("token"), []);

  // Lets the kiosk pin a theme instead of following the device setting.
  useEffect(() => {
    const theme = readFragmentParam("theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    }
  }, []);
  // Covers both the month grid and the week view so rotating views doesn't refetch.
  const range = useMemo(() => {
    const monthGridStart = addDays(cursor, -cursor.getDay());
    const start = Math.min(
      monthGridStart.getTime(),
      addDays(today, -WEEK_DAYS_BEFORE).getTime()
    );
    const end = Math.max(
      addDays(monthGridStart, MONTH_GRID_DAYS).getTime(),
      addDays(today, WEEK_DAYS_AFTER).getTime()
    );
    return { end, start };
  }, [cursor, today]);
  const feed = useQuery(api.display.feed, token ? { ...range, token } : "skip");
  const { subteamIdToKey } = useMemo(
    () => createSubteamMaps(feed?.subteams),
    [feed?.subteams]
  );
  const events = useMemo(
    () => toCalendarEvents(feed?.events, subteamIdToKey),
    [feed?.events, subteamIdToKey]
  );
  const announcements = useMemo(
    () => toCalendarAnnouncements(feed?.announcements),
    [feed?.announcements]
  );
  const isUnauthorized = !token || feed === null;

  const handleSetView = useCallback(
    (next: DisplayView) => {
      setViewTransition(
        VIEW_ORDER[next] > VIEW_ORDER[view] ? "from-right" : "from-left"
      );
      setView(next);
    },
    [view]
  );

  useCarouselRotation({ enabled: true, onSetView: handleSetView, view });

  useEffect(() => {
    if (!viewTransition) {
      return;
    }
    const timer = setTimeout(() => setViewTransition(null), VIEW_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [viewTransition]);

  // Reload at midnight so "today" stays correct and new deploys get picked up.
  useEffect(() => {
    const nextMidnight = new Date(today);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    const timer = setTimeout(
      () => window.location.reload(),
      nextMidnight.getTime() - Date.now()
    );
    return () => clearTimeout(timer);
  }, [today]);

  if (isUnauthorized) {
    return (
      <div
        className="display-mode"
        id="app"
        style={{
          alignItems: "center",
          display: "flex",
          height: "100vh",
          justifyContent: "center",
        }}
      >
        <div className="micro-label">Display not authorized</div>
      </div>
    );
  }

  return (
    <div className="carousel-mode display-mode" id="app">
      <div className="backdrop">
        <div className="grad" />
        <div className="blob1" />
        <div className="blob2" />
        <div className="dots" />
      </div>
      <div className="content">
        <div className="top-glow" />
        {view === "month" && (
          <MonthView
            cursor={cursor}
            events={events}
            onNextMonth={noop}
            onOpenDayList={noop}
            onOpenEvent={noop}
            onPrevMonth={noop}
            onToday={noop}
            swipeEnter={null}
            today={today}
            viewTransition={viewTransition}
          />
        )}
        {view === "week" && (
          <WeekView
            events={events}
            mobileWeekOffset={0}
            onOpenEvent={noop}
            onWeekNext={noop}
            onWeekPrev={noop}
            swipeEnter={null}
            today={today}
            viewTransition={viewTransition}
          />
        )}
        {view === "announcements" && (
          <AnnouncementsView
            announcements={announcements}
            onOpenAnnouncement={noop}
            viewTransition={viewTransition}
          />
        )}
      </div>
    </div>
  );
}
