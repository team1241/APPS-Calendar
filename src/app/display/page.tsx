"use client";

import dynamic from "next/dynamic";

const DisplayApp = dynamic(() => import("@/components/display-app"), {
  ssr: false,
});

export default function Display() {
  return <DisplayApp />;
}
