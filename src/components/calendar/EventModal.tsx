"use client";
import {
  Cancel01Icon,
  ChevronLeftIcon,
  Clock01Icon,
  Delete02Icon,
  Location01Icon,
  User02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type React from "react";
import {
  CATEGORIES,
  type CalendarAnnouncement,
  type CalendarEvent,
  fmtTime,
  getEventColors,
} from "@/lib/calendar/calendar";
import { SubteamTags } from "./SubteamTags";

export function EventModal({
  event,
  cameFromDayList,
  isAdmin,
  onRequestDelete,
  onClose,
  onBackToDayList,
}: {
  event: CalendarEvent | CalendarAnnouncement | null;
  cameFromDayList: boolean;
  isAdmin: boolean;
  onRequestDelete: (event: CalendarEvent | CalendarAnnouncement) => void;
  onClose: () => void;
  onBackToDayList: () => void;
}) {
  if (!event) {
    return null;
  }
  const isAnnouncement = "snippet" in event;
  const calEvent = event as CalendarEvent;
  const colors = isAnnouncement ? ["#999999"] : getEventColors(calEvent);
  const primaryColor = colors[0];

  let chip: React.ReactNode = null;
  if (
    !isAnnouncement &&
    Array.isArray(calEvent.subteams) &&
    calEvent.subteams.length
  ) {
    chip = <SubteamTags event={calEvent} />;
  } else if (!isAnnouncement && calEvent.category) {
    chip = (
      <div
        className="cat-chip"
        style={{ background: `${CATEGORIES[calEvent.category]?.color}22` }}
      >
        <span
          className="cat-dot"
          style={{
            background: CATEGORIES[calEvent.category]?.color,
            height: 7,
            width: 7,
          }}
        />
        <span className="lbl">{CATEGORIES[calEvent.category]?.label}</span>
      </div>
    );
  }

  let timeStr = "";
  if (isAnnouncement) {
    timeStr = (event as CalendarAnnouncement).date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      weekday: "long",
      year: "numeric",
    });
  } else if (calEvent.allDay) {
    timeStr = `${calEvent.start.toLocaleDateString("en-US", { day: "numeric", month: "short" })} - ${calEvent.end.toLocaleDateString("en-US", { day: "numeric", month: "short" })}`;
  } else {
    timeStr = `${calEvent.start.toLocaleDateString("en-US", { day: "numeric", month: "short", weekday: "short" })} ? ${fmtTime(calEvent.start)} - ${fmtTime(calEvent.end)}`;
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="event-modal">
        <div
          className="glow"
          style={{
            background: `radial-gradient(ellipse, ${primaryColor}33 0%, transparent 70%)`,
          }}
        />
        <div style={{ position: "relative" }}>
          <div className="head">
            <div className="head-left">
              {cameFromDayList && (
                <button
                  aria-label="Back"
                  className="back-btn"
                  onClick={onBackToDayList}
                  title="Back to day events"
                  type="button"
                >
                  <HugeiconsIcon
                    icon={ChevronLeftIcon}
                    size={15}
                    strokeWidth={2}
                  />
                </button>
              )}
              {chip}
            </div>
            <button
              aria-label="Close event details"
              className="close-btn"
              onClick={onClose}
              title="Close"
              type="button"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={17} strokeWidth={2} />
            </button>
          </div>
          <h2>{event.title}</h2>
          <div className="info-rows">
            <div className="info-row">
              <HugeiconsIcon icon={Clock01Icon} size={14} strokeWidth={2} />
              <span>{timeStr}</span>
            </div>
            {!isAnnouncement && calEvent.location && (
              <div className="info-row">
                <HugeiconsIcon
                  icon={Location01Icon}
                  size={14}
                  strokeWidth={2}
                />
                <span>{calEvent.location}</span>
              </div>
            )}
            {!isAnnouncement && calEvent.organizer && (
              <div className="info-row">
                <HugeiconsIcon icon={User02Icon} size={14} strokeWidth={2} />
                <span>{calEvent.organizer}</span>
              </div>
            )}
          </div>
          <p className="desc">
            {isAnnouncement
              ? (event as CalendarAnnouncement).snippet
              : calEvent.info || ""}
          </p>
          {isAdmin && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                aria-label="Delete event"
                className="close-btn"
                onClick={() => onRequestDelete(event)}
                title="Delete"
                type="button"
              >
                <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
