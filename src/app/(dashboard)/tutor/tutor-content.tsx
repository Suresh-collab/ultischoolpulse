"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubjectTag } from "@/components/features/subject-tag";
import { ExamCard } from "@/components/features/exam-card";
import { SkeletonCard } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { startOfWeek, addDays, format } from "date-fns";
import { Users, ChevronDown } from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";

function getThisWeek() {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = addDays(start, 6);
  return {
    weekStart: format(start, "yyyy-MM-dd"),
    weekEnd: format(end, "yyyy-MM-dd"),
  };
}

export default function TutorContent() {
  const currentUser = useQuery(api.users.getCurrent);
  const linkedChildren = useQuery(api.children.listForTutor);

  const [selectedChildId, setSelectedChildId] = useState<Id<"children"> | null>(null);

  // Auto-select first child
  const activeChildId = useMemo(() => {
    if (selectedChildId && linkedChildren?.find((c) => c._id === selectedChildId)) {
      return selectedChildId;
    }
    return linkedChildren?.[0]?._id ?? null;
  }, [selectedChildId, linkedChildren]);

  const { weekStart, weekEnd } = getThisWeek();

  const classwork = useQuery(
    api.classwork.forChildThisWeek,
    activeChildId
      ? { childId: activeChildId, weekStart, weekEnd }
      : "skip"
  );

  const exams = useQuery(
    api.exams.upcoming,
    activeChildId ? { childId: activeChildId, daysAhead: 14 } : "skip"
  );

  // Tutor auth gate
  if (currentUser && currentUser.role !== "tutor") {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <p className="text-text-secondary">
          This view is for tutors. Switch to the Dashboard for parent features.
        </p>
      </div>
    );
  }

  // Not linked to any child
  if (linkedChildren && linkedChildren.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <Users size={48} className="mb-4 text-text-disabled" />
        <h2 className="text-lg font-semibold text-text-primary">
          No students linked yet
        </h2>
        <p className="mt-1 text-sm text-text-secondary max-w-sm">
          Ask the parent to add you as a tutor in their Settings.
        </p>
      </div>
    );
  }

  const isLoading = classwork === undefined || exams === undefined;
  const selectedChild = linkedChildren?.find((c) => c._id === activeChildId);

  // Group classwork by subject with accordion
  const classworkBySubject = useMemo(() => {
    if (!classwork) return [];
    const map = new Map<string, { topics: string[]; dates: string[] }>();
    for (const item of classwork) {
      const existing = map.get(item.subject) ?? { topics: [], dates: [] };
      existing.topics.push(...item.topicsCovered);
      if (!existing.dates.includes(item.entryDate)) {
        existing.dates.push(item.entryDate);
      }
      map.set(item.subject, existing);
    }
    return Array.from(map.entries());
  }, [classwork]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Tutor View</h1>

        {/* Child selector */}
        {linkedChildren && linkedChildren.length > 1 && (
          <select
            value={activeChildId ?? ""}
            onChange={(e) => setSelectedChildId(e.target.value as Id<"children">)}
            className="rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-text-primary"
          >
            {linkedChildren.map((child) => (
              <option key={child._id} value={child._id}>
                {child.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedChild && (
        <p className="text-sm text-text-secondary">
          Viewing {selectedChild.name} — {selectedChild.schoolName}
          {selectedChild.grade ? ` (${selectedChild.grade})` : ""}
        </p>
      )}

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="space-y-3">
            <SkeletonCard />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left: This week's classwork */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-text-primary">
              This Week&apos;s Classwork
            </h2>

            {classworkBySubject.length === 0 ? (
              <p className="text-sm text-text-secondary py-4">
                No classwork recorded this week.
              </p>
            ) : (
              <div className="space-y-3">
                {classworkBySubject.map(([subject, data]) => (
                  <ClassworkAccordion
                    key={subject}
                    subject={subject}
                    topics={[...new Set(data.topics)]}
                    dates={data.dates}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Right: Upcoming exams */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-text-primary">
              Upcoming Exams
            </h2>

            {exams!.length === 0 ? (
              <p className="text-sm text-text-secondary py-4">
                No upcoming exams in the next 14 days.
              </p>
            ) : (
              <div className="space-y-3">
                {exams!.map((exam) => (
                  <ExamCard
                    key={exam._id}
                    subject={exam.subject}
                    examType={exam.examType}
                    examDate={exam.examDate}
                    portions={exam.portions}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ClassworkAccordion({
  subject,
  topics,
  dates,
}: {
  subject: string;
  topics: string[];
  dates: string[];
}) {
  const [open, setOpen] = useState(true);

  return (
    <Card padding="compact">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <SubjectTag subject={subject} />
          <span className="text-xs text-text-disabled">
            {dates.length} day{dates.length !== 1 ? "s" : ""}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={cn(
            "text-text-secondary transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <CardContent className="pt-0">
          <ul className="space-y-1 pl-4">
            {topics.map((topic, i) => (
              <li key={i} className="list-disc text-sm text-text-primary">
                {topic}
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
