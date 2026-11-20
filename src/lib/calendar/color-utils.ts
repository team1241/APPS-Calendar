const PERCENT = 100;

/** Returns `color` (any CSS color, including `var(--token)`) at the given alpha. */
export function withAlpha(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Number((alpha * PERCENT).toFixed(1))}%, transparent)`;
}
