"use client";

export function IconFilter({ size = 16 }: { size?: number }) {
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
      <line x1="4" x2="20" y1="6" y2="6" />
      <circle cx="9" cy="6" fill="currentColor" r="2" stroke="none" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <circle cx="16" cy="12" fill="currentColor" r="2" stroke="none" />
      <line x1="4" x2="20" y1="18" y2="18" />
      <circle cx="11" cy="18" fill="currentColor" r="2" stroke="none" />
    </svg>
  );
}
