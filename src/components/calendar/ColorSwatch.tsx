"use client";

export function ColorSwatch({
  colors,
  size = 6,
}: {
  colors: string[];
  size?: number;
}) {
  if (colors.length <= 1) {
    return (
      <span
        className="cat-dot"
        style={{ background: colors[0], height: size, width: size }}
      />
    );
  }
  return (
    <span className="cat-dot subteam-dot" style={{ height: size, width: size }}>
      {colors.map((color, i) => (
        <span key={i} style={{ background: color }} />
      ))}
    </span>
  );
}
