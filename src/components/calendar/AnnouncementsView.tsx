"use client";

import { ChevronRightIcon, Megaphone01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo } from "react";
import {
  type CalendarAnnouncement,
  fmtTime,
  type ViewTransition,
} from "@/lib/calendar/calendar";

export function AnnouncementsView({
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
      className={[
        "ann-wrap",
        "view-slide",
        viewTransition && `view-transition-${viewTransition}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="ann-header">
        <HugeiconsIcon icon={Megaphone01Icon} size={20} strokeWidth={2} />
        <h1>Announcements</h1>
      </div>
      <div className="ann-list">
        {sorted.map((a, i) => (
          <button
            className={["ann-card", i === 0 && "latest"]
              .filter(Boolean)
              .join(" ")}
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
              <HugeiconsIcon
                icon={ChevronRightIcon}
                size={15}
                strokeWidth={2}
              />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
