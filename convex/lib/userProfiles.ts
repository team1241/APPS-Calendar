import type { Doc } from "../_generated/dataModel";

export type UserProfile = Pick<Doc<"users">, "email" | "firstName" | "lastName">;

export type ClerkUser = {
  email_addresses: Array<{ email_address: string; id: string }>;
  first_name: string | null;
  id: string;
  last_name: string | null;
  primary_email_address_id: string | null;
};

export const getIdentityProfile = (identity: { email?: string; familyName?: string; givenName?: string }): UserProfile => ({ email: identity.email ?? "", firstName: identity.givenName ?? "", lastName: identity.familyName ?? "" });
export const getClerkProfile = (clerkUser: ClerkUser): UserProfile => ({ email: clerkUser.email_addresses.find(({ id }) => id === clerkUser.primary_email_address_id)?.email_address ?? "", firstName: clerkUser.first_name ?? "", lastName: clerkUser.last_name ?? "" });
export const getMissingProfilePatch = (user: Doc<"users">, profile: UserProfile): Partial<UserProfile> => { const patch: Partial<UserProfile> = {}; if (!user.email && profile.email) patch.email = profile.email; if (!user.firstName && profile.firstName) patch.firstName = profile.firstName; if (!user.lastName && profile.lastName) patch.lastName = profile.lastName; return patch; };
export const hasProfilePatch = (patch: Partial<UserProfile>) => Object.keys(patch).length > 0;
