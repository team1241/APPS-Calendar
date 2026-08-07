"use client";

export function IconChevronRight({ size = 15 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
