"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
import {
  addDays,
  type CalendarAnnouncement,
  type CalendarEvent,
  type CategoryKey,
  isEventVisible,
} from "@/lib/calendar/calendar";
import { createSubteamMaps } from "@/lib/calendar/subteam-maps";
import { api } from "../../convex/_generated/api";

export function useCalendarData({
  cursor,
  isSignedIn,
  subteamFilter,
  today,
  view,
}: {
  cursor: Date;
  isSignedIn: boolean | undefined;
  subteamFilter: Set<CategoryKey>;
  today: Date;
  view: "month" | "week" | "announcements";
}) {
  const currentUser = useQuery(api.users.currentUser);
  const ensureUser = useMutation(api.users.ensureUser);
  const convexSubteams = useQuery(api.subteams.list);
  const eventTypes = useQuery(api.eventTypes.list);
  const convexAnnouncements = useQuery(api.announcements.list);

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
  const { keyToSubteamId, subteamIdToKey } = useMemo(
    () => createSubteamMaps(convexSubteams),
    [convexSubteams]
  );
  const defaultEventTypeId = useMemo(() => {
    if (!eventTypes || eventTypes.length === 0) {
      return null;
    }
    const standard = eventTypes.find((eventType: { name: string }) =>
      eventType.name.toLowerCase().includes("standard")
    );
    return standard?._id ?? eventTypes[0]._id;
  }, [eventTypes]);
  const events = useMemo<CalendarEvent[]>(() => {
    if (!convexEvents) {
      return [];
    }
    return convexEvents.map(
      (event: {
        _id: string;
        allDay: boolean;
        endTime: number;
        info?: string;
        location: string;
        organizer: string;
        startTime: number;
        subteams: string[];
        title: string;
        updatedAt: number;
      }) => ({
        allDay: event.allDay,
        createdAt: new Date(event.updatedAt),
        end: new Date(event.endTime),
        id: event._id,
        info: event.info ?? undefined,
        location: event.location,
        organizer: event.organizer,
        start: new Date(event.startTime),
        subteams: event.subteams
          .map((id: string) => subteamIdToKey.get(id as never))
          .filter(Boolean) as CategoryKey[],
        title: event.title,
      })
    );
  }, [convexEvents, subteamIdToKey]);
  const visibleEvents = useMemo(
    () => events.filter((event) => isEventVisible(event, subteamFilter)),
    [events, subteamFilter]
  );
  const announcements = useMemo<CalendarAnnouncement[]>(() => {
    if (!convexAnnouncements) {
      return [];
    }
    return convexAnnouncements.map(
      (announcement: {
        _id: string;
        snippet: string;
        title: string;
        updatedAt: number;
      }) => ({
        date: new Date(announcement.updatedAt),
        id: announcement._id,
        snippet: announcement.snippet,
        title: announcement.title,
      })
    );
  }, [convexAnnouncements]);

  return {
    announcements,
    currentUser,
    defaultEventTypeId,
    events,
    keyToSubteamId,
    visibleEvents,
  };
}
