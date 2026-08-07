"use client";

export function IconChevronLeft({ size = 15 }: { size?: number }) {
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
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
