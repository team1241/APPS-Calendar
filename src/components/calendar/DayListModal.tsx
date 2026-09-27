"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef } from "react";
import {
  type CalendarEvent,
  eventEndDay,
  eventStartDay,
  formatEventTimeRange,
  getEventBackground,
  getEventColors,
  hexToRgba,
  isMultiDayEvent,
  sameDay,
} from "@/lib/calendar/calendar";
import { ColorSwatch } from "./ColorSwatch";

export function DayListModal({
  dateKeyStr,
  events,
  scrollTop,
  animate,
  onClose,
  onOpenEvent,
}: {
  dateKeyStr: string;
  events: CalendarEvent[];
  scrollTop: number;
  animate: boolean;
  onClose: () => void;
  onOpenEvent: (id: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [y, m, d] = dateKeyStr.split("-").map(Number);
  const date = new Date(y, m, d);
  const dayEvents = events.filter((e) => {
    if (e.allDay || isMultiDayEvent(e)) {
      return eventStartDay(e) <= date && eventEndDay(e) >= date;
    }
    return sameDay(e.start, date);
  });

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop]);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="day-list-modal"
        style={animate ? undefined : { animation: "none" }}
      >
        <div
          className="glow"
          style={{
            background:
              "radial-gradient(ellipse, rgba(255,255,255,0.08) 0%, transparent 70%)",
          }}
        />
        <div className="head">
          <div>
            <span className="t">
              {date.toLocaleDateString("en-US", {
                day: "numeric",
                month: "short",
                weekday: "long",
              })}
            </span>
            <span className="sub">
              {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
            </span>
          </div>
          <button
            aria-label="Close day events"
            className="close-btn"
            onClick={onClose}
            title="Close"
            type="button"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={17} strokeWidth={2} />
          </button>
        </div>
        <div className="list" ref={listRef}>
          {dayEvents.length ? (
            dayEvents.map((e) => {
              const colors = getEventColors(e);
              const glow = `linear-gradient(to right, ${hexToRgba(colors[0], 0.35)} 0%, ${hexToRgba(colors[0], 0)} 12.5%), ${getEventBackground(colors, 0.03)}`;
              return (
                <button
                  className="day-list-item"
                  key={e.id}
                  onClick={() => onOpenEvent(e.id)}
                  style={{ background: glow }}
                  type="button"
                >
                  <ColorSwatch colors={colors} size={8} />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      minWidth: 0,
                    }}
                  >
                    <span className="t">{e.title}</span>
                    <span className="tm">{formatEventTimeRange(e)}</span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="micro-label" style={{ padding: "14px 6px 8px" }}>
              No events on this day
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
