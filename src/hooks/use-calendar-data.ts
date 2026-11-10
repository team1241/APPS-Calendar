"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  type CategoryKey,
  isEventVisible,
} from "@/lib/calendar/calendar";
import {
  toCalendarAnnouncements,
  toCalendarEvents,
} from "@/lib/calendar/convex-mappers";
import { createSubteamMaps } from "@/lib/calendar/subteam-maps";
import { api } from "../../convex/_generated/api";

export function useCalendarData({
  cursor,
  subteamFilter,
  today,
  view,
}: {
  cursor: Date;
  subteamFilter: Set<CategoryKey>;
  today: Date;
  view: "month" | "week" | "announcements";
}) {
  const { isAuthenticated } = useConvexAuth();
  const [userSyncError, setUserSyncError] = useState<string | null>(null);
  const currentUser = useQuery(api.users.currentUser);
  const ensureUser = useMutation(api.users.ensureUser);
  const convexSubteams = useQuery(api.subteams.list);
  const eventTypes = useQuery(api.eventTypes.list);
  const convexAnnouncements = useQuery(api.announcements.list);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;
    const syncUser = async () => {
      try {
        await ensureUser();
        if (!cancelled) {
          setUserSyncError(null);
        }
      } catch {
        if (!cancelled) {
          setUserSyncError(
            "Unable to load your account. Please reload the page to try again."
          );
        }
      }
    };
    syncUser();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, ensureUser]);

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
  const events = useMemo(
    () => toCalendarEvents(convexEvents, subteamIdToKey),
    [convexEvents, subteamIdToKey]
  );
  const visibleEvents = useMemo(
    () => events.filter((event) => isEventVisible(event, subteamFilter)),
    [events, subteamFilter]
  );
  const announcements = useMemo(
    () => toCalendarAnnouncements(convexAnnouncements),
    [convexAnnouncements]
  );

  return {
    announcements,
    currentUser,
    defaultEventTypeId,
    events,
    keyToSubteamId,
    userSyncError: isAuthenticated ? userSyncError : null,
    visibleEvents,
  };
}
