"use client";

import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type CalendarAnnouncement,
  type CalendarEvent,
  type ConfirmationDialog,
  stripTime,
  type ViewTransition,
} from "@/lib/calendar/calendar";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useCalendarData } from "../hooks/use-calendar-data";
import { useComposerSubmit } from "../hooks/use-composer-submit";
import { useSubteamFilter } from "../hooks/use-subteam-filter";
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
  const [swipeEnter, setSwipeEnter] = useState<
    null | "from-left" | "from-right"
  >(null);
  const [viewTransition, setViewTransition] = useState<ViewTransition>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationDialog | null>(
    null
  );
  const {
    filtersJustOpened,
    filtersOpen,
    handleToggleFilters,
    handleToggleSubteamFilter,
    subteamFilter,
  } = useSubteamFilter();

  const today = useMemo(() => stripTime(new Date()), []);

  const {
    announcements,
    currentUser,
    defaultEventTypeId,
    events,
    keyToSubteamId,
    visibleEvents,
  } = useCalendarData({ cursor, isSignedIn, subteamFilter, today, view });

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

  const handleSubmitComposer = useComposerSubmit({
    defaultEventTypeId,
    keyToSubteamId,
    mode: composerMode,
    setComposerError,
    setComposerOpen,
    setCursor,
  });

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
