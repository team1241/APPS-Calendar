import type { Doc } from "../_generated/dataModel";

export type UserRole = "admin" | "member" | "mentor";

type UserAccessFields = Pick<Doc<"users">, "role">;

export const getUserRole = (user: UserAccessFields): UserRole => {
  if (user.role) {
    return user.role;
  }

  // Existing records predate `role`; the migration intentionally grants all
  // of them Mentor access. New records always write an explicit role.
  return "mentor";
};

export const assertCanChangeUser = (
  actor: Doc<"users">,
  target: Doc<"users">,
  nextRole: UserRole
): void => {
  const actorRole = getUserRole(actor);
  const targetRole = getUserRole(target);

  if (actor._id === target._id && nextRole !== targetRole) {
    throw new Error("You cannot change your own role");
  }

  if (
    actorRole === "admin" &&
    (targetRole === "mentor" || nextRole === "mentor")
  ) {
    throw new Error("Only mentors can manage mentor accounts");
  }
};

export const assertCanDeleteUser = (
  actor: Doc<"users">,
  target: Doc<"users">
): void => {
  if (actor._id === target._id) {
    throw new Error("You cannot delete your own account");
  }

  if (
    getUserRole(actor) === "admin" &&
    getUserRole(target) === "mentor"
  ) {
    throw new Error("Only mentors can delete mentor accounts");
  }
};
