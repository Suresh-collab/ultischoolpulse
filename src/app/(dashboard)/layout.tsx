"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/features/navigation";
import { ChildProvider, useChildContext } from "@/lib/child-context";

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

function OnboardingGuard() {
  const currentUser = useQuery(api.users.getCurrent);
  const router = useRouter();

  useEffect(() => {
    if (currentUser && currentUser.onboardingComplete === false) {
      router.push("/onboarding");
    }
  }, [currentUser, router]);

  return null;
}

function ChildSync() {
  const childrenData = useQuery(api.children.list);
  const { setChildren } = useChildContext();

  useEffect(() => {
    if (childrenData) {
      setChildren(childrenData);
    }
  }, [childrenData, setChildren]);

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
    <ChildProvider>
      <div className="flex min-h-screen flex-col bg-bg">
        <Navigation />
        {mounted && (
          <>
            <UserSync />
            <OnboardingGuard />
            <ChildSync />
          </>
        )}
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </div>
    </ChildProvider>
  );
}
