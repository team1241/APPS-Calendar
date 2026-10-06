import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";
import {
  getAuthedUser,
  requireAdmin,
  requireAuthedUser,
} from "./lib/auth";
import {
  assertCanChangeUser,
  getUserRole,
  type UserRole,
} from "./lib/userAccess";
import {
  getIdentityProfile,
  getMissingProfilePatch,
  hasProfilePatch,
} from "./lib/userProfiles";

export {
  getAuthedUser,
  requireAdmin,
  requireAuthedUser,
} from "./lib/auth";

const MAX_ADMIN_CHANGES = 100;

const userTypeValidator = v.union(
  v.literal("9"),
  v.literal("10"),
  v.literal("11"),
  v.literal("12"),
  v.literal("mentor")
);

const userRoleValidator = v.union(
  v.literal("member"),
  v.literal("admin"),
  v.literal("mentor")
);

const withNormalizedAccess = (user: Doc<"users">) => {
  const role = getUserRole(user);
  return {
    ...user,
    isAdmin: role !== "member",
    role,
  };
};

const validateSubteamIds = async (
  ctx: MutationCtx,
  subteamIds: Id<"subteams">[]
): Promise<void> => {
  if (new Set(subteamIds).size !== subteamIds.length) {
    throw new Error("A subteam cannot be selected more than once");
  }

  for (const subteamId of subteamIds) {
    const subteam = await ctx.db.get("subteams", subteamId);
    if (!subteam) {
      throw new Error("One of the selected subteams no longer exists");
    }
  }
};

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    return user ? withNormalizedAccess(user) : null;
  },
});

export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const profile = getIdentityProfile(identity);
    const userBySubject = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (queryBuilder) =>
        queryBuilder.eq("clerkId", identity.subject)
      )
      .unique();
    let existing = userBySubject;

    if (!existing && identity.subject !== identity.tokenIdentifier) {
      existing = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (queryBuilder) =>
          queryBuilder.eq("clerkId", identity.tokenIdentifier)
        )
        .unique();
    }

    if (existing) {
      const profilePatch = getMissingProfilePatch(existing, profile);
      const needsClerkIdMigration = existing.clerkId !== identity.subject;
      const needsRoleMigration = existing.role === undefined;

      if (
        hasProfilePatch(profilePatch) ||
        needsClerkIdMigration ||
        needsRoleMigration
      ) {
        await ctx.db.patch("users", existing._id, {
          ...profilePatch,
          ...(needsRoleMigration ? { isAdmin: true, role: "mentor" } : {}),
          clerkId: identity.subject,
          updatedAt: Date.now(),
        });
      }

      if (needsRoleMigration) {
        await ctx.scheduler.runAfter(
          0,
          internal.userMaintenance.backfillMissingUserRoles,
          { cursor: null }
        );
      }

      if (!existing.email || !existing.firstName || !existing.lastName) {
        await ctx.scheduler.runAfter(
          0,
          internal.userMaintenance.syncUserProfileFromClerk,
          { userId: existing._id }
        );
      }
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: profile.email,
      firstName: profile.firstName,
      isAdmin: false,
      isSignupComplete: false,
      lastName: profile.lastName,
      role: "member",
      subteams: [],
      updatedAt: Date.now(),
      userType: "mentor",
    });
    await ctx.scheduler.runAfter(
      0,
      internal.userMaintenance.syncUserProfileFromClerk,
      { userId }
    );
    return userId;
  },
});

export const completeSignup = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    subteams: v.array(v.id("subteams")),
    userType: userTypeValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    await validateSubteamIds(ctx, args.subteams);
    const role = getUserRole(user);
    await ctx.db.patch("users", user._id, {
      firstName: args.firstName,
      isAdmin: role !== "member",
      isSignupComplete: true,
      lastName: args.lastName,
      role,
      subteams: args.subteams,
      updatedAt: Date.now(),
      userType: args.userType,
    });
    return null;
  },
});

export const updateProfile = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    subteams: v.optional(v.array(v.id("subteams"))),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    if (args.subteams) {
      await validateSubteamIds(ctx, args.subteams);
    }
    await ctx.db.patch("users", user._id, {
      ...args,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const listUsers = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result = await ctx.db
      .query("users")
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map(withNormalizedAccess),
    };
  },
});

export const saveAdminChanges = mutation({
  args: {
    changes: v.array(
      v.object({
        role: userRoleValidator,
        subteams: v.array(v.id("subteams")),
        userId: v.id("users"),
        userType: userTypeValidator,
      })
    ),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    if (args.changes.length > MAX_ADMIN_CHANGES) {
      throw new Error(
        `Save at most ${MAX_ADMIN_CHANGES} users at a time`
      );
    }

    for (const change of args.changes) {
      const target = await ctx.db.get("users", change.userId);
      if (!target) {
        throw new Error("One of the selected users no longer exists");
      }

      assertCanChangeUser(actor, target, change.role);
      await validateSubteamIds(ctx, change.subteams);
      await ctx.db.patch("users", target._id, {
        isAdmin: change.role !== "member",
        role: change.role,
        subteams: change.subteams,
        updatedAt: Date.now(),
        userType: change.userType,
      });
    }
    return null;
  },
});

export const setAdmin = mutation({
  args: { isAdmin: v.boolean(), userId: v.id("users") },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const target = await ctx.db.get("users", args.userId);
    if (!target) {
      throw new Error("User not found");
    }

    const role: UserRole = args.isAdmin ? "admin" : "member";
    assertCanChangeUser(actor, target, role);
    await ctx.db.patch("users", target._id, {
      isAdmin: args.isAdmin,
      role,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const removeUser = action({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<null> => {
    await ctx.runAction(internal.userMaintenance.removeUser, args);
    return null;
  },
});

export const backfillMissingUserProfiles = action({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (
    ctx,
    args
  ): Promise<{
    failedUserIds: string[];
    isDone: boolean;
    nextCursor: string | null;
    scannedCount: number;
    updatedCount: number;
  }> =>
    await ctx.runAction(
      internal.userMaintenance.backfillMissingUserProfiles,
      args
    ),
});
