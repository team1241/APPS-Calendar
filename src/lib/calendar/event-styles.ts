import type React from "react";
import { CATEGORIES, type CategoryKey } from "./categories";
import type { CalendarEvent } from "./types";

export function esc(s: string | undefined): string {
  if (!s) {
    return "";
  }
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "'": "&#39;", '"': "&quot;", "&": "&amp;", "<": "&lt;", ">": "&gt;" })[
        c
      ] ?? c
  );
}
export function hexToRgba(hex: string, alpha: number): string {
  const value = String(hex).replace("#", "");
  if (value.length !== 6) {
    return hex;
  }
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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
  return [CATEGORIES[event.category as CategoryKey]?.color || "#999999"];
}
export function getEventBackground(colors: string[], alpha = 0.26): string {
  if (!colors.length) {
    return `rgba(153, 153, 153, ${alpha})`;
  }
  if (colors.length === 1) {
    return hexToRgba(colors[0], alpha);
  }
  const step = 100 / colors.length;
  return `linear-gradient(90deg, ${colors.map((color, index) => `${hexToRgba(color, alpha)} ${index * step}% ${(index + 1) * step}%`).join(", ")})`;
}
export function getEventBorderStyle(
  colors: string[],
  opts?: { borderAlpha?: number; glowAlpha?: number; glowSize?: number }
): React.CSSProperties {
  const { borderAlpha = 0.8, glowAlpha = 0.32, glowSize = 6 } = opts || {};
  const list = colors?.length ? colors : ["#999999"];
  if (list.length === 1) {
    const [primary] = list;
    const ring = hexToRgba(primary, borderAlpha);
    const glow = hexToRgba(primary, glowAlpha);
    return { background: ring, boxShadow: `0 0 ${glowSize}px ${glow}` };
  }
  const n = list.length;
  const step = 100 / n;
  const ringStops = list
    .map(
      (color, i) =>
        `${hexToRgba(color, borderAlpha)} ${i * step}% ${(i + 1) * step}%`
    )
    .join(", ");
  const edgeGlowLeft = hexToRgba(list[0], glowAlpha * 0.7);
  const edgeGlowRight = hexToRgba(list[n - 1], glowAlpha * 0.7);
  return {
    background: `linear-gradient(90deg, ${ringStops})`,
    boxShadow: `-2px 0 ${glowSize}px ${edgeGlowLeft}, 2px 0 ${glowSize}px ${edgeGlowRight}`,
  };
}
