"use client";

import type React from "react";
import {
  CATEGORIES,
  type CategoryKey,
  esc,
  hexToRgba,
} from "@/lib/calendar/calendar";

export function SubteamPill({
  categoryKey,
  onClick,
  selected,
  includeDataSubteam = false,
  toggleOnClick = false,
}: {
  categoryKey: CategoryKey;
  includeDataSubteam?: boolean;
  onClick?: () => void;
  selected?: boolean;
  toggleOnClick?: boolean;
}) {
  const category = CATEGORIES[categoryKey];
  return (
    <button
      aria-pressed={toggleOnClick ? undefined : selected}
      className={["subteam-pill", selected && "selected"]
        .filter(Boolean)
        .join(" ")}
      data-subteam={includeDataSubteam ? categoryKey : undefined}
      onClick={(event) => {
        if (toggleOnClick) {
          const pill = event.currentTarget;
          pill.classList.toggle("selected");
          pill.setAttribute(
            "aria-pressed",
            pill.classList.contains("selected") ? "true" : "false"
          );
          return;
        }
        onClick?.();
      }}
      style={
        {
          "--pill-bg": hexToRgba(category.color, 0.16),
          "--pill-border": hexToRgba(category.color, 0.55),
          "--pill-glow": hexToRgba(category.color, 0.4),
        } as React.CSSProperties
      }
      type="button"
    >
      <span
        className="cat-dot"
        style={{ background: category.color, height: 7, width: 7 }}
      />
      {esc(category.label)}
    </button>
  );
}
