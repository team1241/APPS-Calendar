export function positionPillIndicator(
  container: HTMLElement | null,
  indicator: HTMLElement | null
): void {
  if (!(container && indicator)) {
    return;
  }
  const activeButton = container.querySelector<HTMLElement>("button.active");
  if (!activeButton) {
    return;
  }
  const containerBox = container.getBoundingClientRect();
  const previousBox = indicator.getBoundingClientRect();
  const buttonBox = activeButton.getBoundingClientRect();
  const nextLeft = buttonBox.left - containerBox.left;
  const previousLeft = previousBox.left - containerBox.left;
  const hasPreviousIndicator = previousBox.width > 0;
  indicator.style.transform = `translateX(${nextLeft}px)`;
  indicator.style.width = `${buttonBox.width}px`;
  if (
    hasPreviousIndicator &&
    (Math.abs(previousLeft - nextLeft) > 0.5 ||
      Math.abs(previousBox.width - buttonBox.width) > 0.5)
  ) {
    indicator.animate(
      [
        {
          transform: `translateX(${previousLeft}px)`,
          width: `${previousBox.width}px`,
        },
        {
          transform: `translateX(${nextLeft}px)`,
          width: `${buttonBox.width}px`,
        },
      ],
      { duration: 220, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" }
    );
  }
}
