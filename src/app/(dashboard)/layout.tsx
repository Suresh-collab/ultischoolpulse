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

function OnboardingAndRoleGuard() {
  const currentUser = useQuery(api.users.getCurrent);
  const router = useRouter();
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  useEffect(() => {
    if (!currentUser) return;

    // Onboarding redirect
    if (currentUser.onboardingComplete === false) {
      router.push("/onboarding");
      return;
    }

    // Role-based routing
    if (currentUser.role === "tutor") {
      // Tutors should land on /tutor, redirect from parent routes
      if (
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/kid") ||
        pathname.startsWith("/settings")
      ) {
        router.push("/tutor");
      }
    } else if (currentUser.role === "parent") {
      // Parents accessing /tutor get redirected to /dashboard
      if (pathname.startsWith("/tutor")) {
        router.push("/dashboard");
      }
    }
  }, [currentUser, router, pathname]);

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
            <OnboardingAndRoleGuard />
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
