import type React from "react";
import {
  CATEGORIES,
  type CategoryKey,
  FALLBACK_CATEGORY_COLOR,
} from "./categories";
import { withAlpha } from "./color-utils";
import type { CalendarEvent } from "./types";

const RING_ALPHA = 0.8;
const GLOW_ALPHA = 0.32;
const GLOW_BLUR_PX = 6;
const EDGE_GLOW_ALPHA = GLOW_ALPHA * 0.7;
const EDGE_GLOW_OFFSET_PX = 2;
const LIFT_ALPHA = 0.3;
const LIFT_SHADOW = "0 0 6px 0";
const PERCENT = 100;

/**
 * Each theme turns one of these two shadows on and the other off through the
 * `--pill-glow-weight` / `--pill-lift-weight` tokens in `styles/theme.css`
 * (dark: glow, light: even soft halo with no vertical offset, so no edge looks thicker).
 */
function weightedColor(
  color: string,
  alpha: number,
  weightToken: string
): string {
  return `color-mix(in srgb, ${color} calc(${alpha * PERCENT}% * var(${weightToken})), transparent)`;
}

/** Equal-width hard-stop segments, one per color, left to right. */
function segmentedGradient(
  colors: string[],
  styleColor: (color: string) => string
): string {
  const step = PERCENT / colors.length;
  const stops = colors.map(
    (color, i) => `${styleColor(color)} ${i * step}% ${(i + 1) * step}%`
  );
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

/** The theme's base fill mixed with `color` by `--pill-tint` (0% in dark, so dark stays untinted). */
function tintedFill(color: string): string {
  return `color-mix(in srgb, ${color} var(--pill-tint), rgb(var(--panel-rgb) / var(--pill-base-alpha)))`;
}

export function getEventColors(event: CalendarEvent): string[] {
  if (Array.isArray(event.subteams) && event.subteams.length) {
    const colors = event.subteams
      .map((key) => CATEGORIES[key as CategoryKey]?.color)
      .filter(Boolean) as string[];
    if (colors.length) {
      return colors;
    }
  }
  return [
    CATEGORIES[event.category as CategoryKey]?.color ?? FALLBACK_CATEGORY_COLOR,
  ];
}

/**
 * Style for the outer element of a pill: a colored ring (the background) plus
 * the theme's shadow. `flat` drops the shadow, used for past and muted items.
 * `--ev-fill` is the inner fill: the theme's base fill tinted with each
 * subteam color, split into equal segments like the ring.
 */
export function getEventBorderStyle(
  colors: string[],
  { flat = false }: { flat?: boolean } = {}
): React.CSSProperties {
  const list = colors.length ? colors : [FALLBACK_CATEGORY_COLOR];
  const [first] = list;
  const last = list.at(-1) ?? first;
  const ring = segmentedGradient(list, (color) => withAlpha(color, RING_ALPHA));
  const fill = segmentedGradient(list, tintedFill);
  const glow =
    list.length === 1
      ? `0 0 ${GLOW_BLUR_PX}px ${weightedColor(first, GLOW_ALPHA, "--pill-glow-weight")}`
      : `-${EDGE_GLOW_OFFSET_PX}px 0 ${GLOW_BLUR_PX}px ${weightedColor(first, EDGE_GLOW_ALPHA, "--pill-glow-weight")}, ${EDGE_GLOW_OFFSET_PX}px 0 ${GLOW_BLUR_PX}px ${weightedColor(last, EDGE_GLOW_ALPHA, "--pill-glow-weight")}`;
  const lift = `${LIFT_SHADOW} ${weightedColor(first, LIFT_ALPHA, "--pill-lift-weight")}`;
  return {
    "--ev-fill": fill,
    background: ring,
    boxShadow: flat ? "none" : `${glow}, ${lift}`,
  } as React.CSSProperties;
}
