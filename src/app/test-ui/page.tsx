"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ToastProvider, useToast } from "@/components/ui/toast";

function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className="flex gap-2 flex-wrap">
      <Button onClick={() => toast("Operation successful!", "success")} size="compact">
        Success Toast
      </Button>
      <Button onClick={() => toast("Something went wrong", "error")} variant="destructive" size="compact">
        Error Toast
      </Button>
      <Button onClick={() => toast("Check this out", "warning")} variant="secondary" size="compact">
        Warning Toast
      </Button>
      <Button onClick={() => toast("FYI notification", "info")} variant="secondary" size="compact">
        Info Toast
      </Button>
    </div>
  );
}

export default function TestUIPage() {
  return (
    <ToastProvider>
      <div className="max-w-4xl mx-auto p-8 space-y-12">
        <h1 className="text-3xl font-bold text-text-primary">
          Design System — Component Test
        </h1>

        {/* Buttons */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Buttons</h2>
          <div className="flex gap-3 flex-wrap items-center">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="primary" disabled>Disabled</Button>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <Button size="compact">Compact</Button>
            <Button size="default">Default</Button>
            <Button size="large">Large</Button>
          </div>
        </section>

        {/* Cards */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <Badge>Mathematics</Badge>
              </CardHeader>
              <CardTitle>Standard Card</CardTitle>
              <CardContent>
                <p className="text-text-secondary">Complete exercises 5-10 on page 42</p>
              </CardContent>
            </Card>
            <Card variant="exam">
              <CardHeader>
                <Badge color="#D97706">Science</Badge>
              </CardHeader>
              <CardTitle>Exam Card (Amber Border)</CardTitle>
              <CardContent>
                <p className="text-text-secondary">Unit test on Chapter 4-5, April 15</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Badges */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Badges</h2>
          <div className="flex gap-2 flex-wrap">
            <Badge>Default</Badge>
            <Badge color="#3B5BDB">English</Badge>
            <Badge color="#D97706">Science</Badge>
            <Badge color="#DC2626">Important</Badge>
            <Badge color="#16A34A">Complete</Badge>
          </div>
        </section>

        {/* Input */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Input</h2>
          <div className="max-w-sm space-y-2">
            <label className="text-sm font-medium text-text-primary">Child Name</label>
            <Input placeholder="Enter child's name..." />
          </div>
        </section>

        {/* Skeleton */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Skeleton Loading</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonCard />
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
        </section>

        {/* Toast */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Toast Notifications</h2>
          <ToastDemo />
        </section>
      </div>
    </ToastProvider>
  );
}
