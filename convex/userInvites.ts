import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { requireMentor } from "./lib/auth";
import {
  addClerkAllowlistEmail,
  deleteClerkAllowlistIdentifier,
} from "./lib/clerk";
import { normalizeEmail } from "./lib/userInvites";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LISTED_INVITES = 200;

const getClerkSecretKey = (): string => {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    throw new Error(
      "Adding users is not configured: CLERK_SECRET_KEY is missing from the Convex environment"
    );
  }
  return clerkSecretKey;
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireMentor(ctx);
    const invites = await ctx.db
      .query("userInvites")
      .order("desc")
      .take(MAX_LISTED_INVITES);
    return invites.map(({ _id, email, role, updatedAt }) => ({
      _id,
      email,
      role,
      updatedAt,
    }));
  },
});

export const prepareInvite = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<Id<"users">> => {
    const actor = await requireMentor(ctx);
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existingUser) {
      throw new Error(`${args.email} already has an account`);
    }
    const existingInvite = await ctx.db
      .query("userInvites")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existingInvite) {
      throw new Error(`${args.email} has already been added`);
    }
    return actor._id;
  },
});

export const recordInvite = internalMutation({
  args: {
    clerkAllowlistId: v.string(),
    email: v.string(),
    invitedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existingInvite = await ctx.db
      .query("userInvites")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existingInvite) {
      return null;
    }
    await ctx.db.insert("userInvites", {
      ...args,
      role: "student",
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** @brief Allowlists an email in Clerk so it can sign up, and gives that account the Student role. Mentor-only. */
export const add = action({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<null> => {
    const email = normalizeEmail(args.email);
    if (!EMAIL_PATTERN.test(email)) {
      throw new Error("Enter a valid email address");
    }
    const invitedBy: Id<"users"> = await ctx.runQuery(
      internal.userInvites.prepareInvite,
      { email }
    );
    const clerkAllowlistId = await addClerkAllowlistEmail(
      email,
      getClerkSecretKey()
    );
    await ctx.runMutation(internal.userInvites.recordInvite, {
      clerkAllowlistId,
      email,
      invitedBy,
    });
    return null;
  },
});

export const getInviteForRevoke = internalQuery({
  args: { inviteId: v.id("userInvites") },
  handler: async (ctx, args) => {
    await requireMentor(ctx);
    const invite = await ctx.db.get("userInvites", args.inviteId);
    return invite ? { clerkAllowlistId: invite.clerkAllowlistId } : null;
  },
});

export const deleteInvite = internalMutation({
  args: { inviteId: v.id("userInvites") },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get("userInvites", args.inviteId);
    if (invite) {
      await ctx.db.delete("userInvites", args.inviteId);
    }
    return null;
  },
});

/** @brief Removes a pending invite and its Clerk allowlist entry. Mentor-only. */
export const revoke = action({
  args: { inviteId: v.id("userInvites") },
  handler: async (ctx, args): Promise<null> => {
    const invite = await ctx.runQuery(
      internal.userInvites.getInviteForRevoke,
      args
    );
    if (!invite) {
      return null;
    }
    await deleteClerkAllowlistIdentifier(
      invite.clerkAllowlistId,
      getClerkSecretKey()
    );
    await ctx.runMutation(internal.userInvites.deleteInvite, args);
    return null;
  },
});
