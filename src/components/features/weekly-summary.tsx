"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useChildContext } from "@/lib/child-context";
import {
  BookOpen,
  CheckCircle,
  Circle,
  GraduationCap,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";

function getWeekRange(): { start: string; end: string; label: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
    label: `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} \u2013 ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
  };
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function ChildSummary({
  childId,
  childName,
  showHeading,
}: {
  childId: Id<"children">;
  childName: string;
  showHeading: boolean;
}) {
  const week = getWeekRange();
  const today = getToday();
  const [expandedDays, setExpandedDays] = useState<Set<string>>(
    new Set([today])
  );

  const homework = useQuery(api.homework.allForChild, {
    childId,
    startDate: week.start,
    endDate: week.end,
  });

  const classwork = useQuery(api.classwork.forChildByDateRange, {
    childId,
    startDate: week.start,
    endDate: week.end,
  });

  const exams = useQuery(api.exams.upcoming, { childId, daysAhead: 14 });

  const markComplete = useMutation(api.homework.markComplete);

  const isLoading =
    homework === undefined ||
    classwork === undefined ||
    exams === undefined;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-6 w-48 rounded bg-border" />
        <div className="h-20 rounded-[var(--radius-md)] bg-border" />
        <div className="h-20 rounded-[var(--radius-md)] bg-border" />
      </div>
    );
  }

  // Group homework by due date
  const homeworkByDay = new Map<string, typeof homework>();
  for (const hw of homework) {
    const day = hw.dueDate;
    if (!homeworkByDay.has(day)) homeworkByDay.set(day, []);
    homeworkByDay.get(day)!.push(hw);
  }
  const sortedDays = [...homeworkByDay.keys()].sort();

  // Group classwork by date
  const classworkByDay = new Map<string, typeof classwork>();
  for (const cw of classwork) {
    const day = cw.entryDate;
    if (!classworkByDay.has(day)) classworkByDay.set(day, []);
    classworkByDay.get(day)!.push(cw);
  }

  // Stats
  const totalHw = homework.length;
  const completedHw = homework.filter((h) => h.isComplete).length;
  const pendingHw = totalHw - completedHw;
  const totalClasswork = classwork.length;
  const upcomingExams = exams.length;

  function toggleDay(day: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {showHeading && (
        <h2 className="text-lg font-bold text-text-primary border-b border-border pb-2">
          {childName}
        </h2>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-center">
          <div className="text-2xl font-bold text-error">{pendingHw}</div>
          <div className="text-xs text-text-secondary">Pending HW</div>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-center">
          <div className="text-2xl font-bold text-success">{completedHw}</div>
          <div className="text-xs text-text-secondary">Completed</div>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-center">
          <div className="text-2xl font-bold text-primary">
            {totalClasswork}
          </div>
          <div className="text-xs text-text-secondary">Topics Covered</div>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-center">
          <div className="text-2xl font-bold text-accent">
            {upcomingExams}
          </div>
          <div className="text-xs text-text-secondary">Upcoming Exams</div>
        </div>
      </div>

      {/* Day-by-day breakdown */}
      {sortedDays.length === 0 && classwork.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <BookOpen size={32} className="mb-2 text-text-disabled" />
          <p className="text-sm text-text-secondary">
            No homework or classwork recorded this week yet.
          </p>
          <p className="text-xs text-text-disabled mt-1">
            Upload a school PDF to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            This Week &mdash; {week.label}
          </h3>

          {/* Merge all dates from homework + classwork */}
          {(() => {
            const allDates = new Set([
              ...homeworkByDay.keys(),
              ...classworkByDay.keys(),
            ]);
            const sorted = [...allDates].sort();

            return sorted.map((day) => {
              const dayHw = homeworkByDay.get(day) ?? [];
              const dayCw = classworkByDay.get(day) ?? [];
              const isExpanded = expandedDays.has(day);
              const isToday = day === today;
              const completedCount = dayHw.filter((h) => h.isComplete).length;

              return (
                <div
                  key={day}
                  className={`rounded-[var(--radius-md)] border ${isToday ? "border-primary bg-primary-light" : "border-border bg-surface"}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleDay(day)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${isToday ? "text-primary" : "text-text-primary"}`}
                      >
                        {formatDay(day)}
                        {isToday && (
                          <span className="ml-2 text-xs font-normal text-primary">
                            Today
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-secondary">
                      {dayHw.length > 0 && (
                        <span>
                          {completedCount}/{dayHw.length} HW done
                        </span>
                      )}
                      {dayCw.length > 0 && (
                        <span>{dayCw.length} topics</span>
                      )}
                      {isExpanded ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3 space-y-3">
                      {/* Group everything by subject */}
                      {(() => {
                        const subjects = new Set([
                          ...dayHw.map((h) => h.subject),
                          ...dayCw.map((c) => c.subject),
                        ]);
                        const sorted = [...subjects].sort();

                        return sorted.map((subject) => {
                          const subjectHw = dayHw.filter(
                            (h) => h.subject === subject
                          );
                          const subjectCw = dayCw.filter(
                            (c) => c.subject === subject
                          );

                          return (
                            <div
                              key={subject}
                              className="rounded-[var(--radius-md)] border border-border bg-white overflow-hidden"
                            >
                              {/* Subject header */}
                              <div className="bg-primary/5 border-b border-border px-3 py-2">
                                <span className="text-xs font-bold text-primary uppercase tracking-wide">
                                  {subject}
                                </span>
                              </div>

                              <div className="px-3 py-2 space-y-2">
                                {/* Classwork: what was taught */}
                                {subjectCw.map((cw) => (
                                  <div key={cw._id}>
                                    <div className="flex items-center gap-1 text-xs font-medium text-text-secondary mb-0.5">
                                      <GraduationCap size={11} />
                                      In Class
                                    </div>
                                    <div className="text-sm text-text-primary">
                                      {cw.topicsCovered.join(", ")}
                                    </div>
                                    {cw.notes && (
                                      <div className="text-xs text-text-secondary mt-0.5">
                                        {cw.notes}
                                      </div>
                                    )}
                                  </div>
                                ))}

                                {/* Homework: what to do */}
                                {subjectHw.length > 0 ? (
                                  subjectHw.map((hw) => (
                                    <div
                                      key={hw._id}
                                      className={`flex items-start gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 -mx-1 ${hw.isComplete ? "bg-success/5" : "bg-error/5"}`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          markComplete({
                                            homeworkId: hw._id,
                                            isComplete: !hw.isComplete,
                                          })
                                        }
                                        className="mt-0.5 shrink-0"
                                      >
                                        {hw.isComplete ? (
                                          <CheckCircle
                                            size={16}
                                            className="text-success"
                                          />
                                        ) : (
                                          <Circle
                                            size={16}
                                            className="text-error hover:text-primary"
                                          />
                                        )}
                                      </button>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1 text-xs font-medium text-error mb-0.5">
                                          <BookOpen size={11} />
                                          Homework
                                        </div>
                                        <div
                                          className={`text-sm ${hw.isComplete ? "line-through text-text-disabled" : "text-text-primary font-medium"}`}
                                        >
                                          {hw.description}
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-xs text-text-disabled italic">
                                    No homework
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Upcoming exams reminder */}
      {exams.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2 flex items-center gap-1">
            <CalendarCheck size={14} />
            Upcoming Exams (next 14 days)
          </h3>
          <div className="space-y-2">
            {exams.map((exam) => {
              const daysUntil = Math.ceil(
                (new Date(exam.examDate + "T00:00:00").getTime() -
                  new Date(today + "T00:00:00").getTime()) /
                  (1000 * 60 * 60 * 24)
              );
              return (
                <div
                  key={exam._id}
                  className="flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-surface px-4 py-2.5"
                >
                  <div className="text-sm">
                    <span className="font-medium text-text-primary">
                      {exam.subject}
                    </span>
                    <span className="ml-2 text-xs text-text-disabled">
                      {exam.examType.replace("_", " ")}
                    </span>
                    {exam.portions.length > 0 && (
                      <div className="text-xs text-text-secondary mt-0.5">
                        {exam.portions.join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-sm font-medium text-text-primary">
                      {exam.examDate}
                    </div>
                    <div
                      className={`text-xs ${daysUntil <= 2 ? "text-error font-semibold" : "text-text-disabled"}`}
                    >
                      {daysUntil === 0
                        ? "Today!"
                        : daysUntil === 1
                          ? "Tomorrow"
                          : `${daysUntil} days`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function WeeklySummary() {
  const { selectedChildId, children: childList } = useChildContext();

  if (childList.length === 0) return null;

  // "All children" mode
  if (selectedChildId === null && childList.length > 1) {
    return (
      <div className="space-y-8">
        {childList.map((child) => (
          <ChildSummary
            key={child._id}
            childId={child._id}
            childName={child.name}
            showHeading={true}
          />
        ))}
      </div>
    );
  }

  const activeId = selectedChildId ?? childList[0]?._id;
  const activeChild = childList.find((c) => c._id === activeId);
  if (!activeId) return null;

  return (
    <ChildSummary
      childId={activeId}
      childName={activeChild?.name ?? "Your child"}
      showHeading={false}
    />
  );
}
