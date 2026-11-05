"use client";

import { Cancel01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useAction, useQuery } from "convex/react";
import { type FormEvent, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Something went wrong.";

/** @brief Mentor-only form that allowlists student emails and lists pending ones. */
export function AdminUserInvites() {
  const invites = useQuery(api.userInvites.list);
  const addInvite = useAction(api.userInvites.add);
  const revokeInvite = useAction(api.userInvites.revoke);

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [revokingId, setRevokingId] = useState<Id<"userInvites"> | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return;
    }
    setError(null);
    setIsAdding(true);
    try {
      await addInvite({ email: trimmedEmail });
      setEmail("");
    } catch (addError) {
      setError(getErrorMessage(addError));
    } finally {
      setIsAdding(false);
    }
  };

  const handleRevoke = async (inviteId: Id<"userInvites">) => {
    setError(null);
    setRevokingId(inviteId);
    try {
      await revokeInvite({ inviteId });
    } catch (revokeError) {
      setError(getErrorMessage(revokeError));
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section className="admin-invites-surface">
      <div className="admin-users-heading">
        <div>
          <h2>
            <HugeiconsIcon icon={UserAdd01Icon} size={18} strokeWidth={2} />
            Add users
          </h2>
          <p>Added emails can sign up and join as students.</p>
        </div>
      </div>

      <form className="admin-invite-form" onSubmit={handleSubmit}>
        <label className="visually-hidden" htmlFor="admin-invite-email">
          Email address
        </label>
        <input
          autoComplete="off"
          className="form-input"
          disabled={isAdding}
          id="admin-invite-email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="student@example.com"
          type="email"
          value={email}
        />
        <button
          className="admin-save-button"
          disabled={isAdding || !email.trim()}
          type="submit"
        >
          {isAdding ? "Adding…" : "Add student"}
        </button>
      </form>
      {error && (
        <p className="admin-invite-error" role="alert">
          {error}
        </p>
      )}

      {invites && invites.length > 0 && (
        <ul className="admin-invite-list">
          {invites.map((invite) => (
            <li key={invite._id}>
              <span>{invite.email}</span>
              <span className="admin-invite-status">Pending · Student</span>
              <button
                aria-label={`Remove ${invite.email}`}
                className="admin-delete-button"
                disabled={revokingId === invite._id}
                onClick={() => handleRevoke(invite._id)}
                title="Remove access"
                type="button"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
