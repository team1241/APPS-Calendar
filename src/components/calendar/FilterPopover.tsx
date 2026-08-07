"use client";
import {
  type CategoryKey,
  FILTER_CATEGORY_ORDER,
} from "@/lib/calendar/calendar";
import { SubteamPill } from "./SubteamPill";

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
        {FILTER_CATEGORY_ORDER.map((key) => (
          <SubteamPill
            categoryKey={key}
            key={key}
            onClick={() => onToggleSubteam(key)}
            selected={subteamFilter.has(key)}
          />
        ))}
      </div>
    </div>
  );
}
