"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useChildContext } from "@/lib/child-context";
import { HomeworkCard } from "@/components/features/homework-card";
import { ExamCard } from "@/components/features/exam-card";
import { ParseStatusBanner } from "@/components/features/parse-status-banner";
import { SkeletonCard } from "@/components/ui/skeleton";
import { BookOpen, CalendarCheck, Loader2 } from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

// Single-child section used by both single and multi-child views
function ChildSection({
  childId,
  childName,
  showHeading,
}: {
  childId: Id<"children">;
  childName: string;
  showHeading: boolean;
}) {
  const today = getToday();

  const homework = useQuery(api.homework.forChildToday, {
    childId,
    date: today,
  });
  const exams = useQuery(api.exams.upcoming, { childId, daysAhead: 14 });
  const issues = useQuery(api.schoolEntries.getRecentIssues, { childId });
  const pendingEntries = useQuery(api.schoolEntries.getPendingForChild, {
    childId,
  });

  const markComplete = useMutation(api.homework.markComplete);
  const acknowledgeExam = useMutation(api.exams.acknowledge);

  const isLoading = homework === undefined || exams === undefined;

  return (
    <div className="space-y-4">
      {showHeading && (
        <h2 className="text-lg font-bold text-text-primary border-b border-border pb-2">
          {childName}
        </h2>
      )}

      {/* Processing indicator */}
      {pendingEntries && pendingEntries.length > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-info bg-info-light px-4 py-2.5 text-sm text-info">
          <Loader2 size={14} className="animate-spin" />
          <span>Processing {childName}&apos;s PDF...</span>
        </div>
      )}

      {/* Parse status banners */}
      {issues?.map((entry) => (
        <ParseStatusBanner
          key={entry._id}
          childName={childName}
          date={entry.entryDate}
          status={entry.processingStatus as "low_confidence" | "failed"}
          pdfUrl={entry.pdfUrl}
        />
      ))}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Homework */}
        <section>
          {!showHeading && (
            <h2 className="mb-3 text-lg font-semibold text-text-primary">
              Today&apos;s Homework
            </h2>
          )}
          {showHeading && (
            <h3 className="mb-3 text-sm font-semibold text-text-secondary uppercase tracking-wide">
              Homework
            </h3>
          )}

          {isLoading ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : homework.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <BookOpen size={24} className="mb-1 text-text-disabled" />
              <p className="text-sm text-text-secondary">
                No homework assigned today
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {homework.map((item) => (
                <HomeworkCard
                  key={item._id}
                  subject={item.subject}
                  description={item.description}
                  dueDate={item.dueDate}
                  isComplete={item.isComplete}
                  onToggleComplete={(isComplete) =>
                    markComplete({ homeworkId: item._id, isComplete })
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* Exams */}
        <section>
          {!showHeading && (
            <h2 className="mb-3 text-lg font-semibold text-text-primary">
              Upcoming Exams
            </h2>
          )}
          {showHeading && (
            <h3 className="mb-3 text-sm font-semibold text-text-secondary uppercase tracking-wide">
              Exams
            </h3>
          )}

          {isLoading ? (
            <div className="space-y-3">
              <SkeletonCard />
            </div>
          ) : exams.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CalendarCheck size={24} className="mb-1 text-text-disabled" />
              <p className="text-sm text-text-secondary">
                No upcoming exams
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {exams.map((item) => (
                <ExamCard
                  key={item._id}
                  subject={item.subject}
                  examType={item.examType}
                  examDate={item.examDate}
                  portions={item.portions}
                  isAcknowledged={item.isAcknowledged}
                  onAcknowledge={() => acknowledgeExam({ examId: item._id })}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DashboardData() {
  const { selectedChildId, children: childList } = useChildContext();

  // No children added yet
  if (childList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BookOpen size={48} className="mb-4 text-text-disabled" />
        <h2 className="text-lg font-semibold text-text-primary">
          No children added yet
        </h2>
        <p className="mt-1 text-sm text-text-secondary max-w-sm">
          Head to Settings to add your child, then drop a school PDF into the
          watched folder to get started.
        </p>
      </div>
    );
  }

  // "All children" mode (null selectedChildId, multiple children)
  if (selectedChildId === null && childList.length > 1) {
    return (
      <div className="space-y-8">
        {childList.map((child) => (
          <ChildSection
            key={child._id}
            childId={child._id}
            childName={child.name}
            showHeading={true}
          />
        ))}
      </div>
    );
  }

  // Single child selected (or only one child)
  const activeId = selectedChildId ?? childList[0]?._id;
  const activeChild = childList.find((c) => c._id === activeId);
  if (!activeId) return null;

  return (
    <ChildSection
      childId={activeId}
      childName={activeChild?.name ?? "Your child"}
      showHeading={false}
    />
  );
}

export default function DashboardContent() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
      <DashboardData />
    </div>
  );
}
