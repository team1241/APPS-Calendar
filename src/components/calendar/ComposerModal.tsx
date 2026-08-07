"use client";
import type React from "react";
import { useLayoutEffect, useRef } from "react";
import {
  CATEGORIES,
  type CategoryKey,
  esc,
  hexToRgba,
  positionPillIndicator,
  toDateInputValue,
} from "@/lib/calendar/calendar";
import { IconX } from "./IconX";

export function ComposerModal({
  mode,
  error,
  onClose,
  onSwitchMode,
  onSubmit,
}: {
  mode: "event" | "announcement";
  error: string | null;
  onClose: () => void;
  onSwitchMode: (m: "event" | "announcement") => void;
  onSubmit: () => void;
}) {
  const todayStr = toDateInputValue(new Date());
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
              "radial-gradient(ellipse, rgba(250,250,248,0.10) 0%, transparent 70%)",
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
            </div>
            <button
              aria-label="Close"
              className="close-btn"
              onClick={onClose}
              title="Close"
              type="button"
            >
              <IconX />
            </button>
          </div>
          <h2>{mode === "event" ? "New event" : "New announcement"}</h2>
          {error && <div className="composer-error">{error}</div>}
          <div className="composer-form">
            <label className="form-field">
              <span className="form-label">Title</span>
              <input
                className="form-input"
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
                      defaultValue={todayStr}
                      id="cf-start-date"
                      type="date"
                    />
                  </label>
                  <label className="form-field date-time-field">
                    <span className="form-label">End date</span>
                    <input
                      className="form-input"
                      defaultValue={todayStr}
                      id="cf-end-date"
                      type="date"
                    />
                  </label>
                </div>
                <button
                  aria-pressed="false"
                  className="allday-toggle"
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
                      defaultValue="09:00"
                      id="cf-start-time"
                      type="time"
                    />
                  </label>
                  <label className="form-field date-time-field">
                    <span className="form-label">End time</span>
                    <input
                      className="form-input"
                      defaultValue="10:00"
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
                    {(
                      Object.entries(CATEGORIES) as [
                        CategoryKey,
                        { label: string; color: string },
                      ][]
                    ).map(([key, c]) => (
                      <button
                        className="subteam-pill"
                        data-subteam={key}
                        key={key}
                        onClick={(e) => {
                          const pill = e.currentTarget;
                          pill.classList.toggle("selected");
                          pill.setAttribute(
                            "aria-pressed",
                            pill.classList.contains("selected")
                              ? "true"
                              : "false"
                          );
                        }}
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
                    ))}
                  </div>
                </div>
                <label className="form-field">
                  <span className="form-label">Location</span>
                  <input
                    className="form-input"
                    id="cf-location"
                    placeholder="e.g. Shop Bay 1"
                    type="text"
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Organizer</span>
                  <input
                    className="form-input"
                    id="cf-organizer"
                    placeholder="e.g. Alex Chen"
                    type="text"
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Details</span>
                  <textarea
                    className="form-input form-textarea"
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
              {mode === "event" ? "Create event" : "Post announcement"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
