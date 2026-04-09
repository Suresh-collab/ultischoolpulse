"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useChildContext } from "@/lib/child-context";
import { ExamCard } from "@/components/features/exam-card";
import { SkeletonCard } from "@/components/ui/skeleton";
import { CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "upcoming" | "all";

export default function ExamsContent() {
  const { selectedChildId } = useChildContext();
  const [tab, setTab] = useState<Tab>("upcoming");

  const upcomingExams = useQuery(
    api.exams.upcoming,
    selectedChildId ? { childId: selectedChildId, daysAhead: 90 } : "skip"
  );

  const allExams = useQuery(
    api.exams.allForChild,
    tab === "all" && selectedChildId
      ? { childId: selectedChildId }
      : "skip"
  );

  const acknowledgeExam = useMutation(api.exams.acknowledge);

  const exams = tab === "upcoming" ? upcomingExams : allExams;
  const isLoading = exams === undefined;

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Exams</h1>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-[var(--radius-md)] border border-border p-1 w-fit">
        {(["upcoming", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-[var(--radius-sm)] px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {t === "upcoming" ? "Upcoming" : "All"}
          </button>
        ))}
      </div>

      {!selectedChildId ? (
        <div className="flex flex-col items-center py-12 text-center">
          <CalendarCheck size={32} className="mb-2 text-text-disabled" />
          <p className="text-sm text-text-secondary">
            Add a child in Settings to see exams
          </p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3 max-w-xl">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : exams.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <CalendarCheck size={32} className="mb-2 text-text-disabled" />
          <p className="text-sm text-text-secondary">
            {tab === "upcoming"
              ? "No upcoming exams on record."
              : "No exams on record yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-w-xl">
          {exams.map((exam) => {
            const isPast = exam.examDate < today;
            return (
              <div
                key={exam._id}
                className={cn(isPast && tab === "all" && "opacity-60")}
              >
                <ExamCard
                  subject={exam.subject}
                  examType={exam.examType}
                  examDate={exam.examDate}
                  portions={exam.portions}
                  isAcknowledged={exam.isAcknowledged}
                  onAcknowledge={() =>
                    acknowledgeExam({ examId: exam._id })
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
