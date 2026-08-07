"use client";

import { useLayoutEffect, useRef } from "react";
import { positionPillIndicator } from "@/lib/calendar/calendar";

export function BottomNav({
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
