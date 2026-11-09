"use client";
import { ChevronLeftIcon, ChevronRightIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type React from "react";
import { useCallback, useMemo } from "react";
import {
  addDays,
  buildMultiDaySegments,
  type CalendarEvent,
  compareCalendarEvents,
  DAY_END,
  DAY_START,
  dateKey,
  eventEndDay,
  fmtHourLabel,
  fmtTime,
  fmtWeekday,
  getEventBorderStyle,
  getEventColors,
  HOUR_HEIGHT,
  isMultiDayEvent,
  layoutTimedEvents,
  type MultiDaySegment,
  sameDay,
  stripTime,
  type ViewTransition,
  WEEK_HEADER_HEIGHT,
} from "@/lib/calendar/calendar";
import { ColorSwatch } from "./ColorSwatch";

const EVENT_CHROME_PX = 36;
const TITLE_LINE_PX = 19;

/** @brief How many title lines fit above the time line in an event box of this duration. */
const getTitleLines = (durationHours: number): number =>
  Math.max(
    1,
    Math.floor((durationHours * HOUR_HEIGHT - EVENT_CHROME_PX) / TITLE_LINE_PX)
  );

export function WeekView({
  events,
  today,
  mobileWeekOffset,
  swipeEnter,
  onOpenEvent,
  onWeekPrev,
  onWeekNext,
  viewTransition,
  onCreateEvent,
}: {
  events: CalendarEvent[];
  today: Date;
  mobileWeekOffset: number;
  swipeEnter: string | null;
  onOpenEvent: (id: string) => void;
  onWeekPrev: () => void;
  onWeekNext: () => void;
  viewTransition: ViewTransition;
  /** Called with the clicked hour's start; omit to make empty slots inert. */
  onCreateEvent?: (start: Date) => void;
}) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 760;
  const EVENT_LANE_H = 29;

  const timedEventsFor = useCallback(
    (date: Date) =>
      events
        .filter(
          (e) => !(e.allDay || isMultiDayEvent(e)) && sameDay(e.start, date)
        )
        .sort(compareCalendarEvents),
    [events]
  );

  const multiDayEvents = useMemo(
    () => events.filter(isMultiDayEvent),
    [events]
  );

  const renderBannerHtml = useCallback(
    (segments: MultiDaySegment[], colOffset: number) =>
      segments.map((seg) => {
        const colors = getEventColors(seg.event);
        const isPastBanner = eventEndDay(seg.event) < today;
        const borderStyle = getEventBorderStyle(
          colors,
          isPastBanner ? { glowAlpha: 0, glowSize: 0 } : undefined
        );
        return (
          <button
            className={[
              "event-pill",
              "week-multi-banner",
              "pill-glow",
              isPastBanner && "is-past-event",
              !seg.isTrueStart && "join-left",
              !seg.isTrueEnd && "join-right",
            ]
              .filter(Boolean)
              .join(" ")}
            key={seg.event.id}
            onClick={() => onOpenEvent(seg.event.id)}
            style={{
              gridColumn: `${seg.colStart + colOffset} / ${seg.colEnd + colOffset + 1}`,
              marginTop: seg.lane * EVENT_LANE_H,
              ...borderStyle,
            }}
            type="button"
          >
            <div
              className={[
                "pill-inner",
                !seg.isTrueStart && "join-left",
                !seg.isTrueEnd && "join-right",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {seg.isTrueStart && (
                <>
                  <ColorSwatch colors={colors} size={6} />
                  <span>{seg.event.title}</span>
                </>
              )}
            </div>
          </button>
        );
      }),
    [today, onOpenEvent]
  );

  const renderTimeGutter = useCallback(() => {
    const labels: React.ReactNode[] = [];
    for (let h = DAY_START; h <= DAY_END; h++) {
      const top = (h - DAY_START) * HOUR_HEIGHT;
      labels.push(
        <span className="hour-label" key={h} style={{ top }}>
          {fmtHourLabel(h)}
        </span>
      );
    }
    return (
      <div className="time-gutter">
        <div className="day-col-head">
          <div className="micro-label">&nbsp;</div>
          <div className="num">&nbsp;</div>
        </div>
        <div
          style={{
            height: (DAY_END - DAY_START) * HOUR_HEIGHT,
            position: "relative",
          }}
        >
          {labels}
        </div>
      </div>
    );
  }, []);

  const renderDayColumn = useCallback(
    (
      date: Date,
      dayEvents: CalendarEvent[],
      opts: { isPrev: boolean; isToday: boolean; big: boolean }
    ) => {
      const layouts = layoutTimedEvents(dayEvents);
      const classes = ["day-col"];
      if (opts.isToday) {
        classes.push("today-col");
      }
      if (opts.big) {
        classes.push("big");
      }
      return (
        <div className={classes.join(" ")} key={dateKey(date)}>
          <div className="day-col-head">
            <div className="micro-label">{fmtWeekday(date)}</div>
            <div
              className={["num", opts.isToday && "today"]
                .filter(Boolean)
                .join(" ")}
            >
              {date.getDate()}
            </div>
          </div>
          <div
            className="day-col-body"
            style={{
              height: (DAY_END - DAY_START) * HOUR_HEIGHT,
              position: "relative",
            }}
          >
            {Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => {
              const hour = DAY_START + i;
              const isLastLine = hour === DAY_END;
              if (!onCreateEvent || isLastLine) {
                return <div className="hour-row" key={hour} />;
              }
              const slotLabel = `New event, ${fmtWeekday(date)} ${date.getDate()} at ${fmtHourLabel(hour)}`;
              return (
                <button
                  aria-label={slotLabel}
                  className="hour-row hour-slot"
                  data-hour={`+ ${fmtHourLabel(hour)}`}
                  key={hour}
                  onClick={() => {
                    const start = new Date(date);
                    start.setHours(hour, 0, 0, 0);
                    onCreateEvent(start);
                  }}
                  title={slotLabel}
                  type="button"
                />
              );
            })}
            {layouts.map((layout) => {
              const colors = getEventColors(layout.event);
              const isPast =
                opts.isPrev || (opts.isToday && layout.event.end < new Date());
              const borderStyle = getEventBorderStyle(
                colors,
                isPast ? { glowAlpha: 0, glowSize: 0 } : undefined
              );
              const timeRange = `${fmtTime(layout.event.start)} - ${fmtTime(layout.event.end)}`;
              return (
                <button
                  className={[
                    "week-event",
                    layout.compact && "is-compact",
                    isPast && "is-past-event",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={layout.event.id}
                  onClick={() => onOpenEvent(layout.event.id)}
                  style={
                    {
                      "--event-duration": layout.durationHours,
                      "--event-start": layout.startHours,
                      "--title-lines": getTitleLines(layout.durationHours),
                      left: `${layout.leftPercent}%`,
                      opacity: isPast ? 0.55 : 1,
                      width: `${layout.widthPercent}%`,
                      zIndex: layout.zIndex,
                      ...borderStyle,
                    } as React.CSSProperties
                  }
                  title={`${layout.event.title}\n${timeRange}`}
                  type="button"
                >
                  <div className="week-event-inner">
                    <div className="t">
                      {layout.compact
                        ? `${layout.event.title}, `
                        : layout.event.title}
                      {layout.compact && (
                        <span className="tm-inline">
                          {fmtTime(layout.event.start)}
                        </span>
                      )}
                    </div>
                    {!layout.compact && <div className="tm">{timeRange}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    },
    [onCreateEvent, onOpenEvent]
  );

  if (isMobile) {
    const date = addDays(today, mobileWeekOffset);
    const segments = buildMultiDaySegments(multiDayEvents, date, date, events);
    let mobileWeekClassName = "mobile-week-wrap";
    if (swipeEnter) {
      mobileWeekClassName += ` swipe-enter-${swipeEnter}`;
    }
    return (
      <div
        aria-label="Day calendar. Swipe left or right to change day."
        className={mobileWeekClassName}
        data-swipe-surface="week"
      >
        <div className="mobile-week-nav">
          <button
            aria-label="Previous day"
            className="nav-arrow"
            onClick={onWeekPrev}
            type="button"
          >
            <HugeiconsIcon icon={ChevronLeftIcon} size={15} strokeWidth={2} />
          </button>
          <div className="mobile-week-date">
            {date.toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              weekday: "long",
            })}
          </div>
          <button
            aria-label="Next day"
            className="nav-arrow"
            onClick={onWeekNext}
            type="button"
          >
            <HugeiconsIcon icon={ChevronRightIcon} size={15} strokeWidth={2} />
          </button>
        </div>
        <div className="mobile-week-shell">
          {segments.laneCount > 0 && (
            <div
              className="week-multi-row"
              style={{
                gap: 6,
                gridTemplateColumns: "38px minmax(0, 1fr)",
                height: segments.laneCount * EVENT_LANE_H,
              }}
            >
              <span className="week-multi-label">ALL-DAY</span>
              {renderBannerHtml(segments.segments, 2)}
            </div>
          )}
          <div
            className="mobile-week-grid"
            style={
              {
                "--week-header-height": `${WEEK_HEADER_HEIGHT}px`,
                "--week-hour-height": `${HOUR_HEIGHT}px`,
                display: "grid",
                gap: 6,
                gridTemplateColumns: "38px minmax(0, 1fr)",
              } as React.CSSProperties
            }
          >
            {renderTimeGutter()}
            {renderDayColumn(date, timedEventsFor(date), {
              big: false,
              isPrev: mobileWeekOffset < 0,
              isToday: mobileWeekOffset === 0,
            })}
          </div>
        </div>
      </div>
    );
  }

  const firstWindowDay = addDays(today, mobileWeekOffset - 1);
  const windowDays = Array.from({ length: 5 }, (_, index) =>
    addDays(firstWindowDay, index)
  );
  const lastWindowDay = addDays(firstWindowDay, 4);
  const segments = buildMultiDaySegments(
    multiDayEvents,
    firstWindowDay,
    lastWindowDay,
    events
  );
  const rangeLabel = `${firstWindowDay.toLocaleDateString("en-US", { day: "numeric", month: "short" })} - ${lastWindowDay.toLocaleDateString("en-US", { day: "numeric", month: "short" })}`;
  let weekClassName = "week-wrap view-slide";
  if (swipeEnter) {
    weekClassName += ` swipe-enter-${swipeEnter}`;
  } else if (viewTransition) {
    weekClassName += ` view-transition-${viewTransition}`;
  }

  return (
    <div
      aria-label={`Week calendar, ${rangeLabel}. Swipe left or right to change week.`}
      className={weekClassName}
      data-swipe-surface="week"
    >
      {segments.laneCount > 0 && (
        <div
          className="week-multi-row"
          style={{ height: segments.laneCount * EVENT_LANE_H }}
        >
          <span className="week-multi-label">ALL-DAY</span>
          {renderBannerHtml(segments.segments, 2)}
        </div>
      )}
      <div
        className="week-row"
        style={
          {
            "--week-header-height": `${WEEK_HEADER_HEIGHT}px`,
            "--week-hour-height": `${HOUR_HEIGHT}px`,
          } as React.CSSProperties
        }
      >
        {renderTimeGutter()}
        {windowDays.map((date) =>
          renderDayColumn(date, timedEventsFor(date), {
            big: sameDay(date, today),
            isPrev: stripTime(date) < today,
            isToday: sameDay(date, today),
          })
        )}
      </div>
    </div>
  );
}
