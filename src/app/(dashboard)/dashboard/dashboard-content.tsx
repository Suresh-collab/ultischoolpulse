"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useChildContext } from "@/lib/child-context";
import { ParseStatusBanner } from "@/components/features/parse-status-banner";
import { PdfUpload } from "@/components/features/pdf-upload";
import { WeeklySummary } from "@/components/features/weekly-summary";
import { Loader2, BookOpen } from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";

function ProcessingBanners({ childId, childName }: { childId: Id<"children">; childName: string }) {
  const issues = useQuery(api.schoolEntries.getRecentIssues, { childId });
  const pendingEntries = useQuery(api.schoolEntries.getPendingForChild, { childId });

  return (
    <>
      {pendingEntries && pendingEntries.length > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-info bg-info-light px-4 py-2.5 text-sm text-info">
          <Loader2 size={14} className="animate-spin" />
          <span>Processing {childName}&apos;s PDF...</span>
        </div>
      )}
      {issues?.map((entry) => (
        <ParseStatusBanner
          key={entry._id}
          childName={childName}
          date={entry.entryDate}
          status={entry.processingStatus as "low_confidence" | "failed"}
          pdfUrl={entry.pdfUrl}
        />
      ))}
    </>
  );
}

function DashboardData() {
  const { selectedChildId, children: childList } = useChildContext();

  if (childList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BookOpen size={48} className="mb-4 text-text-disabled" />
        <h2 className="text-lg font-semibold text-text-primary">
          No children added yet
        </h2>
        <p className="mt-1 text-sm text-text-secondary max-w-sm">
          Head to Settings to add your child, then upload a school PDF to get started.
        </p>
      </div>
    );
  }

  // Show processing banners for active children
  const activeChildren =
    selectedChildId !== null
      ? childList.filter((c) => c._id === selectedChildId)
      : childList.length === 1
        ? [childList[0]]
        : childList;

  return (
    <div className="space-y-4">
      {activeChildren.map((child) => (
        <ProcessingBanners
          key={child._id}
          childId={child._id}
          childName={child.name}
        />
      ))}
      <WeeklySummary />
    </div>
  );
}

export default function DashboardContent() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
      <PdfUpload />
      <DashboardData />
    </div>
  );
}
