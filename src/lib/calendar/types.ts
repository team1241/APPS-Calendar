export type ViewTransition = null | "from-left" | "from-right";

export interface CalendarEvent {
  allDay: boolean;
  category?: "assembly" | "electrical" | "manufacturing" | "programming";
  createdAt?: Date;
  end: Date;
  id: string;
  info?: string;
  location?: string;
  organizer?: string;
  snippet?: string;
  start: Date;
  subteams?: ("assembly" | "electrical" | "manufacturing" | "programming")[];
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
