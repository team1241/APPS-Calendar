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
