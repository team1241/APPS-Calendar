"use client";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLayoutEffect, useRef } from "react";
import {
  type CalendarEvent,
  FILTER_CATEGORY_ORDER,
  positionPillIndicator,
  toDateInputValue,
} from "@/lib/calendar/calendar";
import { SubteamPill } from "./SubteamPill";

const toTimeInputValue = (date: Date): string =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export function ComposerModal({
  allowAnnouncements,
  editingEvent,
  mode,
  error,
  onClose,
  onSwitchMode,
  onSubmit,
}: {
  allowAnnouncements: boolean;
  /** Prefills the form and saves changes to this event instead of creating one. */
  editingEvent?: CalendarEvent | null;
  mode: "event" | "announcement";
  error: string | null;
  onClose: () => void;
  onSwitchMode: (m: "event" | "announcement") => void;
  onSubmit: () => void;
}) {
  const todayStr = toDateInputValue(new Date());
  const isEditing = Boolean(editingEvent);
  const editingSubteams = new Set(editingEvent?.subteams ?? []);
  const isAllDay = editingEvent?.allDay ?? false;
  const startDateValue = editingEvent
    ? toDateInputValue(editingEvent.start)
    : todayStr;
  const endDateValue = editingEvent
    ? toDateInputValue(editingEvent.end)
    : todayStr;
  const startTimeValue =
    editingEvent && !isAllDay ? toTimeInputValue(editingEvent.start) : "09:00";
  const endTimeValue =
    editingEvent && !isAllDay ? toTimeInputValue(editingEvent.end) : "10:00";
  let heading = "New announcement";
  if (isEditing) {
    heading = "Edit event";
  } else if (mode === "event") {
    heading = "New event";
  }
  let submitLabel = "Post announcement";
  if (isEditing) {
    submitLabel = "Save changes";
  } else if (mode === "event") {
    submitLabel = "Create event";
  }
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabIndicatorRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const tabs = tabsRef.current;
    const indicator = tabIndicatorRef.current;
    if (!(tabs && indicator)) {
      return;
    }

    const updateIndicator = () => {
      positionPillIndicator(tabs, indicator);
    };

    updateIndicator();
    const frame = requestAnimationFrame(updateIndicator);
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(tabs);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [mode]);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="event-modal composer-modal">
        <div
          className="glow"
          style={{
            background:
              "radial-gradient(ellipse, rgb(var(--glow-rgb) / 0.10) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            position: "relative",
          }}
        >
          <div className="head">
            <div className="head-left">
              {allowAnnouncements && !isEditing && (
                <div className="composer-tabs" ref={tabsRef}>
                  <div className="tab-indicator" ref={tabIndicatorRef} />
                  <button
                    className={["composer-tab", mode === "event" && "active"]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => onSwitchMode("event")}
                    type="button"
                  >
                    Event
                  </button>
                  <button
                    className={[
                      "composer-tab",
                      mode === "announcement" && "active",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => onSwitchMode("announcement")}
                    type="button"
                  >
                    Announcement
                  </button>
                </div>
              )}
            </div>
            <button
              aria-label="Close"
              className="close-btn"
              onClick={onClose}
              title="Close"
              type="button"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={17} strokeWidth={2} />
            </button>
          </div>
          <h2>{heading}</h2>
          {error && <div className="composer-error">{error}</div>}
          <div className="composer-form">
            <label className="form-field">
              <span className="form-label">Title</span>
              <input
                className="form-input"
                defaultValue={editingEvent?.title}
                id="cf-title"
                placeholder={
                  mode === "event"
                    ? "e.g. Drivetrain Build"
                    : "e.g. Regional Registration Confirmed"
                }
                type="text"
              />
            </label>
            {mode === "event" ? (
              <>
                <div className="form-row">
                  <label className="form-field date-time-field">
                    <span className="form-label">Start date</span>
                    <input
                      className="form-input"
                      defaultValue={startDateValue}
                      id="cf-start-date"
                      type="date"
                    />
                  </label>
                  <label className="form-field date-time-field">
                    <span className="form-label">End date</span>
                    <input
                      className="form-input"
                      defaultValue={endDateValue}
                      id="cf-end-date"
                      type="date"
                    />
                  </label>
                </div>
                <button
                  aria-pressed={isAllDay}
                  className={
                    isAllDay ? "allday-toggle selected" : "allday-toggle"
                  }
                  id="cf-allday"
                  onClick={(e) => {
                    const btn = e.currentTarget;
                    btn.classList.toggle("selected");
                    btn.setAttribute(
                      "aria-pressed",
                      btn.classList.contains("selected") ? "true" : "false"
                    );
                  }}
                  type="button"
                >
                  <span className="dot" />
                  <span>All-day event</span>
                </button>
                <div className="form-row">
                  <label className="form-field date-time-field">
                    <span className="form-label">Start time</span>
                    <input
                      className="form-input"
                      defaultValue={startTimeValue}
                      id="cf-start-time"
                      type="time"
                    />
                  </label>
                  <label className="form-field date-time-field">
                    <span className="form-label">End time</span>
                    <input
                      className="form-input"
                      defaultValue={endTimeValue}
                      id="cf-end-time"
                      type="time"
                    />
                  </label>
                </div>
                <div className="subteam-picker">
                  <span className="form-label">
                    Subteams - select at least one
                  </span>
                  <div className="subteam-pill-row">
                    {FILTER_CATEGORY_ORDER.map((key) => (
                      <SubteamPill
                        categoryKey={key}
                        includeDataSubteam
                        key={key}
                        selected={editingSubteams.has(key)}
                        toggleOnClick
                      />
                    ))}
                  </div>
                </div>
                <label className="form-field">
                  <span className="form-label">Location</span>
                  <input
                    className="form-input"
                    defaultValue={editingEvent?.location}
                    id="cf-location"
                    placeholder="e.g. Shop Bay 1"
                    type="text"
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Organizer</span>
                  <input
                    className="form-input"
                    defaultValue={editingEvent?.organizer}
                    id="cf-organizer"
                    placeholder="e.g. Alex Chen"
                    type="text"
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Details</span>
                  <textarea
                    className="form-input form-textarea"
                    defaultValue={editingEvent?.info}
                    id="cf-info"
                    placeholder="What's this event about?"
                    rows={3}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="form-field">
                  <span className="form-label">Message</span>
                  <textarea
                    className="form-input form-textarea"
                    id="cf-snippet"
                    placeholder="What should the team know?"
                    rows={4}
                  />
                </label>
                <p className="composer-hint">
                  Posted announcements are timestamped with the moment you
                  publish them.
                </p>
              </>
            )}
          </div>
          <div className="form-actions">
            <button className="secondary-btn" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="primary-btn" onClick={onSubmit} type="button">
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
