"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function WelcomeContent() {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const updateProfile = useMutation(api.users.updateProfile);

  const defaultName =
    clerkUser?.fullName ??
    clerkUser?.firstName ??
    "";

  const [name, setName] = useState(defaultName);

  const handleNext = async () => {
    if (name.trim()) {
      await updateProfile({ name: name.trim() });
    }
    router.push("/onboarding/child");
  };

  return (
    <>
      {/* Progress indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <div className="h-2 w-8 rounded-full bg-primary" />
        <div className="h-2 w-8 rounded-full bg-border" />
        <div className="h-2 w-8 rounded-full bg-border" />
      </div>

      <Card>
        <CardContent className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-text-primary">
              Welcome to ULTISchoolPulse
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Let&apos;s get you set up. It only takes a minute.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-text-primary"
            >
              Your display name
            </label>
            <Input
              id="displayName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          <Button onClick={handleNext} className="w-full">
            Continue
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
