"use client";

import {
  ArrowLeft02Icon,
  Logout01Icon,
  PlusSignIcon,
  SlidersHorizontalIcon,
  UserShield01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { UserRole } from "@/lib/admin/types";
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
  adminPanelOpen,
  canManageUsers,
  currentUserRole,
  events,
  filtersOpen,
  filtersJustOpened,
  isAdmin,
  onBackToCalendar,
  onOpenAdminPanel,
  onOpenComposer,
  onOpenEvent,
  onSignOut,
  onToggleFilters,
  onToggleSubteam,
  onToggleCarousel,
  subteamFilter,
  userName,
}: {
  adminPanelOpen: boolean;
  canManageUsers: boolean;
  currentUserRole: UserRole;
  events: CalendarEvent[];
  filtersOpen: boolean;
  filtersJustOpened: boolean;
  isAdmin: boolean;
  onBackToCalendar: () => void;
  onOpenAdminPanel: () => void;
  onOpenComposer: () => void;
  onOpenEvent: (id: string) => void;
  onSignOut: () => void;
  onToggleFilters: () => void;
  onToggleSubteam: (key: CategoryKey) => void;
  onToggleCarousel: () => void;
  subteamFilter: Set<CategoryKey>;
  userName: string;
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const visibleEventsList = events.filter((e) =>
    isEventVisible(e, subteamFilter)
  );
  const [nextEvent] = visibleEventsList
    .filter((e) => !e.allDay && e.start > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const isFilterActive = subteamFilter.size < Object.keys(CATEGORIES).length;

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !profileMenuRef.current?.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

  const handleOpenAdminPanel = () => {
    setProfileMenuOpen(false);
    onOpenAdminPanel();
  };

  const handleSignOut = () => {
    setProfileMenuOpen(false);
    onSignOut();
  };

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
      {!adminPanelOpen && nextEvent ? (
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
        {adminPanelOpen ? (
          <button
            className="admin-back-button"
            onClick={onBackToCalendar}
            type="button"
          >
            <HugeiconsIcon icon={ArrowLeft02Icon} size={16} strokeWidth={2} />
            Calendar
          </button>
        ) : (
          <>
            <button
              className="carousel-btn"
              onClick={onToggleCarousel}
              title="Start carousel mode"
              type="button"
            >
              Carousel
            </button>
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
          </>
        )}
        <div className="profile-menu" ref={profileMenuRef}>
          <button
            aria-expanded={profileMenuOpen}
            aria-haspopup="menu"
            aria-label={`Open profile menu for ${userName}`}
            className={["avatar", "avatar-button", profileMenuOpen && "active"]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setProfileMenuOpen((isOpen) => !isOpen)}
            type="button"
          >
            {userName.charAt(0).toUpperCase()}
          </button>
          {profileMenuOpen && (
            <div className="profile-popover" role="menu">
              <div className="profile-popover-summary">
                <span className="profile-popover-avatar">
                  {userName.charAt(0).toUpperCase()}
                </span>
                <span>
                  <strong>{userName}</strong>
                  <small>
                    {currentUserRole.charAt(0).toUpperCase() +
                      currentUserRole.slice(1)}
                  </small>
                </span>
              </div>
              <div className="profile-popover-divider" />
              {canManageUsers && (
                <button
                  aria-current={adminPanelOpen ? "page" : undefined}
                  className="profile-menu-item"
                  disabled={adminPanelOpen}
                  onClick={handleOpenAdminPanel}
                  role="menuitem"
                  type="button"
                >
                  <HugeiconsIcon
                    icon={UserShield01Icon}
                    size={16}
                    strokeWidth={2}
                  />
                  Admin panel
                </button>
              )}
              <button
                className="profile-menu-item signout-menu-item"
                onClick={handleSignOut}
                role="menuitem"
                type="button"
              >
                <HugeiconsIcon icon={Logout01Icon} size={16} strokeWidth={2} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
