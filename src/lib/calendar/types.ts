import type { CategoryKey } from "./categories";

export type ViewTransition = null | "from-left" | "from-right";

export interface CalendarEvent {
  allDay: boolean;
  authorId?: string;
  category?: CategoryKey;
  createdAt?: Date;
  end: Date;
  id: string;
  info?: string;
  location?: string;
  organizer?: string;
  snippet?: string;
  start: Date;
  subteams?: CategoryKey[];
  title: string;
}

export interface CalendarAnnouncement {
  date: Date;
  id: string;
  snippet: string;
  title: string;
}

export interface ConfirmationDialog {
  action: () => Promise<void>;
  confirmLabel: string;
  isDestructive?: boolean;
  message: string;
}
