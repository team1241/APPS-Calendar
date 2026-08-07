"use client";

import {
  Logout01Icon,
  PlusSignIcon,
  SlidersHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import {
  CATEGORIES,
  type CalendarEvent,
  type CategoryKey,
  formatCountdown,
  getEventColors,
  isEventVisible,
} from "@/lib/calendar/calendar";
import { ColorSwatch } from "./ColorSwatch";
import { FilterPopover } from "./FilterPopover";

export function TopBar({
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
            src="/Circle_Logo_Theory.png"
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
            className={["icon-btn", "filter-btn", filtersOpen && "active"]
              .filter(Boolean)
              .join(" ")}
            onClick={onToggleFilters}
            title="Filter by subteam"
            type="button"
          >
            <HugeiconsIcon
              icon={SlidersHorizontalIcon}
              size={16}
              strokeWidth={2}
            />
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
            <HugeiconsIcon icon={PlusSignIcon} size={18} strokeWidth={2} />
          </button>
        ) : null}
        <button className="signout-btn" onClick={onSignOut} type="button">
          <HugeiconsIcon icon={Logout01Icon} size={15} strokeWidth={2} /> Sign
          out
        </button>
        <div className="avatar">{userName.charAt(0).toUpperCase()}</div>
      </div>
    </div>
  );
}
