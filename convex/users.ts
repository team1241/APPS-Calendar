import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";
import {
  getAuthedUser,
  requireAdmin,
  requireAuthedUser,
} from "./lib/auth";
import { getIdentityProfile, getMissingProfilePatch, hasProfilePatch } from "./lib/userProfiles";

export { getAuthedUser, requireAdmin, requireAuthedUser } from "./lib/auth";

export const currentUser = query({ args: {}, handler: async (ctx) => await getAuthedUser(ctx) });

export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const profile = getIdentityProfile(identity);
    const userBySubject = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject)).unique();
    let existing = userBySubject;
    if (!existing && identity.subject !== identity.tokenIdentifier) existing = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", identity.tokenIdentifier)).unique();
    if (existing) {
      const patch = getMissingProfilePatch(existing, profile);
      const needsClerkIdMigration = existing.clerkId !== identity.subject;
      if (hasProfilePatch(patch) || needsClerkIdMigration) await ctx.db.patch("users", existing._id, { ...patch, clerkId: identity.subject, updatedAt: Date.now() });
      if (!existing.email || !existing.firstName || !existing.lastName) await ctx.scheduler.runAfter(0, internal.userMaintenance.syncUserProfileFromClerk, { userId: existing._id });
      return existing._id;
    }
    const userId = await ctx.db.insert("users", { email: profile.email, firstName: profile.firstName, lastName: profile.lastName, userType: "mentor", subteams: [], clerkId: identity.subject, isAdmin: false, isSignupComplete: false, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.userMaintenance.syncUserProfileFromClerk, { userId });
    return userId;
  },
});

export const completeSignup = mutation({ args: { firstName: v.string(), lastName: v.string(), userType: v.union(v.literal("9"), v.literal("10"), v.literal("11"), v.literal("12"), v.literal("mentor")), subteams: v.array(v.id("subteams")) }, handler: async (ctx, args) => { const user = await requireAuthedUser(ctx); await ctx.db.patch("users", user._id, { firstName: args.firstName, lastName: args.lastName, userType: args.userType, subteams: args.subteams, isSignupComplete: true, updatedAt: Date.now() }); return null; } });
export const updateProfile = mutation({ args: { firstName: v.optional(v.string()), lastName: v.optional(v.string()), subteams: v.optional(v.array(v.id("subteams"))) }, handler: async (ctx, args) => { const user = await requireAuthedUser(ctx); await ctx.db.patch("users", user._id, { ...args, updatedAt: Date.now() }); return null; } });
export const listUsers = query({ args: { paginationOpts: paginationOptsValidator }, handler: async (ctx, args) => { await requireAdmin(ctx); return await ctx.db.query("users").order("desc").paginate(args.paginationOpts); } });
export const setAdmin = mutation({ args: { userId: v.id("users"), isAdmin: v.boolean() }, handler: async (ctx, args) => { await requireAdmin(ctx); await ctx.db.patch("users", args.userId, { isAdmin: args.isAdmin, updatedAt: Date.now() }); return null; } });

export const removeUser = action({ args: { userId: v.id("users") }, handler: async (ctx, args): Promise<null> => { await ctx.runAction(internal.userMaintenance.removeUser, args); return null; } });
export const backfillMissingUserProfiles = action({ args: { cursor: v.union(v.string(), v.null()) }, handler: async (ctx, args): Promise<{ failedUserIds: string[]; isDone: boolean; nextCursor: string | null; scannedCount: number; updatedCount: number }> => await ctx.runAction(internal.userMaintenance.backfillMissingUserProfiles, args) });
