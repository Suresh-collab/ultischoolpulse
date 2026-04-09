"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useChildContext } from "@/lib/child-context";
import { HomeworkCard } from "@/components/features/homework-card";
import { ExamCard } from "@/components/features/exam-card";
import { ParseStatusBanner } from "@/components/features/parse-status-banner";
import { SkeletonCard } from "@/components/ui/skeleton";
import { BookOpen, CalendarCheck, Loader2 } from "lucide-react";

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function DashboardData() {
  const { selectedChildId, children: childList } = useChildContext();

  const today = getToday();

  const homework = useQuery(
    api.homework.forChildToday,
    selectedChildId ? { childId: selectedChildId, date: today } : "skip"
  );

  const exams = useQuery(
    api.exams.upcoming,
    selectedChildId ? { childId: selectedChildId, daysAhead: 14 } : "skip"
  );

  const issues = useQuery(
    api.schoolEntries.getRecentIssues,
    selectedChildId ? { childId: selectedChildId } : "skip"
  );

  const pendingEntries = useQuery(
    api.schoolEntries.getPendingForChild,
    selectedChildId ? { childId: selectedChildId } : "skip"
  );

  const markComplete = useMutation(api.homework.markComplete);
  const acknowledgeExam = useMutation(api.exams.acknowledge);

  const selectedChild = childList.find((c) => c._id === selectedChildId);

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

  const isLoading = homework === undefined || exams === undefined;

  return (
    <div className="space-y-6">
      {/* Processing indicator */}
      {pendingEntries && pendingEntries.length > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-info bg-info-light px-4 py-2.5 text-sm text-info">
          <Loader2 size={14} className="animate-spin" />
          <span>Processing {selectedChild?.name ?? "child"}&apos;s PDF...</span>
        </div>
      )}

      {/* Parse status banners */}
      {issues?.map((entry) => (
        <ParseStatusBanner
          key={entry._id}
          childName={selectedChild?.name ?? "Your child"}
          date={entry.entryDate}
          status={entry.processingStatus as "low_confidence" | "failed"}
          pdfUrl={entry.pdfUrl}
        />
      ))}

      {/* Main two-column grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Today's Homework */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text-primary">
            Today&apos;s Homework
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : homework.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <BookOpen size={32} className="mb-2 text-text-disabled" />
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

        {/* Right: Upcoming Exams */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text-primary">
            Upcoming Exams
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : exams.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CalendarCheck size={32} className="mb-2 text-text-disabled" />
              <p className="text-sm text-text-secondary">
                No upcoming exams on record
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

export default function DashboardContent() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
      <DashboardData />
    </div>
  );
}
