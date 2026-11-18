"use client";

import {
  CATEGORIES,
  type CalendarEvent,
  type CategoryKey,
  FALLBACK_CATEGORY_COLOR,
  withAlpha,
} from "@/lib/calendar/calendar";

export function SubteamTags({ event }: { event: CalendarEvent }) {
  if (!Array.isArray(event.subteams) || event.subteams.length === 0) {
    return null;
  }
  return (
    <div className="subteam-tags">
      {event.subteams.map((key) => {
        const team = CATEGORIES[key as CategoryKey];
        const color = team?.color ?? FALLBACK_CATEGORY_COLOR;
        const label = team?.label || key;
        return (
          <span
            className="subteam-tag"
            key={key}
            style={{
              background: withAlpha(color, 0.18),
              border: `1px solid ${withAlpha(color, 0.32)}`,
            }}
          >
            <span
              className="cat-dot"
              style={{ background: color, height: 6, width: 6 }}
            />
            {label}
          </span>
        );
      })}
    </div>
  );
}
