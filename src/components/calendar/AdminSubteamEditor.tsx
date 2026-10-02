"use client";

import {
  Cancel01Icon,
  PlusSignIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { CATEGORIES, normalizeSubteamName } from "@/lib/calendar/categories";
import type { Id } from "../../../convex/_generated/dataModel";

interface AdminSubteam {
  _id: Id<"subteams">;
  subteamName: string;
}

const getSubteamStyle = (subteamName: string): CSSProperties => {
  const categoryKey = normalizeSubteamName(subteamName);
  const color = categoryKey
    ? CATEGORIES[categoryKey].color
    : "rgba(250, 250, 248, 0.72)";
  return { "--admin-subteam-color": color } as CSSProperties;
};

export function AdminSubteamEditor({
  canEdit,
  onToggle,
  selectedIds,
  subteams,
  userName,
}: {
  canEdit: boolean;
  onToggle: (subteamId: Id<"subteams">) => void;
  selectedIds: Id<"subteams">[];
  subteams: AdminSubteam[];
  userName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const selectedIdSet = new Set(selectedIds);
  const selectedSubteams = subteams.filter((subteam) =>
    selectedIdSet.has(subteam._id)
  );
  const hasEverySubteam =
    subteams.length > 0 && selectedSubteams.length === subteams.length;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (!canEdit || hasEverySubteam) {
      setIsOpen(false);
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      firstOptionRef.current?.focus();
    });
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !wrapperRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canEdit, hasEverySubteam, isOpen]);

  return (
    <div className="admin-subteam-editor" ref={wrapperRef}>
      <div className="admin-subteam-pills">
        {selectedSubteams.length === 0 && (
          <span className="admin-subteam-empty">N/A</span>
        )}
        {selectedSubteams.map((subteam) => (
          <span
            className="admin-subteam-pill"
            key={subteam._id}
            style={getSubteamStyle(subteam.subteamName)}
          >
            <span>{subteam.subteamName}</span>
            {canEdit && (
              <button
                aria-label={`Remove ${userName} from ${subteam.subteamName}`}
                className="admin-subteam-remove"
                onClick={() => onToggle(subteam._id)}
                title={`Remove ${subteam.subteamName}`}
                type="button"
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={11}
                  strokeWidth={2.2}
                />
              </button>
            )}
          </span>
        ))}
        {canEdit && !hasEverySubteam && (
          <button
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            aria-label={`Edit subteams for ${userName}`}
            className="admin-subteam-add"
            onClick={() => setIsOpen((open) => !open)}
            ref={triggerRef}
            title="Add or remove subteams"
            type="button"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={2.2} />
          </button>
        )}
      </div>
      {isOpen && (
        <div
          aria-label={`Subteams for ${userName}`}
          className="admin-subteam-popover"
          role="dialog"
        >
          <div className="admin-subteam-popover-heading">Subteams</div>
          {subteams.map((subteam, index) => {
            const isSelected = selectedIdSet.has(subteam._id);
            return (
              <button
                aria-pressed={isSelected}
                className="admin-subteam-popover-option"
                key={subteam._id}
                onClick={() => onToggle(subteam._id)}
                ref={index === 0 ? firstOptionRef : undefined}
                type="button"
              >
                <span
                  className="admin-subteam-popover-dot"
                  style={getSubteamStyle(subteam.subteamName)}
                />
                <span>{subteam.subteamName}</span>
                {isSelected && (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    size={15}
                    strokeWidth={2.2}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
