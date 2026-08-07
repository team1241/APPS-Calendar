"use client";
import type React from "react";
import {
  CATEGORIES,
  type CategoryKey,
  esc,
  FILTER_CATEGORY_ORDER,
  hexToRgba,
} from "@/lib/calendar/calendar";

export function FilterPopover({
  subteamFilter,
  filtersJustOpened,
  onToggleSubteam,
}: {
  subteamFilter: Set<CategoryKey>;
  filtersJustOpened: boolean;
  onToggleSubteam: (key: CategoryKey) => void;
}) {
  return (
    <div
      aria-label="Subteam filters"
      className={["filter-popover", filtersJustOpened && "just-opened"]
        .filter(Boolean)
        .join(" ")}
      id="subteam-filter-popover"
      role="group"
    >
      <span className="filter-popover-label">Filter by subteam</span>
      <div className="subteam-pill-row">
        {FILTER_CATEGORY_ORDER.map((key) => {
          const c = CATEGORIES[key];
          return (
            <button
              aria-pressed={subteamFilter.has(key)}
              className={["subteam-pill", subteamFilter.has(key) && "selected"]
                .filter(Boolean)
                .join(" ")}
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
    </div>
  );
}
