"use client";

import {
  CATEGORIES,
  type CalendarEvent,
  type CategoryKey,
  esc,
  hexToRgba,
} from "@/lib/calendar/calendar";

export function SubteamTags({ event }: { event: CalendarEvent }) {
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
