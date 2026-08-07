import type { CalendarEvent } from "./types";

export const CATEGORIES = {
  assembly: { color: "#B79BFA", label: "Design" },
  electrical: { color: "#5FD0A0", label: "Electrical" },
  manufacturing: { color: "#F0A35A", label: "Manufacturing" },
  programming: { color: "#73B4FF", label: "Programming" },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

export const FILTER_CATEGORY_ORDER: CategoryKey[] = [
  "programming",
  "manufacturing",
  "electrical",
  "assembly",
];

export function eventSubteamKeys(event: CalendarEvent): CategoryKey[] {
  if (Array.isArray(event.subteams) && event.subteams.length) {
    return event.subteams;
  }
  if (event.category) {
    return [event.category];
  }
  return [];
}

export function isEventVisible(
  event: CalendarEvent,
  filter: Set<CategoryKey>
): boolean {
  const keys = eventSubteamKeys(event);
  if (!keys.length) {
    return true;
  }
  return keys.some((key) => filter.has(key));
}

export function normalizeSubteamName(name: string): CategoryKey | null {
  const lower = name.toLowerCase().trim();
  if (lower.includes("program")) {
    return "programming";
  }
  if (lower.includes("manufactur")) {
    return "manufacturing";
  }
  if (lower.includes("electrical") || lower.includes("electric")) {
    return "electrical";
  }
  if (lower.includes("design") || lower.includes("assembly")) {
    return "assembly";
  }
  return null;
}
