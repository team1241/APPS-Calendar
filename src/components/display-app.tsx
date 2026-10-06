"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CATEGORIES,
  type CategoryKey,
  stripTime,
  type ViewTransition,
} from "@/lib/calendar/calendar";
import { useCalendarData } from "../hooks/use-calendar-data";
import { useCarouselRotation } from "../hooks/use-carousel-rotation";
import { AnnouncementsView } from "./calendar/AnnouncementsView";
import { MonthView } from "./calendar/MonthView";
import { WeekView } from "./calendar/WeekView";

type DisplayView = "month" | "week" | "announcements";

const ALL_SUBTEAMS = new Set(Object.keys(CATEGORIES) as CategoryKey[]);
const VIEW_ORDER: Record<DisplayView, number> = {
  announcements: 2,
  month: 0,
  week: 1,
};
const VIEW_TRANSITION_MS = 460;
const noop = () => undefined;

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

  const { announcements, events } = useCalendarData({
    cursor,
    isSignedIn: false,
    subteamFilter: ALL_SUBTEAMS,
    today,
    view,
  });

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
