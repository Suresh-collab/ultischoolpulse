"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useChildContext } from "@/lib/child-context";
import { Card, CardContent } from "@/components/ui/card";
import { SubjectTag } from "@/components/features/subject-tag";
import { SkeletonCard } from "@/components/ui/skeleton";
import { differenceInDays, parseISO, format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sparkles, Calendar } from "lucide-react";

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function KidHomeworkCard({
  subject,
  description,
  isComplete,
  onToggle,
}: {
  subject: string;
  description: string;
  isComplete: boolean;
  onToggle: (v: boolean) => void;
}) {
  const [optimistic, setOptimistic] = useState(isComplete);

  const handleToggle = () => {
    const next = !optimistic;
    setOptimistic(next);
    onToggle(next);
  };

  return (
    <Card padding="compact">
      <CardContent>
        <button
          onClick={handleToggle}
          className="flex w-full items-start gap-4 text-left"
        >
          <span
            className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border-2 transition-colors",
              optimistic
                ? "border-accent bg-accent-light"
                : "border-border hover:border-accent"
            )}
          >
            {optimistic && (
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6L5 9L10 3"
                  stroke="var(--color-accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          <div className="flex-1 min-w-0">
            <SubjectTag subject={subject} />
            <p
              className={cn(
                "mt-1 text-sm",
                optimistic
                  ? "line-through text-text-disabled"
                  : "text-text-primary"
              )}
            >
              {description}
            </p>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}

export default function KidContent() {
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

  const markComplete = useMutation(api.homework.markComplete);

  const selectedChild = childList.find((c) => c._id === selectedChildId);
  const isLoading = homework === undefined || exams === undefined;

  if (childList.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <p className="text-text-secondary">No children added yet.</p>
      </div>
    );
  }

  const allComplete =
    homework && homework.length > 0 && homework.every((h) => h.isComplete);
  const noHomework = homework && homework.length === 0;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-accent">
          Hey {selectedChild?.name ?? "there"}!
        </h1>
        <p className="mt-1 text-text-secondary">
          Here&apos;s your plan for today
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3 max-w-lg mx-auto">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="max-w-lg mx-auto space-y-6">
          {/* Homework section */}
          {allComplete ? (
            <div className="flex flex-col items-center py-8 text-center rounded-[var(--radius-lg)] bg-accent-light">
              <Sparkles size={32} className="mb-2 text-accent" />
              <p className="text-lg font-semibold text-accent">
                Great job! Nothing left for today &#10003;
              </p>
            </div>
          ) : noHomework ? (
            <div className="flex flex-col items-center py-8 text-center rounded-[var(--radius-lg)] bg-accent-light">
              <Sparkles size={32} className="mb-2 text-accent" />
              <p className="text-lg font-semibold text-accent">
                No homework today!
              </p>
            </div>
          ) : (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Today&apos;s Tasks
              </h2>
              {homework!.map((item) => (
                <KidHomeworkCard
                  key={item._id}
                  subject={item.subject}
                  description={item.description}
                  isComplete={item.isComplete}
                  onToggle={(isComplete) =>
                    markComplete({ homeworkId: item._id, isComplete })
                  }
                />
              ))}
            </section>
          )}

          {/* Exam countdown section */}
          {exams && exams.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Coming Up
              </h2>
              {exams.map((exam) => {
                const todayDate = new Date();
                todayDate.setHours(0, 0, 0, 0);
                const examDate = parseISO(exam.examDate);
                const daysLeft = differenceInDays(examDate, todayDate);
                const dayName = format(examDate, "EEEE");

                return (
                  <Card key={exam._id} variant="exam" padding="compact">
                    <CardContent className="flex items-center gap-3">
                      <Calendar size={20} className="text-accent shrink-0" />
                      <p className="text-sm text-text-primary">
                        <strong>{exam.subject}</strong> on {dayName} &mdash;{" "}
                        <span
                          className={cn(
                            "font-semibold",
                            daysLeft <= 2
                              ? "text-error"
                              : daysLeft <= 7
                                ? "text-warning"
                                : "text-text-secondary"
                          )}
                        >
                          {daysLeft === 0
                            ? "Today!"
                            : daysLeft === 1
                              ? "Tomorrow!"
                              : `${daysLeft} days away`}
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
