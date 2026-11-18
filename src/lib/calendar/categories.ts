import type { CalendarEvent } from "./types";

/** Subteam colors are theme tokens (see `styles/theme.css`) so each theme gets a palette tuned for its background. */
export const CATEGORIES = {
  assembly: { color: "var(--cat-assembly)", label: "Design" },
  electrical: { color: "var(--cat-electrical)", label: "Electrical" },
  general: { color: "var(--cat-general)", label: "General" },
  manufacturing: { color: "var(--cat-manufacturing)", label: "Manufacturing" },
  programming: { color: "var(--cat-programming)", label: "Programming" },
} as const;

export const FALLBACK_CATEGORY_COLOR = "var(--cat-fallback)";

export type CategoryKey = keyof typeof CATEGORIES;

export const FILTER_CATEGORY_ORDER: CategoryKey[] = [
  "general",
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
  if (lower === "general") {
    return "general";
  }
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
