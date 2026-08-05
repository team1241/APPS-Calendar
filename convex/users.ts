import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";

// --- Shared helpers (plain TS functions, not Convex functions) ---

export async function getAuthedUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

export async function requireAuthedUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await getAuthedUser(ctx);
  if (!user) {
    throw new Error("Not authenticated, or signup has not been completed yet");
  }
  return user;
}

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireAuthedUser(ctx);
  if (!user.isAdmin) {
    throw new Error("Admin access required");
  }
  return user;
}

// --- Public API ---

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getAuthedUser(ctx);
  },
});

// Call this right after Clerk sign-in to make sure a users row exists.
// It intentionally does NOT mark signup complete - completeSignup does that.
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      email: identity.email ?? "",
      firstName: identity.givenName ?? "",
      lastName: identity.familyName ?? "",
      // Placeholder until completeSignup runs; frontend should treat
      // isSignupComplete === false as "show the signup form".
      userType: "mentor",
      subteams: [],
      clerkId: identity.subject,
      isAdmin: false,
      isSignupComplete: false,
      updatedAt: Date.now(),
    });
  },
});

export const completeSignup = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    userType: v.union(
      v.literal("9"),
      v.literal("10"),
      v.literal("11"),
      v.literal("12"),
      v.literal("mentor"),
    ),
    subteams: v.array(v.id("subteams")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    await ctx.db.patch("users", user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
      userType: args.userType,
      subteams: args.subteams,
      isSignupComplete: true,
      updatedAt: Date.now(),
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
    return await ctx.db.query("users").order("desc").paginate(args.paginationOpts);
  },
});

// NOTE: the very first admin can't grant themselves access through this
// mutation (chicken-and-egg). Set isAdmin: true for your first account
// directly in the Convex dashboard data browser, then use this for everyone
// after that.
export const setAdmin = mutation({
  args: { userId: v.id("users"), isAdmin: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch("users", args.userId, {
      isAdmin: args.isAdmin,
      updatedAt: Date.now(),
    });
    return null;
  },
});
