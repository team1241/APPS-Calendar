"use client";

import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

export interface AdminSelectOption {
  disabled?: boolean;
  label: string;
  value: string;
}

export function AdminSelect({
  active = false,
  ariaLabel,
  className = "",
  disabled = false,
  iconOnly = false,
  leadingIcon,
  onChange,
  options,
  value,
}: {
  active?: boolean;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  iconOnly?: boolean;
  leadingIcon?: ReactNode;
  onChange: (value: string) => void;
  options: readonly AdminSelectOption[];
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const firstEnabledIndex = options.findIndex((option) => !option.disabled);
    const focusIndex =
      selectedIndex >= 0 && !options[selectedIndex]?.disabled
        ? selectedIndex
        : firstEnabledIndex;
    const animationFrame = window.requestAnimationFrame(() => {
      optionRefs.current[focusIndex]?.focus();
    });

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !wrapperRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, options, selectedIndex]);

  const focusOption = (currentIndex: number, direction: 1 | -1) => {
    for (let offset = 1; offset <= options.length; offset += 1) {
      const nextIndex =
        (currentIndex + direction * offset + options.length) % options.length;
      if (!options[nextIndex]?.disabled) {
        optionRefs.current[nextIndex]?.focus();
        return;
      }
    }
  };

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    optionIndex: number
  ) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(optionIndex, event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  const handleSelect = (option: AdminSelectOption) => {
    if (option.disabled) {
      return;
    }
    onChange(option.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      className={`admin-select ${className}`.trim()}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
      ref={wrapperRef}
    >
      <button
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={[
          "admin-select-trigger",
          iconOnly && "icon-only",
          active && "active",
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        ref={triggerRef}
        type="button"
      >
        {leadingIcon}
        {!iconOnly && (
          <span className="admin-select-value">
            {selectedOption?.label ?? value}
          </span>
        )}
        {iconOnly ? (
          active && <span className="admin-control-active-dot" />
        ) : (
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} strokeWidth={2} />
        )}
      </button>
      {isOpen && (
        <div
          aria-label={ariaLabel}
          className="admin-select-popover"
          id={listboxId}
          role="listbox"
        >
          {options.map((option, optionIndex) => (
            <button
              aria-selected={option.value === value}
              className="admin-select-option"
              disabled={option.disabled}
              key={option.value}
              onClick={() => handleSelect(option)}
              onKeyDown={(event) => handleOptionKeyDown(event, optionIndex)}
              ref={(element) => {
                optionRefs.current[optionIndex] = element;
              }}
              role="option"
              type="button"
            >
              <span>{option.label}</span>
              {option.value === value && (
                <HugeiconsIcon icon={Tick02Icon} size={15} strokeWidth={2.2} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
