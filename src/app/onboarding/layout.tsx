"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useState } from "react";

function UserSync() {
  const { user: clerkUser, isLoaded } = useUser();
  const currentUser = useQuery(api.users.getCurrent);
  const upsertUser = useMutation(api.users.upsert);

  useEffect(() => {
    if (isLoaded && clerkUser && currentUser === null) {
      upsertUser({
        name:
          clerkUser.fullName ??
          clerkUser.firstName ??
          clerkUser.emailAddresses[0]?.emailAddress ??
          "User",
        email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      });
    }
  }, [isLoaded, clerkUser, currentUser, upsertUser]);

  return null;
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-8">
      {mounted && <UserSync />}
      <div className="w-full max-w-[480px]">{children}</div>
    </div>
  );
}
