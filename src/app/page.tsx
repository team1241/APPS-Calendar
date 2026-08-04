"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 p-8 dark:bg-black">
      <Show when="signed-out">
        <p className="text-zinc-600 dark:text-zinc-400">Not signed in yet.</p>
        <SignInButton mode="modal">
          <button
            className="rounded-full bg-foreground px-5 py-3 text-background"
            type="button"
          >
            Sign in
          </button>
        </SignInButton>
      </Show>

      <Show when="signed-in">
        <UserButton />
        <SyncedProfile />
      </Show>
    </div>
  );
}

// Makes sure a `users` row exists for the signed-in Clerk account,
// then shows what Convex knows about them.
function SyncedProfile() {
  const ensureUser = useMutation(api.users.ensureUser);
  const currentUser = useQuery(api.users.currentUser);

  useEffect(() => {
    ensureUser();
  }, [ensureUser]);

  if (currentUser === undefined) {
    return <p className="text-zinc-500">Loading your profile...</p>;
  }

  if (currentUser === null) {
    return <p className="text-zinc-500">Setting up your account...</p>;
  }

  return (
    <pre className="max-w-md overflow-auto rounded-lg bg-zinc-900 p-4 text-left text-sm text-zinc-100">
      {JSON.stringify(currentUser, null, 2)}
    </pre>
  );
}
