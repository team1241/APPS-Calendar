import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

/**
 * @brief Applies and consumes a pending invite for the user's email, upgrading only plain members.
 * @return Whether an invite was applied.
 */
export const claimInvite = async (
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<boolean> => {
  const user = await ctx.db.get("users", userId);
  if (!user?.email) {
    return false;
  }
  const invite = await ctx.db
    .query("userInvites")
    .withIndex("by_email", (q) => q.eq("email", normalizeEmail(user.email)))
    .first();
  if (!invite) {
    return false;
  }
  if (user.role === "member") {
    await ctx.db.patch("users", userId, {
      isAdmin: false,
      role: invite.role,
      updatedAt: Date.now(),
    });
  }
  await ctx.db.delete("userInvites", invite._id);
  return true;
};
