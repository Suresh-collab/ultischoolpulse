"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useState } from "react";
import { Navigation } from "@/components/features/navigation";

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <Navigation />
      {mounted && <UserSync />}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
    </div>
  );
}
