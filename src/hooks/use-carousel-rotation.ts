"use client";

import { useEffect } from "react";

type CarouselView = "month" | "week" | "announcements";

const ROTATION_INTERVAL_MS = 15_000;
const NEXT_VIEW: Record<CarouselView, CarouselView> = {
  announcements: "month",
  month: "week",
  week: "announcements",
};

/**
 * @brief Cycles month → week → announcements on a fixed interval while enabled.
 * @param enabled Whether the rotation timer runs.
 * @param view The view currently shown.
 * @param onSetView Called with the next view on each tick.
 */
export function useCarouselRotation({
  enabled,
  view,
  onSetView,
}: {
  enabled: boolean;
  view: CarouselView;
  onSetView: (view: CarouselView) => void;
}) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const timer = window.setInterval(
      () => onSetView(NEXT_VIEW[view]),
      ROTATION_INTERVAL_MS
    );
    return () => window.clearInterval(timer);
  }, [enabled, onSetView, view]);
}
