"use client";

import { useMemo } from "react";
import {
  addDays,
  buildMultiDaySegments,
  type CalendarEvent,
  compareCalendarEvents,
  dateKey,
  eventEndDay,
  eventStartDay,
  fmtMonthYear,
  getEventBorderStyle,
  getEventColors,
  getMonthMatrix,
  isMultiDayEvent,
  sameDay,
  type ViewTransition,
} from "@/lib/calendar/calendar";
import { ColorSwatch } from "./ColorSwatch";
import { IconChevronLeft } from "./IconChevronLeft";
import { IconChevronRight } from "./IconChevronRight";

export function MonthView({
  cursor,
  events,
  today,
  swipeEnter,
  onOpenEvent,
  onOpenDayList,
  onPrevMonth,
  onNextMonth,
  onToday,
  viewTransition,
}: {
  cursor: Date;
  events: CalendarEvent[];
  today: Date;
  swipeEnter: string | null;
  onOpenEvent: (id: string) => void;
  onOpenDayList: (dateKey: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  viewTransition: ViewTransition;
}) {
  const weeks = useMemo(
    () => getMonthMatrix(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );
  const isCompactMonth =
    typeof window !== "undefined" && window.innerWidth <= 600;
  const isTabletMonth =
    typeof window !== "undefined" && window.innerWidth <= 960;
  const isViewingCurrentMonth =
    cursor.getFullYear() === today.getFullYear() &&
    cursor.getMonth() === today.getMonth();
  const MAX_VISIBLE = isCompactMonth ? 2 : 3;
  const BANNER_TOP = isCompactMonth ? 27 : 36;
  let BANNER_LANE_H = 23;
  if (isCompactMonth) {
    BANNER_LANE_H = 7;
  } else if (isTabletMonth) {
    BANNER_LANE_H = 20;
  }
  const weekdayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const { map, multiDayEvents } = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of events) {
      if (event.allDay || isMultiDayEvent(event)) {
        let day = eventStartDay(event);
        const end = eventEndDay(event);
        while (day <= end) {
          const key = dateKey(day);
          if (!map[key]) {
            map[key] = [];
          }
          map[key].push(event);
          day = addDays(day, 1);
        }
      } else {
        const key = dateKey(event.start);
        if (!map[key]) {
          map[key] = [];
        }
        map[key].push(event);
      }
    }
    for (const list of Object.values(map)) {
      list.sort(compareCalendarEvents);
    }
    return { map, multiDayEvents: events.filter(isMultiDayEvent) };
  }, [events]);

  const rowBanners = useMemo(
    () =>
      weeks.map((rowDates) => {
        const [rowStart, , , , , , rowEnd] = rowDates;
        return buildMultiDaySegments(multiDayEvents, rowStart, rowEnd, events);
      }),
    [weeks, multiDayEvents, events]
  );

  return (
    <div
      className={[
        "month-wrap",
        "view-slide",
        viewTransition && `view-transition-${viewTransition}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="month-header">
        <h1>{fmtMonthYear(cursor)}</h1>
        <div className="month-nav">
          <button
            aria-label="Previous month"
            className="nav-arrow"
            onClick={onPrevMonth}
            type="button"
          >
            <IconChevronLeft />
          </button>
          <button className="today-btn" onClick={onToday} type="button">
            Today
          </button>
          <button
            aria-label="Next month"
            className="nav-arrow"
            onClick={onNextMonth}
            type="button"
          >
            <IconChevronRight />
          </button>
        </div>
      </div>
      <div
        aria-label="Month calendar. Swipe left or right to change month."
        className={["month-grid", swipeEnter && `swipe-enter-${swipeEnter}`]
          .filter(Boolean)
          .join(" ")}
        data-swipe-surface="month"
      >
        <div className="month-grid-header">
          {weekdayLabels.map((w) => (
            <div className="weekday-cell" key={w}>
              <div className="micro-label">{w}</div>
            </div>
          ))}
        </div>
        {weeks.map((rowDates, r) => {
          const laneCount = rowBanners[r].laneCount;
          const colOccupiedLanes = rowBanners[r].colOccupiedLanes;
          const isLastRow = r === weeks.length - 1;
          return (
            <div className="month-row" key={r}>
              <div className="month-row-grid">
                {rowDates.map((date, col) => {
                  const k = dateKey(date);
                  const isCurrentMonth = date.getMonth() === cursor.getMonth();
                  const isToday = sameDay(date, today);
                  const dayEvents = (map[k] || []).filter(
                    (e) => !isMultiDayEvent(e)
                  );
                  const occupiedLanes = new Set(colOccupiedLanes[col]);
                  const availableLanes = Array.from(
                    { length: MAX_VISIBLE },
                    (_, lane) => lane
                  ).filter((lane) => !occupiedLanes.has(lane));
                  const visible = dayEvents
                    .slice(0, availableLanes.length)
                    .map((event, index) => ({
                      event,
                      lane: availableLanes[index],
                    }));
                  const hiddenMultiDayCount = colOccupiedLanes[col].filter(
                    (lane) => lane >= MAX_VISIBLE
                  ).length;
                  const overflow =
                    hiddenMultiDayCount + dayEvents.length - visible.length;
                  const classes = ["day-cell"];
                  if (!isCurrentMonth) {
                    classes.push("other-month");
                  }
                  if (col === 6) {
                    classes.push("col-last");
                  }
                  if (isLastRow) {
                    classes.push("row-last");
                  }
                  if (isToday) {
                    classes.push("today-cell");
                  }
                  return (
                    <div className={classes.join(" ")} key={col}>
                      <div className="day-num-row">
                        <button
                          className={[
                            "day-num",
                            "day-num-btn",
                            isToday && "today",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => onOpenDayList(k)}
                          type="button"
                        >
                          {date.getDate()}
                        </button>
                        {date.getDate() === 1 && (
                          <span className="month-label">
                            {date.toLocaleDateString("en-US", {
                              month: "short",
                            })}
                          </span>
                        )}
                      </div>
                      <div className="day-events">
                        {visible.map(({ event: e, lane }) => {
                          const colors = getEventColors(e);
                          const isPastDay = date < today;
                          const showStripe = isViewingCurrentMonth && isPastDay;
                          const isMuted = !isViewingCurrentMonth;
                          const borderStyle = getEventBorderStyle(
                            colors,
                            showStripe || isMuted
                              ? { glowAlpha: 0, glowSize: 0 }
                              : undefined
                          );
                          return (
                            <button
                              className={[
                                "event-pill",
                                "pill-glow",
                                showStripe && "is-past-event",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              key={e.id}
                              onClick={() => onOpenEvent(e.id)}
                              style={{
                                gridRow: lane + 1,
                                opacity: isMuted ? 0.45 : undefined,
                                ...borderStyle,
                              }}
                              type="button"
                            >
                              <div className="pill-inner">
                                <ColorSwatch colors={colors} size={6} />
                                <span>{e.title}</span>
                              </div>
                            </button>
                          );
                        })}
                        {overflow > 0 && (
                          <button
                            className="more-btn"
                            onClick={() => onOpenDayList(k)}
                            style={{ gridRow: MAX_VISIBLE + 1 }}
                            type="button"
                          >
                            +{overflow} more{isCompactMonth ? "" : " events"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {laneCount > 0 && (
                <div className="banner-layer">
                  {rowBanners[r].segments
                    .filter((seg) => seg.lane < MAX_VISIBLE)
                    .map((seg) => {
                      const colors = getEventColors(seg.event);
                      const isPastBanner = eventEndDay(seg.event) < today;
                      const showStripe = isViewingCurrentMonth && isPastBanner;
                      const isMuted = !isViewingCurrentMonth;
                      const borderStyle = getEventBorderStyle(
                        colors,
                        showStripe || isMuted
                          ? { glowAlpha: 0, glowSize: 0 }
                          : undefined
                      );
                      return (
                        <button
                          className={[
                            "event-pill",
                            "month-banner",
                            "pill-glow",
                            showStripe && "is-past-event",
                            !seg.isTrueStart && "join-left",
                            !seg.isTrueEnd && "join-right",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          key={seg.event.id}
                          onClick={() => onOpenEvent(seg.event.id)}
                          style={{
                            gridColumn: `${seg.colStart + 1} / ${seg.colEnd + 2}`,
                            marginTop: BANNER_TOP + seg.lane * BANNER_LANE_H,
                            opacity: isMuted ? 0.45 : undefined,
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
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
