"use client";

import dynamic from "next/dynamic";

const CalendarApp = dynamic(() => import("@/components/calendar-app"), {
  ssr: false,
});

export default function Home() {
  return <CalendarApp />;
}
