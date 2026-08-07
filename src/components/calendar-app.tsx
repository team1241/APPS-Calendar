"use client";

import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  atTime,
  CATEGORIES,
  type CalendarAnnouncement,
  type CalendarEvent,
  type CategoryKey,
  type ConfirmationDialog,
  isEventVisible,
  normalizeSubteamName,
  stripTime,
  type ViewTransition,
} from "@/lib/calendar/calendar";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AnnouncementsView } from "./calendar/AnnouncementsView";
import { BottomNav } from "./calendar/BottomNav";
import { ComposerModal } from "./calendar/ComposerModal";
import { ConfirmationModal } from "./calendar/ConfirmationModal";
import { DayListModal } from "./calendar/DayListModal";
import { EventModal } from "./calendar/EventModal";
import { MonthView } from "./calendar/MonthView";
import { SignInScreen } from "./calendar/SignInScreen";
import { TopBar } from "./calendar/TopBar";
import { WeekView } from "./calendar/WeekView";

export default function CalendarApp() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();

  const currentUser = useQuery(api.users.currentUser);
  const ensureUser = useMutation(api.users.ensureUser);
  const convexSubteams = useQuery(api.subteams.list);
  const eventTypes = useQuery(api.eventTypes.list);
  const convexAnnouncements = useQuery(api.announcements.list);

  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [view, setView] = useState<"month" | "week" | "announcements">("month");
  const [cursor, setCursor] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventModalOrigin, setEventModalOrigin] = useState<null | "daylist">(
    null
  );
  const [dayListDate, setDayListDate] = useState<string | null>(null);
  const [dayListScrollTop, setDayListScrollTop] = useState(0);
  const [dayListJustOpened, setDayListJustOpened] = useState(false);
  const [mobileWeekOffset, setMobileWeekOffset] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<"event" | "announcement">(
    "event"
  );
  const [composerError, setComposerError] = useState<string | null>(null);
  const [subteamFilter, setSubteamFilter] = useState<Set<CategoryKey>>(
    new Set(Object.keys(CATEGORIES) as CategoryKey[])
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersJustOpened, setFiltersJustOpened] = useState(false);
  const [swipeEnter, setSwipeEnter] = useState<
    null | "from-left" | "from-right"
  >(null);
  const [viewTransition, setViewTransition] = useState<ViewTransition>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationDialog | null>(
    null
  );

  const today = useMemo(() => stripTime(new Date()), []);

  useEffect(() => {
    if (isSignedIn) {
      ensureUser();
    }
  }, [isSignedIn, ensureUser]);

  const eventQueryRange = useMemo(() => {
    let start: Date;
    let end: Date;
    if (view === "month") {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      start = addDays(first, -first.getDay());
      end = addDays(start, 41);
    } else {
      start = addDays(today, -14);
      end = addDays(today, 21);
    }
    return { end: end.getTime(), start: start.getTime() };
  }, [view, cursor, today]);

  const convexEvents = useQuery(api.events.listByRange, eventQueryRange);

  const subteamIdToKey = useMemo(() => {
    const map = new Map<Id<"subteams">, CategoryKey>();
    if (convexSubteams) {
      for (const st of convexSubteams) {
        const key = normalizeSubteamName(st.subteamName);
        if (key) {
          map.set(st._id, key);
        }
      }
    }
    return map;
  }, [convexSubteams]);

  const keyToSubteamId = useMemo(() => {
    const map = new Map<CategoryKey, Id<"subteams">>();
    if (convexSubteams) {
      for (const st of convexSubteams) {
        const key = normalizeSubteamName(st.subteamName);
        if (key && !map.has(key)) {
          map.set(key, st._id);
        }
      }
    }
    return map;
  }, [convexSubteams]);

  const defaultEventTypeId = useMemo(() => {
    if (!eventTypes || eventTypes.length === 0) {
      return null;
    }
    const standard = eventTypes.find((et) =>
      et.name.toLowerCase().includes("standard")
    );
    return standard?._id ?? eventTypes[0]._id;
  }, [eventTypes]);

  const events = useMemo<CalendarEvent[]>(() => {
    if (!convexEvents) {
      return [];
    }
    return convexEvents.map((e) => {
      const subteams = e.subteams
        .map((id) => subteamIdToKey.get(id))
        .filter(Boolean) as CategoryKey[];
      return {
        allDay: e.allDay,
        createdAt: new Date(e.updatedAt),
        end: new Date(e.endTime),
        id: e._id,
        info: e.info ?? undefined,
        location: e.location,
        organizer: e.organizer,
        start: new Date(e.startTime),
        subteams,
        title: e.title,
      };
    });
  }, [convexEvents, subteamIdToKey]);

  const visibleEvents = useMemo(
    () => events.filter((event) => isEventVisible(event, subteamFilter)),
    [events, subteamFilter]
  );

  const announcements = useMemo<CalendarAnnouncement[]>(() => {
    if (!convexAnnouncements) {
      return [];
    }
    return convexAnnouncements.map((a) => ({
      date: new Date(a.updatedAt),
      id: a._id,
      snippet: a.snippet,
      title: a.title,
    }));
  }, [convexAnnouncements]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) {
      return null;
    }
    return (
      events.find((e) => e.id === selectedEventId) ??
      announcements.find((a) => a.id === selectedEventId) ??
      null
    );
  }, [selectedEventId, events, announcements]);

  const createEventMutation = useMutation(api.events.create);
  const createAnnouncementMutation = useMutation(api.announcements.create);
  const removeEventMutation = useMutation(api.events.remove);
  const removeAnnouncementMutation = useMutation(api.announcements.remove);

  const handleSetView = useCallback(
    (v: "month" | "week" | "announcements") => {
      const viewOrder = { announcements: 2, month: 0, week: 1 } as const;
      if (v !== view) {
        setViewTransition(
          viewOrder[v] > viewOrder[view] ? "from-right" : "from-left"
        );
      }
      setView(v);
      if (v === "week") {
        setMobileWeekOffset(0);
      }
      setDayListDate(null);
      setDayListScrollTop(0);
      setSelectedEventId(null);
      setEventModalOrigin(null);
    },
    [view]
  );

  const handleOpenEvent = useCallback((id: string) => {
    setSelectedEventId(id);
    setEventModalOrigin(null);
  }, []);
  const handleOpenEventFromList = useCallback((id: string) => {
    setSelectedEventId(id);
    setEventModalOrigin("daylist");
  }, []);
  const handleCloseModal = useCallback(() => {
    setSelectedEventId(null);
    setEventModalOrigin(null);
    setDayListDate(null);
    setDayListScrollTop(0);
  }, []);
  const handleBackToDayList = useCallback(() => {
    setSelectedEventId(null);
    setEventModalOrigin(null);
  }, []);
  const handleOpenDayList = useCallback((dateKeyStr: string) => {
    setDayListDate(dateKeyStr);
    setDayListScrollTop(0);
    setDayListJustOpened(true);
  }, []);
  const handleCloseDayList = useCallback(() => {
    setDayListDate(null);
    setDayListScrollTop(0);
  }, []);
  const handleOpenComposer = useCallback(() => {
    if (!currentUser?.isAdmin) {
      return;
    }
    setComposerMode("event");
    setComposerError(null);
    setComposerOpen(true);
  }, [currentUser?.isAdmin]);
  const handleCloseComposer = useCallback(() => {
    setComposerOpen(false);
    setComposerError(null);
  }, []);
  const handleComposerTab = useCallback((m: "event" | "announcement") => {
    setComposerMode(m);
    setComposerError(null);
  }, []);

  const handleRequestDelete = useCallback(
    (event: CalendarEvent | CalendarAnnouncement) => {
      const isAnnouncement = "snippet" in event;
      setConfirmation({
        action: async () => {
          if (isAnnouncement) {
            await removeAnnouncementMutation({
              announcementId: event.id as Id<"announcements">,
            });
          } else {
            await removeEventMutation({ eventId: event.id as Id<"events"> });
          }
          handleCloseModal();
        },
        confirmLabel: "Delete",
        isDestructive: true,
        message: `Delete this ${isAnnouncement ? "announcement" : "event"}?`,
      });
    },
    [handleCloseModal, removeAnnouncementMutation, removeEventMutation]
  );

  const handleToggleSubteamFilter = useCallback((key: CategoryKey) => {
    setSubteamFilter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleToggleFilters = useCallback(() => {
    setFiltersOpen((open) => {
      const next = !open;
      setFiltersJustOpened(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!filtersOpen) {
      return;
    }

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (
        target.closest("#subteam-filter-popover") ||
        target.closest(".filter-btn")
      ) {
        return;
      }
      setFiltersOpen(false);
      setFiltersJustOpened(false);
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () =>
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [filtersOpen]);

  const handlePrevMonth = useCallback(() => {
    setCursor(
      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
    );
    setSwipeEnter("from-left");
  }, []);

  const handleNextMonth = useCallback(() => {
    setCursor(
      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
    );
    setSwipeEnter("from-right");
  }, []);

  const handleToday = useCallback(() => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  }, [today]);

  const handleWeekPrev = useCallback(() => {
    setMobileWeekOffset((offset) => offset - 1);
    setSwipeEnter("from-left");
  }, []);

  const handleWeekNext = useCallback(() => {
    setMobileWeekOffset((offset) => offset + 1);
    setSwipeEnter("from-right");
  }, []);

  const handleSubmitComposer = useCallback(async () => {
    const titleEl = document.getElementById(
      "cf-title"
    ) as HTMLInputElement | null;
    const title = (titleEl?.value || "").trim();
    if (!title) {
      setComposerError("Please enter a title.");
      return;
    }

    if (composerMode === "event") {
      const selectedPills = Array.from(
        document.querySelectorAll(".subteam-pill.selected")
      ).map((btn) => (btn as HTMLElement).dataset.subteam as CategoryKey);
      if (!selectedPills.length) {
        setComposerError("Please select at least one subteam.");
        return;
      }

      const startDateStr = (
        document.getElementById("cf-start-date") as HTMLInputElement
      )?.value;
      const endDateStr =
        (document.getElementById("cf-end-date") as HTMLInputElement)?.value ||
        startDateStr;
      if (!(startDateStr && endDateStr)) {
        setComposerError("Please choose a start and end date.");
        return;
      }

      const [sy, smo, sd] = startDateStr.split("-").map(Number);
      const [ey, emo, ed] = endDateStr.split("-").map(Number);
      const startDateObj = new Date(sy, smo - 1, sd);
      const endDateObj = new Date(ey, emo - 1, ed);
      if (endDateObj < startDateObj) {
        setComposerError("End date can't be before the start date.");
        return;
      }

      const allDayToggle = document.getElementById("cf-allday");
      const allDay = allDayToggle?.classList.contains("selected") ?? false;

      let start: Date;
      let end: Date;
      if (allDay) {
        start = stripTime(startDateObj);
        end = stripTime(endDateObj);
      } else {
        const startTimeStr =
          (document.getElementById("cf-start-time") as HTMLInputElement)
            ?.value || "09:00";
        const endTimeStr =
          (document.getElementById("cf-end-time") as HTMLInputElement)?.value ||
          "10:00";
        const [sh, smin] = startTimeStr.split(":").map(Number);
        const [eh, emin] = endTimeStr.split(":").map(Number);
        start = atTime(startDateObj, sh, smin);
        end = atTime(endDateObj, eh, emin);
        if (end <= start) {
          setComposerError("End time must be after the start time.");
          return;
        }
      }

      const location = (
        (document.getElementById("cf-location") as HTMLInputElement)?.value ||
        ""
      ).trim();
      const organizer = (
        (document.getElementById("cf-organizer") as HTMLInputElement)?.value ||
        ""
      ).trim();
      const info = (
        (document.getElementById("cf-info") as HTMLTextAreaElement)?.value || ""
      ).trim();
      const subteamIds = selectedPills
        .map((key) => keyToSubteamId.get(key))
        .filter(Boolean) as Id<"subteams">[];

      if (!defaultEventTypeId) {
        setComposerError("Event types not loaded yet. Please try again.");
        return;
      }

      try {
        await createEventMutation({
          allDay,
          endTime: end.getTime(),
          eventTypeId: defaultEventTypeId,
          info: info || undefined,
          location: location || "",
          organizer: organizer || "",
          startTime: start.getTime(),
          subteams: subteamIds,
          title,
        });
        setCursor(new Date(start.getFullYear(), start.getMonth(), 1));
        setComposerOpen(false);
        setComposerError(null);
      } catch (err) {
        setComposerError(
          err instanceof Error ? err.message : "Failed to create event"
        );
      }
    } else {
      const snippet = (
        (document.getElementById("cf-snippet") as HTMLTextAreaElement)?.value ||
        ""
      ).trim();
      if (!snippet) {
        setComposerError("Please add a message for the announcement.");
        return;
      }
      try {
        await createAnnouncementMutation({ snippet, title });
        setComposerOpen(false);
        setComposerError(null);
      } catch (err) {
        setComposerError(
          err instanceof Error ? err.message : "Failed to post announcement"
        );
      }
    }
  }, [
    composerMode,
    keyToSubteamId,
    defaultEventTypeId,
    createEventMutation,
    createAnnouncementMutation,
  ]);

  const handleSignOut = useCallback(() => {
    setConfirmation({
      action: async () => {
        await clerk.signOut();
      },
      confirmLabel: "Sign out",
      message: "Sign out of your account?",
    });
  }, [clerk]);

  useEffect(() => {
    if (swipeEnter) {
      const timer = setTimeout(() => setSwipeEnter(null), 300);
      return () => clearTimeout(timer);
    }
  }, [swipeEnter]);
  useEffect(() => {
    if (viewTransition) {
      const timer = setTimeout(() => setViewTransition(null), 340);
      return () => clearTimeout(timer);
    }
  }, [viewTransition]);
  useEffect(() => {
    if (filtersJustOpened) {
      const timer = setTimeout(() => setFiltersJustOpened(false), 200);
      return () => clearTimeout(timer);
    }
  }, [filtersJustOpened]);
  useEffect(() => {
    if (dayListJustOpened) {
      const timer = setTimeout(() => setDayListJustOpened(false), 200);
      return () => clearTimeout(timer);
    }
  }, [dayListJustOpened]);

  if (!isLoaded) {
    return (
      <div
        id="app"
        style={{
          alignItems: "center",
          display: "flex",
          height: "100vh",
          justifyContent: "center",
        }}
      >
        <div className="micro-label">Loading...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div id="app">
        <div className="backdrop">
          <div className="dots" />
        </div>
        <div className="content">
          <SignInScreen
            authMode={authMode}
            onToggleMode={() =>
              setAuthMode((m) => (m === "signin" ? "signup" : "signin"))
            }
          />
        </div>
      </div>
    );
  }

  const userName = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`.trim() || "User"
    : user?.fullName || "User";
  const isAdmin = currentUser?.isAdmin ?? false;

  return (
    <div id="app">
      <div className="backdrop">
        <div className="grad" />
        <div className="blob1" />
        <div className="blob2" />
        <div className="dots" />
      </div>
      <div className="content">
        <div className="top-glow" />
        <TopBar
          events={events}
          filtersJustOpened={filtersJustOpened}
          filtersOpen={filtersOpen}
          isAdmin={isAdmin}
          onOpenComposer={handleOpenComposer}
          onOpenEvent={handleOpenEvent}
          onSignOut={handleSignOut}
          onToggleFilters={handleToggleFilters}
          onToggleSubteam={handleToggleSubteamFilter}
          subteamFilter={subteamFilter}
          userName={userName}
        />
        {view === "month" && (
          <MonthView
            cursor={cursor}
            events={visibleEvents}
            onNextMonth={handleNextMonth}
            onOpenDayList={handleOpenDayList}
            onOpenEvent={handleOpenEvent}
            onPrevMonth={handlePrevMonth}
            onToday={handleToday}
            swipeEnter={swipeEnter}
            today={today}
            viewTransition={viewTransition}
          />
        )}
        {view === "week" && (
          <WeekView
            events={visibleEvents}
            mobileWeekOffset={mobileWeekOffset}
            onOpenEvent={handleOpenEvent}
            onWeekNext={handleWeekNext}
            onWeekPrev={handleWeekPrev}
            swipeEnter={swipeEnter}
            today={today}
            viewTransition={viewTransition}
          />
        )}
        {view === "announcements" && (
          <AnnouncementsView
            announcements={announcements}
            onOpenAnnouncement={handleOpenEvent}
            viewTransition={viewTransition}
          />
        )}
        <BottomNav onSetView={handleSetView} view={view} />
        {dayListDate && (
          <DayListModal
            animate={dayListJustOpened}
            dateKeyStr={dayListDate}
            events={events}
            onClose={handleCloseDayList}
            onOpenEvent={handleOpenEventFromList}
            scrollTop={dayListScrollTop}
          />
        )}
        {selectedEvent && (
          <EventModal
            cameFromDayList={eventModalOrigin === "daylist"}
            event={selectedEvent}
            isAdmin={isAdmin}
            onBackToDayList={handleBackToDayList}
            onClose={handleCloseModal}
            onRequestDelete={handleRequestDelete}
          />
        )}
        {composerOpen && (
          <ComposerModal
            error={composerError}
            mode={composerMode}
            onClose={handleCloseComposer}
            onSubmit={handleSubmitComposer}
            onSwitchMode={handleComposerTab}
          />
        )}
        {confirmation && (
          <ConfirmationModal
            confirmation={confirmation}
            onClose={() => setConfirmation(null)}
          />
        )}
      </div>
    </div>
  );
}
