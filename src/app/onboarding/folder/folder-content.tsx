"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Platform = "android" | "ios";

export default function FolderContent() {
  const router = useRouter();
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const [platform, setPlatform] = useState<Platform>("android");
  const [saving, setSaving] = useState(false);

  const handleDone = async () => {
    setSaving(true);
    try {
      await completeOnboarding();
      router.push("/dashboard");
    } catch {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-center gap-2">
        <div className="h-2 w-8 rounded-full bg-primary" />
        <div className="h-2 w-8 rounded-full bg-primary" />
        <div className="h-2 w-8 rounded-full bg-primary" />
      </div>

      <Card>
        <CardContent className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-text-primary">
              Set up your folder
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Save school PDFs from WhatsApp to a folder, and we&apos;ll do the
              rest.
            </p>
          </div>

          {/* Platform toggle */}
          <div className="flex rounded-[var(--radius-md)] border border-border p-1">
            <button
              onClick={() => setPlatform("android")}
              className={cn(
                "flex-1 rounded-[var(--radius-sm)] py-2 text-sm font-medium transition-colors",
                platform === "android"
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              Android
            </button>
            <button
              onClick={() => setPlatform("ios")}
              className={cn(
                "flex-1 rounded-[var(--radius-sm)] py-2 text-sm font-medium transition-colors",
                platform === "ios"
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              iOS
            </button>
          </div>

          {/* Instructions */}
          <div className="space-y-3 text-sm text-text-primary">
            {platform === "android" ? (
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  Open <strong>WhatsApp</strong> and find your school&apos;s group
                  or chat
                </li>
                <li>
                  Long-press on the PDF file your school sent
                </li>
                <li>
                  Tap the <strong>share</strong> icon (top-right)
                </li>
                <li>
                  Choose <strong>&quot;Save to Files&quot;</strong> or{" "}
                  <strong>&quot;My Files&quot;</strong>
                </li>
                <li>
                  Save it to your designated{" "}
                  <strong>ULTISchoolPulse folder</strong>
                </li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  Open <strong>WhatsApp</strong> and find your school&apos;s group
                  or chat
                </li>
                <li>
                  Tap and hold on the PDF file your school sent
                </li>
                <li>
                  Tap <strong>&quot;Share&quot;</strong> from the menu
                </li>
                <li>
                  Choose <strong>&quot;Save to Files&quot;</strong>
                </li>
                <li>
                  Navigate to your designated{" "}
                  <strong>ULTISchoolPulse folder</strong> and save
                </li>
              </ol>
            )}
          </div>

          <p className="text-xs text-text-secondary">
            The file watcher will automatically pick up new PDFs from your
            folder and extract homework, classwork, and exam details.
          </p>

          <Button
            onClick={handleDone}
            disabled={saving}
            className="w-full"
          >
            {saving ? "Setting up..." : "I've set it up"}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
