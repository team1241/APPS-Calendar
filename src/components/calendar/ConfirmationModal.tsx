"use client";

import { useState } from "react";
import type { ConfirmationDialog } from "@/lib/calendar/calendar";

export function ConfirmationModal({
  confirmation,
  onClose,
}: {
  confirmation: ConfirmationDialog;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setError(null);
    setIsConfirming(true);
    try {
      await confirmation.action();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Action failed. Please try again."
      );
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div
      className="modal-overlay confirmation-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConfirming) {
          onClose();
        }
      }}
    >
      <div className="event-modal confirmation-modal">
        <div
          className="glow"
          style={{
            background: confirmation.isDestructive
              ? "radial-gradient(ellipse, rgba(224, 90, 90, 0.16) 0%, transparent 70%)"
              : "radial-gradient(ellipse, rgba(250,250,248,0.10) 0%, transparent 70%)",
          }}
        />
        <div style={{ position: "relative" }}>
          <h2>{confirmation.message}</h2>
          {error && <div className="composer-error">{error}</div>}
          <div className="form-actions confirmation-actions">
            <button
              className="secondary-btn"
              disabled={isConfirming}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className={
                confirmation.isDestructive
                  ? "confirmation-delete-action"
                  : "primary-btn"
              }
              disabled={isConfirming}
              onClick={handleConfirm}
              type="button"
            >
              {isConfirming ? "Please wait..." : confirmation.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
