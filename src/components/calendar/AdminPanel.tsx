"use client";

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  Delete02Icon,
  FilterHorizontalIcon,
  FloppyDiskIcon,
  Sorting01Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UserRole, UserSort, UserType } from "@/lib/admin/types";
import type { ConfirmationDialog } from "@/lib/calendar/calendar";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AdminSelect, type AdminSelectOption } from "./AdminSelect";
import { AdminSubteamEditor } from "./AdminSubteamEditor";

const INITIAL_USER_COUNT = 100;
const LOAD_MORE_USER_COUNT = 100;
const nameCollator = new Intl.Collator(undefined, { sensitivity: "base" });

const GRADE_OPTIONS: readonly AdminSelectOption[] = [
  { disabled: true, label: "—", value: "mentor" },
  { label: "Grade 12", value: "12" },
  { label: "Grade 11", value: "11" },
  { label: "Grade 10", value: "10" },
  { label: "Grade 9", value: "9" },
];

const ROLE_FILTER_OPTIONS: readonly AdminSelectOption[] = [
  { label: "All roles", value: "all" },
  { label: "Mentors", value: "mentor" },
  { label: "Admins", value: "admin" },
  { label: "Members", value: "member" },
];

const SORT_OPTIONS: readonly AdminSelectOption[] = [
  { label: "Name A–Z", value: "name-asc" },
  { label: "Name Z–A", value: "name-desc" },
  { label: "Grade 12–9", value: "grade-desc" },
  { label: "Grade 9–12", value: "grade-asc" },
];

interface AdminUser {
  _id: Id<"users">;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  subteams: Id<"subteams">[];
  userType: UserType;
}

interface UserDraft {
  deleted: boolean;
  role: UserRole;
  subteams: Id<"subteams">[];
  userType: UserType;
}

type DraftsByUserId = Partial<Record<Id<"users">, UserDraft>>;

const getUserName = (user: AdminUser): string =>
  `${user.firstName} ${user.lastName}`.trim() || user.email;

const getUserDraft = (user: AdminUser): UserDraft => ({
  deleted: false,
  role: user.role,
  subteams: user.subteams,
  userType: user.userType,
});

const haveSameSubteams = (
  first: Id<"subteams">[],
  second: Id<"subteams">[]
): boolean => {
  if (first.length !== second.length) {
    return false;
  }
  const secondIds = new Set(second);
  return first.every((subteamId) => secondIds.has(subteamId));
};

const isDraftUnchanged = (user: AdminUser, draft: UserDraft): boolean =>
  !draft.deleted &&
  draft.role === user.role &&
  draft.userType === user.userType &&
  haveSameSubteams(draft.subteams, user.subteams);

const getGradeSortValue = (userType: UserType): number =>
  userType === "mentor" ? Number.POSITIVE_INFINITY : Number(userType);

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unable to save changes.";

const getSortIcon = (isActive: boolean, isAscending: boolean) => {
  if (!isActive) {
    return Sorting01Icon;
  }
  return isAscending ? ArrowUp01Icon : ArrowDown01Icon;
};

export function AdminPanel({
  currentUserId,
  currentUserRole,
  onDirtyChange,
  onRequestConfirmation,
}: {
  currentUserId: Id<"users">;
  currentUserRole: UserRole;
  onDirtyChange: (isDirty: boolean) => void;
  onRequestConfirmation: (confirmation: ConfirmationDialog) => void;
}) {
  const {
    loadMore,
    results,
    status: paginationStatus,
  } = usePaginatedQuery(
    api.users.listUsers,
    {},
    { initialNumItems: INITIAL_USER_COUNT }
  );
  const subteams = useQuery(api.subteams.list) ?? [];
  const saveAdminChanges = useMutation(api.users.saveAdminChanges);
  const removeUser = useAction(api.users.removeUser);

  const [drafts, setDrafts] = useState<DraftsByUserId>({});
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [sort, setSort] = useState<UserSort>("name-asc");
  const [subteamFilter, setSubteamFilter] = useState<"all" | Id<"subteams">>(
    "all"
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const users = results as AdminUser[];
  const pendingCount = Object.keys(drafts).length;
  const hasPendingChanges = pendingCount > 0;
  const roleOptions = useMemo<readonly AdminSelectOption[]>(
    () => [
      {
        disabled: currentUserRole !== "mentor",
        label: "Mentor",
        value: "mentor",
      },
      { label: "Admin", value: "admin" },
      { label: "Member", value: "member" },
    ],
    [currentUserRole]
  );
  const subteamFilterOptions = useMemo<readonly AdminSelectOption[]>(
    () => [
      { label: "All subteams", value: "all" },
      ...subteams.map((subteam) => ({
        label: subteam.subteamName,
        value: subteam._id,
      })),
    ],
    [subteams]
  );

  useEffect(() => {
    onDirtyChange(hasPendingChanges);
    return () => onDirtyChange(false);
  }, [hasPendingChanges, onDirtyChange]);

  const getDraft = useCallback(
    (user: AdminUser): UserDraft => drafts[user._id] ?? getUserDraft(user),
    [drafts]
  );

  const updateDraft = useCallback(
    (user: AdminUser, update: (draft: UserDraft) => UserDraft) => {
      setSaveError(null);
      setDrafts((currentDrafts) => {
        const nextDraft = update(currentDrafts[user._id] ?? getUserDraft(user));
        const nextDrafts = { ...currentDrafts };
        if (isDraftUnchanged(user, nextDraft)) {
          delete nextDrafts[user._id];
        } else {
          nextDrafts[user._id] = nextDraft;
        }
        return nextDrafts;
      });
    },
    []
  );

  const visibleUsers = useMemo(() => {
    const filteredUsers = users.filter((user) => {
      const draft = drafts[user._id] ?? getUserDraft(user);
      const matchesRole = roleFilter === "all" || draft.role === roleFilter;
      const matchesSubteam =
        subteamFilter === "all" || draft.subteams.includes(subteamFilter);
      return matchesRole && matchesSubteam;
    });

    return filteredUsers.toSorted((firstUser, secondUser) => {
      const firstDraft = drafts[firstUser._id] ?? getUserDraft(firstUser);
      const secondDraft = drafts[secondUser._id] ?? getUserDraft(secondUser);

      if (sort === "name-asc" || sort === "name-desc") {
        const direction = sort === "name-asc" ? 1 : -1;
        return (
          nameCollator.compare(
            getUserName(firstUser),
            getUserName(secondUser)
          ) * direction
        );
      }

      const firstHasNoGrade =
        firstDraft.role === "mentor" || firstDraft.userType === "mentor";
      const secondHasNoGrade =
        secondDraft.role === "mentor" || secondDraft.userType === "mentor";
      if (firstHasNoGrade !== secondHasNoGrade) {
        return firstHasNoGrade ? 1 : -1;
      }
      if (firstHasNoGrade && secondHasNoGrade) {
        return nameCollator.compare(
          getUserName(firstUser),
          getUserName(secondUser)
        );
      }

      const direction = sort === "grade-asc" ? 1 : -1;
      const gradeDifference =
        getGradeSortValue(firstDraft.userType) -
        getGradeSortValue(secondDraft.userType);
      if (gradeDifference !== 0) {
        return gradeDifference * direction;
      }
      return nameCollator.compare(
        getUserName(firstUser),
        getUserName(secondUser)
      );
    });
  }, [drafts, roleFilter, sort, subteamFilter, users]);

  const getCanManageUser = useCallback(
    (user: AdminUser): boolean =>
      currentUserRole === "mentor" || user.role !== "mentor",
    [currentUserRole]
  );

  const handleSortColumn = (column: "grade" | "name") => {
    if (column === "name") {
      setSort((currentSort) =>
        currentSort === "name-asc" ? "name-desc" : "name-asc"
      );
      return;
    }
    setSort((currentSort) =>
      currentSort === "grade-desc" ? "grade-asc" : "grade-desc"
    );
  };

  const handleRoleChange = (user: AdminUser, role: UserRole) => {
    updateDraft(user, (draft) => ({ ...draft, role }));
  };

  const handleUserTypeChange = (user: AdminUser, userType: UserType) => {
    updateDraft(user, (draft) => ({ ...draft, userType }));
  };

  const handleToggleSubteam = (user: AdminUser, subteamId: Id<"subteams">) => {
    updateDraft(user, (draft) => ({
      ...draft,
      subteams: draft.subteams.includes(subteamId)
        ? draft.subteams.filter((candidateId) => candidateId !== subteamId)
        : [...draft.subteams, subteamId],
    }));
  };

  const handleToggleDeleted = (user: AdminUser) => {
    updateDraft(user, (draft) => ({ ...draft, deleted: !draft.deleted }));
  };

  const handleDiscard = useCallback(() => {
    setDrafts({});
    setSaveError(null);
  }, []);

  const commitChanges = useCallback(async () => {
    const changedEntries = Object.entries(drafts) as [Id<"users">, UserDraft][];
    const updates = changedEntries
      .filter(([, draft]) => !draft.deleted)
      .map(([userId, draft]) => ({
        role: draft.role,
        subteams: draft.subteams,
        userId,
        userType: draft.userType,
      }));
    const deletions = changedEntries.filter(([, draft]) => draft.deleted);

    setSaveError(null);
    setIsSaving(true);
    try {
      if (updates.length > 0) {
        await saveAdminChanges({ changes: updates });
      }

      const deletionResults = await Promise.allSettled(
        deletions.map(([userId]) => removeUser({ userId }))
      );
      const failedDrafts: DraftsByUserId = {};
      let firstDeletionError: unknown = null;
      for (const [index, result] of deletionResults.entries()) {
        if (result.status === "rejected") {
          const [userId, draft] = deletions[index];
          failedDrafts[userId] = draft;
          firstDeletionError ??= result.reason;
        }
      }

      if (Object.keys(failedDrafts).length > 0) {
        setDrafts(failedDrafts);
        throw new Error(
          `Some users could not be deleted. ${getErrorMessage(firstDeletionError)}`
        );
      }
      setDrafts({});
    } catch (error) {
      setSaveError(getErrorMessage(error));
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [drafts, removeUser, saveAdminChanges]);

  const handleSave = () => {
    const deletionCount = Object.values(drafts).filter(
      (draft) => draft?.deleted
    ).length;
    if (deletionCount === 0) {
      commitChanges().catch(() => undefined);
      return;
    }

    onRequestConfirmation({
      action: commitChanges,
      confirmLabel: "Save and delete",
      isDestructive: true,
      message:
        deletionCount === 1
          ? "Save changes and permanently delete this user?"
          : `Save changes and permanently delete ${deletionCount} users?`,
    });
  };

  const renderSubteamControls = (user: AdminUser, draft: UserDraft) => {
    const canManageUser = getCanManageUser(user) && !draft.deleted && !isSaving;
    return (
      <AdminSubteamEditor
        canEdit={canManageUser}
        onToggle={(subteamId) => handleToggleSubteam(user, subteamId)}
        selectedIds={draft.subteams}
        subteams={subteams}
        userName={getUserName(user)}
      />
    );
  };

  const renderRoleSelect = (user: AdminUser, draft: UserDraft) => {
    const isCurrentUser = user._id === currentUserId;
    const canManageUser = getCanManageUser(user);
    return (
      <AdminSelect
        ariaLabel={`Role for ${getUserName(user)}`}
        className={`admin-inline-select role-${draft.role}`}
        disabled={!canManageUser || isCurrentUser || draft.deleted || isSaving}
        onChange={(role) => handleRoleChange(user, role as UserRole)}
        options={roleOptions}
        value={draft.role}
      />
    );
  };

  const renderGradeControl = (user: AdminUser, draft: UserDraft) => {
    if (draft.role === "mentor") {
      return <span className="admin-grade-empty">—</span>;
    }
    return (
      <AdminSelect
        ariaLabel={`Grade for ${getUserName(user)}`}
        className="admin-inline-select admin-grade-select"
        disabled={!getCanManageUser(user) || draft.deleted || isSaving}
        onChange={(userType) =>
          handleUserTypeChange(user, userType as UserType)
        }
        options={GRADE_OPTIONS}
        value={draft.userType}
      />
    );
  };

  const renderDeleteAction = (user: AdminUser, draft: UserDraft) => {
    const isCurrentUser = user._id === currentUserId;
    const canDelete = getCanManageUser(user) && !isCurrentUser;
    let actionTitle = "Mark user for deletion";
    if (isCurrentUser) {
      actionTitle = "You cannot delete your own account";
    } else if (!canDelete) {
      actionTitle = "Only mentors can delete mentor accounts";
    }

    if (draft.deleted) {
      return (
        <button
          className="admin-restore-button"
          disabled={isSaving}
          onClick={() => handleToggleDeleted(user)}
          type="button"
        >
          Restore
        </button>
      );
    }

    return (
      <button
        aria-label={
          isCurrentUser
            ? "You cannot delete your own account"
            : `Delete ${getUserName(user)}`
        }
        className="admin-delete-button"
        disabled={!canDelete || isSaving}
        onClick={() => handleToggleDeleted(user)}
        title={actionTitle}
        type="button"
      >
        <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
      </button>
    );
  };

  return (
    <main className="admin-panel-wrap">
      <header className="admin-panel-heading">
        <div>
          <div className="micro-label">Team access</div>
          <h1>Admin panel</h1>
          <p>Manage grades, permissions, and subteam subscriptions.</p>
        </div>
      </header>

      <section className="admin-users-surface">
        <div className="admin-users-heading">
          <div>
            <h2>
              <HugeiconsIcon
                icon={UserMultipleIcon}
                size={18}
                strokeWidth={2}
              />
              Team members
            </h2>
            <p>{visibleUsers.length} shown · Changes save together</p>
          </div>
        </div>

        <div aria-label="Sort and filter users" className="admin-mobile-tools">
          <AdminSelect
            ariaLabel="Sort users"
            className="admin-mobile-tool"
            leadingIcon={
              <HugeiconsIcon icon={Sorting01Icon} size={14} strokeWidth={2} />
            }
            onChange={(nextSort) => setSort(nextSort as UserSort)}
            options={SORT_OPTIONS}
            value={sort}
          />
          <AdminSelect
            active={roleFilter !== "all"}
            ariaLabel="Filter by role"
            className="admin-mobile-tool"
            leadingIcon={
              <HugeiconsIcon
                icon={FilterHorizontalIcon}
                size={14}
                strokeWidth={2}
              />
            }
            onChange={(role) => setRoleFilter(role as "all" | UserRole)}
            options={ROLE_FILTER_OPTIONS}
            value={roleFilter}
          />
          <AdminSelect
            active={subteamFilter !== "all"}
            ariaLabel="Filter by subteam"
            className="admin-mobile-tool"
            leadingIcon={
              <HugeiconsIcon
                icon={FilterHorizontalIcon}
                size={14}
                strokeWidth={2}
              />
            }
            onChange={(subteamId) =>
              setSubteamFilter(subteamId as "all" | Id<"subteams">)
            }
            options={subteamFilterOptions}
            value={subteamFilter}
          />
        </div>

        <div className="admin-table-scroll">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th scope="col">
                  <button
                    aria-label={`Sort by name ${
                      sort === "name-asc" ? "descending" : "ascending"
                    }`}
                    className={[
                      "admin-header-sort",
                      sort.startsWith("name") && "active",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleSortColumn("name")}
                    type="button"
                  >
                    Name
                    <HugeiconsIcon
                      icon={getSortIcon(
                        sort.startsWith("name"),
                        sort === "name-asc"
                      )}
                      size={13}
                      strokeWidth={2.2}
                    />
                  </button>
                </th>
                <th scope="col">
                  <button
                    aria-label={`Sort by grade ${
                      sort === "grade-desc" ? "ascending" : "descending"
                    }`}
                    className={[
                      "admin-header-sort",
                      sort.startsWith("grade") && "active",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleSortColumn("grade")}
                    type="button"
                  >
                    Grade
                    <HugeiconsIcon
                      icon={getSortIcon(
                        sort.startsWith("grade"),
                        sort === "grade-asc"
                      )}
                      size={13}
                      strokeWidth={2.2}
                    />
                  </button>
                </th>
                <th scope="col">
                  <div className="admin-header-filter">
                    <span>Role</span>
                    <AdminSelect
                      active={roleFilter !== "all"}
                      ariaLabel="Filter users by role"
                      className="admin-header-select"
                      iconOnly
                      leadingIcon={
                        <HugeiconsIcon
                          icon={FilterHorizontalIcon}
                          size={13}
                          strokeWidth={2}
                        />
                      }
                      onChange={(role) =>
                        setRoleFilter(role as "all" | UserRole)
                      }
                      options={ROLE_FILTER_OPTIONS}
                      value={roleFilter}
                    />
                  </div>
                </th>
                <th scope="col">
                  <div className="admin-header-filter">
                    <span>Subteams</span>
                    <AdminSelect
                      active={subteamFilter !== "all"}
                      ariaLabel="Filter users by subteam"
                      className="admin-header-select"
                      iconOnly
                      leadingIcon={
                        <HugeiconsIcon
                          icon={FilterHorizontalIcon}
                          size={13}
                          strokeWidth={2}
                        />
                      }
                      onChange={(subteamId) =>
                        setSubteamFilter(subteamId as "all" | Id<"subteams">)
                      }
                      options={subteamFilterOptions}
                      value={subteamFilter}
                    />
                  </div>
                </th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => {
                const draft = getDraft(user);
                const canManageUser = getCanManageUser(user);
                const isCurrentUser = user._id === currentUserId;
                return (
                  <tr
                    className={[
                      isCurrentUser && "is-current-user",
                      drafts[user._id] && "has-admin-changes",
                      draft.deleted && "is-pending-delete",
                      !canManageUser && "is-readonly",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={user._id}
                  >
                    <td>
                      <div className="admin-user-identity">
                        <span>
                          <span className="admin-user-name-line">
                            <strong>{getUserName(user)}</strong>
                            {drafts[user._id] && (
                              <span
                                aria-label="Has unsaved changes"
                                className="admin-user-change-dot"
                                title="Has unsaved changes"
                              />
                            )}
                            {isCurrentUser && (
                              <span className="admin-current-user-badge">
                                You
                              </span>
                            )}
                          </span>
                          <small>{user.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>{renderGradeControl(user, draft)}</td>
                    <td>
                      {renderRoleSelect(user, draft)}
                      {!canManageUser && (
                        <small className="admin-field-note">
                          Mentor managed
                        </small>
                      )}
                    </td>
                    <td>{renderSubteamControls(user, draft)}</td>
                    <td className="admin-row-actions">
                      {renderDeleteAction(user, draft)}
                    </td>
                  </tr>
                );
              })}
              {visibleUsers.length === 0 && (
                <tr>
                  <td className="admin-empty-state" colSpan={5}>
                    {paginationStatus === "LoadingFirstPage"
                      ? "Loading team members…"
                      : "No team members match these filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-mobile-list">
          {visibleUsers.map((user) => {
            const draft = getDraft(user);
            const canManageUser = getCanManageUser(user);
            const isCurrentUser = user._id === currentUserId;
            return (
              <article
                className={[
                  "admin-mobile-card",
                  isCurrentUser && "is-current-user",
                  drafts[user._id] && "has-admin-changes",
                  draft.deleted && "is-pending-delete",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={user._id}
              >
                <header>
                  <div className="admin-user-identity">
                    <span>
                      <span className="admin-user-name-line">
                        <strong>{getUserName(user)}</strong>
                        {drafts[user._id] && (
                          <span
                            aria-label="Has unsaved changes"
                            className="admin-user-change-dot"
                            title="Has unsaved changes"
                          />
                        )}
                        {isCurrentUser && (
                          <span className="admin-current-user-badge">You</span>
                        )}
                      </span>
                      <small>{user.email}</small>
                    </span>
                  </div>
                  {renderDeleteAction(user, draft)}
                </header>
                {!canManageUser && (
                  <p className="admin-mobile-readonly-note">
                    Only mentors can edit this account.
                  </p>
                )}
                <div className="admin-mobile-fields">
                  <div className="admin-mobile-field">
                    <span>Grade</span>
                    {renderGradeControl(user, draft)}
                  </div>
                  <div className="admin-mobile-field">
                    <span>Role</span>
                    {renderRoleSelect(user, draft)}
                  </div>
                </div>
                <div className="admin-mobile-subteams">
                  <span>Subteams</span>
                  {renderSubteamControls(user, draft)}
                </div>
                {draft.deleted && (
                  <div className="admin-delete-notice">
                    This account will be permanently deleted after Save.
                  </div>
                )}
              </article>
            );
          })}
          {visibleUsers.length === 0 && (
            <div className="admin-empty-state">
              {paginationStatus === "LoadingFirstPage"
                ? "Loading team members…"
                : "No team members match these filters."}
            </div>
          )}
        </div>

        {paginationStatus === "CanLoadMore" ||
        paginationStatus === "LoadingMore" ? (
          <div className="admin-load-more-row">
            <button
              className="secondary-btn"
              disabled={paginationStatus === "LoadingMore"}
              onClick={() => loadMore(LOAD_MORE_USER_COUNT)}
              type="button"
            >
              {paginationStatus === "LoadingMore" ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </section>

      {hasPendingChanges && (
        <div aria-live="polite" className="admin-save-bar" role="status">
          <div className="admin-save-copy">
            <span className="admin-save-dot" />
            <span>
              <strong>
                {pendingCount} unsaved{" "}
                {pendingCount === 1 ? "change" : "changes"}
              </strong>
              {saveError && <small>{saveError}</small>}
            </span>
          </div>
          <div className="admin-save-actions">
            <button
              className="admin-discard-button"
              disabled={isSaving}
              onClick={handleDiscard}
              type="button"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={2} />
              Discard
            </button>
            <button
              className="admin-save-button"
              disabled={isSaving}
              onClick={handleSave}
              type="button"
            >
              <HugeiconsIcon icon={FloppyDiskIcon} size={15} strokeWidth={2} />
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
