export const USER_TYPES = ["12", "11", "10", "9", "mentor"] as const;
export const USER_ROLES = ["mentor", "admin", "member"] as const;

export type UserType = (typeof USER_TYPES)[number];
export type UserRole = (typeof USER_ROLES)[number];

export type UserSort = "grade-asc" | "grade-desc" | "name-asc" | "name-desc";
