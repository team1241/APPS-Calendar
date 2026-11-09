import type { ClerkUser } from "./userProfiles";

export const getClerkUserId = (storedClerkId: string) => storedClerkId.split("|").find((value) => value.startsWith("user_")) ?? storedClerkId;

export const fetchClerkUser = async (clerkUserId: string, clerkSecretKey: string): Promise<ClerkUser> => {
  const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkUserId)}`, { headers: { Authorization: `Bearer ${clerkSecretKey}` } });
  if (!response.ok) throw new Error(`Clerk request failed (${response.status})`);
  return (await response.json()) as ClerkUser;
};

export const deleteClerkUser = async (clerkUserId: string, clerkSecretKey: string): Promise<void> => {
  const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkUserId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${clerkSecretKey}`, "Content-Type": "application/json" } });
  if (response.ok || response.status === 404) return;
  const errorBody = await response.text();
  throw new Error(`Clerk user deletion failed (${response.status}): ${errorBody || "unknown error"}`);
};

type ClerkAllowlistIdentifier = { id: string; identifier: string };

const CLERK_ALLOWLIST_URL = "https://api.clerk.com/v1/allowlist_identifiers";
const CLERK_ALLOWLIST_PAGE_LIMIT = 500;

const findAllowlistIdentifier = async (identifier: string, clerkSecretKey: string): Promise<ClerkAllowlistIdentifier | undefined> => {
  const response = await fetch(`${CLERK_ALLOWLIST_URL}?limit=${CLERK_ALLOWLIST_PAGE_LIMIT}`, { headers: { Authorization: `Bearer ${clerkSecretKey}` } });
  if (!response.ok) throw new Error(`Clerk allowlist lookup failed (${response.status})`);
  const entries = (await response.json()) as ClerkAllowlistIdentifier[];
  return entries.find((entry) => entry.identifier.toLowerCase() === identifier.toLowerCase());
};

/**
 * @brief Allowlists an email for sign-up, reusing an existing entry if Clerk already has one.
 * @return The Clerk allowlist identifier ID.
 */
export const addClerkAllowlistEmail = async (email: string, clerkSecretKey: string): Promise<string> => {
  const response = await fetch(CLERK_ALLOWLIST_URL, { method: "POST", headers: { Authorization: `Bearer ${clerkSecretKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ identifier: email, notify: false }) });
  if (response.ok) return ((await response.json()) as ClerkAllowlistIdentifier).id;
  const errorBody = await response.text();
  const existing = await findAllowlistIdentifier(email, clerkSecretKey).catch(() => undefined);
  if (existing) return existing.id;
  throw new Error(`Clerk allowlist update failed (${response.status}): ${errorBody || "unknown error"}`);
};

export const deleteClerkAllowlistIdentifier = async (allowlistId: string, clerkSecretKey: string): Promise<void> => {
  const response = await fetch(`${CLERK_ALLOWLIST_URL}/${encodeURIComponent(allowlistId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${clerkSecretKey}` } });
  if (response.ok || response.status === 404) return;
  const errorBody = await response.text();
  throw new Error(`Clerk allowlist removal failed (${response.status}): ${errorBody || "unknown error"}`);
};

/** @brief Removes an email from the sign-up allowlist; a no-op when it isn't listed. */
export const removeClerkAllowlistEmail = async (email: string, clerkSecretKey: string): Promise<void> => {
  const existing = await findAllowlistIdentifier(email, clerkSecretKey);
  if (existing) await deleteClerkAllowlistIdentifier(existing.id, clerkSecretKey);
};
