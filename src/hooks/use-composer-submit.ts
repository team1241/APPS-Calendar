"use client";

import { useMutation } from "convex/react";
import { useCallback } from "react";
import { atTime, type CategoryKey, stripTime } from "@/lib/calendar/calendar";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function useComposerSubmit({
  defaultEventTypeId,
  keyToSubteamId,
  mode,
  setComposerError,
  setComposerOpen,
  setCursor,
}: {
  defaultEventTypeId: Id<"eventTypes"> | null;
  keyToSubteamId: Map<CategoryKey, Id<"subteams">>;
  mode: "event" | "announcement";
  setComposerError: (value: string | null) => void;
  setComposerOpen: (value: boolean) => void;
  setCursor: (value: Date) => void;
}) {
  const createEventMutation = useMutation(api.events.create);
  const createAnnouncementMutation = useMutation(api.announcements.create);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: preserves the existing DOM-driven submit sequence exactly.
  return useCallback(async () => {
    const titleEl = document.getElementById(
      "cf-title"
    ) as HTMLInputElement | null;
    const title = (titleEl?.value || "").trim();
    if (!title) {
      setComposerError("Please enter a title.");
      return;
    }
    if (mode === "event") {
      const selectedPills = Array.from(
        document.querySelectorAll(".subteam-pill.selected")
      ).map((button) => (button as HTMLElement).dataset.subteam as CategoryKey);
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
      } catch (error) {
        setComposerError(
          error instanceof Error ? error.message : "Failed to create event"
        );
      }
      return;
    }
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
    } catch (error) {
      setComposerError(
        error instanceof Error ? error.message : "Failed to post announcement"
      );
    }
  }, [
    createAnnouncementMutation,
    createEventMutation,
    defaultEventTypeId,
    keyToSubteamId,
    mode,
    setComposerError,
    setComposerOpen,
    setCursor,
  ]);
}
