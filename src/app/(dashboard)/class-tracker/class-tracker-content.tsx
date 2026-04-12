"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useChildContext } from "@/lib/child-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubjectTag } from "@/components/features/subject-tag";
import { SkeletonCard } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import {
  BookOpen,
  ClipboardList,
  CalendarCheck,
  BarChart3,
  Download,
  Check,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";

type Tab = "daily-log" | "homework" | "exams" | "summary";

const TABS: { key: Tab; label: string; icon: typeof BookOpen }[] = [
  { key: "daily-log", label: "Daily Class Log", icon: BookOpen },
  { key: "homework", label: "Homework Tracker", icon: ClipboardList },
  { key: "exams", label: "Exams & Tests", icon: CalendarCheck },
  { key: "summary", label: "Subject Summary", icon: BarChart3 },
];

// Subject background colors matching CLAUDE_Daily Transaction.md spec
const SUBJ_BG: Record<string, string> = {
  English: "#D9E1F2",
  Science: "#E2EFDA",
  Math: "#FFF2CC",
  Maths: "#FFF2CC",
  Mathematics: "#FFF2CC",
  "Social Science": "#FCE4D6",
  "Social Studies": "#FCE4D6",
  Social: "#FCE4D6",
  Hindi: "#F4CCFF",
  "Hindi (2L)": "#F4CCFF",
  "Hindi (3L)": "#F4CCFF",
  "2L Hindi": "#F4CCFF",
  Telugu: "#D0E4FF",
  "Telugu (2L)": "#D0E4FF",
  "Telugu (3L)": "#D0E4FF",
  "2L Telugu": "#D0E4FF",
  "Kannada (2L)": "#D0E4FF",
  "Tamil (2L)": "#D0E4FF",
  Art: "#FFE0CC",
  "Art & Craft": "#FFE0CC",
  Computer: "#E0F7FA",
  Computers: "#E0F7FA",
  "Computer Science": "#E0F7FA",
  Library: "#F5F5DC",
  Yoga: "#E8F5E9",
  "Western Dance": "#FDE9D9",
  "Classical Dance": "#FDE9D9",
  Music: "#EDE7F6",
  Sports: "#E8F5E9",
  PT: "#E8F5E9",
  EVS: "#E2EFDA",
  "General Knowledge": "#F5F5DC",
  "Moral Science": "#EDE7F6",
};

function getSubjectBg(subject: string): string {
  return SUBJ_BG[subject] || "#F9FAFB";
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "dd-MMM-yyyy");
  } catch {
    return dateStr;
  }
}

function getDayName(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "EEEE");
  } catch {
    return "";
  }
}

function formatExamType(type: string): string {
  const map: Record<string, string> = {
    slip_test: "Slip Test",
    unit_test: "Unit Test",
    exam: "Exam",
    quiz: "Quiz",
    other: "Other",
  };
  return map[type] || type;
}

// ─── Daily Class Log Tab ───

function DailyLogTab({
  classwork,
}: {
  classwork: any[];
}) {
  // Sort by date ascending
  const sorted = useMemo(
    () =>
      [...classwork].sort((a, b) =>
        a.entryDate.localeCompare(b.entryDate)
      ),
    [classwork]
  );

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        message="No classwork recorded yet. Upload Daily Transaction PDFs to see what was taught."
      />
    );
  }

  // Group by date
  const dateGroups = useMemo(() => {
    const groups: { date: string; items: typeof sorted }[] = [];
    let currentDate = "";
    let currentGroup: typeof sorted = [];

    for (const item of sorted) {
      if (item.entryDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, items: currentGroup });
        }
        currentDate = item.entryDate;
        currentGroup = [item];
      } else {
        currentGroup.push(item);
      }
    }
    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, items: currentGroup });
    }
    return groups;
  }, [sorted]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#2E75B6] text-white">
            <th className="px-3 py-2.5 text-left font-semibold w-28">Date</th>
            <th className="px-3 py-2.5 text-left font-semibold w-24">Day</th>
            <th className="px-3 py-2.5 text-left font-semibold w-36">Subject</th>
            <th className="px-3 py-2.5 text-left font-semibold">
              Class Transaction / Topics Covered
            </th>
          </tr>
        </thead>
        <tbody>
          {dateGroups.map((group) =>
            group.items.map((item, idx) => (
              <tr
                key={item._id}
                style={{ backgroundColor: getSubjectBg(item.subject) }}
                className="border-b border-[#BFBFBF]"
              >
                <td className="px-3 py-2.5 font-medium">
                  {idx === 0 ? formatDate(group.date) : ""}
                </td>
                <td className="px-3 py-2.5">
                  {idx === 0 ? getDayName(group.date) : ""}
                </td>
                <td className="px-3 py-2.5">
                  <SubjectTag subject={item.subject} />
                </td>
                <td className="px-3 py-2.5 whitespace-pre-wrap">
                  {item.topicsCovered.join("; ")}
                  {item.notes && (
                    <span className="text-text-secondary ml-1">
                      — {item.notes}
                    </span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Homework Tracker Tab ───

function HomeworkTab({ homework }: { homework: any[] }) {
  const markComplete = useMutation(api.homework.markComplete);

  const sorted = useMemo(
    () =>
      [...homework].sort((a, b) =>
        b.assignedDate.localeCompare(a.assignedDate)
      ),
    [homework]
  );

  const stats = useMemo(() => {
    const total = sorted.length;
    const completed = sorted.filter((h) => h.isComplete).length;
    const pending = total - completed;
    return { total, completed, pending };
  }, [sorted]);

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        message="No homework recorded yet. Homework will appear here when PDFs are processed."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex gap-3 flex-wrap">
        <StatBadge label="Total" value={stats.total} color="bg-info-light text-info" />
        <StatBadge
          label="Pending"
          value={stats.pending}
          color="bg-warning-light text-warning"
        />
        <StatBadge
          label="Completed"
          value={stats.completed}
          color="bg-success-light text-success"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#2E75B6] text-white">
              <th className="px-3 py-2.5 text-left font-semibold w-28">
                Date Assigned
              </th>
              <th className="px-3 py-2.5 text-left font-semibold w-32">
                Subject
              </th>
              <th className="px-3 py-2.5 text-left font-semibold">
                Homework Description
              </th>
              <th className="px-3 py-2.5 text-left font-semibold w-28">
                Due Date
              </th>
              <th className="px-3 py-2.5 text-center font-semibold w-28">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr
                key={item._id}
                className="border-b border-[#BFBFBF]"
                style={{ backgroundColor: getSubjectBg(item.subject) }}
              >
                <td className="px-3 py-2.5">
                  {formatDate(item.assignedDate)}
                </td>
                <td className="px-3 py-2.5">
                  <SubjectTag subject={item.subject} />
                </td>
                <td className="px-3 py-2.5 whitespace-pre-wrap">
                  {item.description}
                </td>
                <td className="px-3 py-2.5">{formatDate(item.dueDate)}</td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() =>
                      markComplete({
                        homeworkId: item._id,
                        isComplete: !item.isComplete,
                      })
                    }
                    className={cn(
                      "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer",
                      item.isComplete
                        ? "bg-[#C6EFCE] text-[#2E6B3A]"
                        : "bg-[#FFE699] text-[#7D5A00] hover:bg-[#FFD54F]"
                    )}
                  >
                    {item.isComplete ? (
                      <>
                        <Check size={12} /> Completed
                      </>
                    ) : (
                      <>
                        <Clock size={12} /> Pending
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Exams & Tests Tab ───

function ExamsTab({ exams }: { exams: any[] }) {
  const acknowledge = useMutation(api.exams.acknowledge);
  const today = new Date().toISOString().split("T")[0];

  const sorted = useMemo(
    () => [...exams].sort((a, b) => a.examDate.localeCompare(b.examDate)),
    [exams]
  );

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        message="No exams or tests recorded yet. They will appear here when mentioned in Daily Transaction PDFs."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#C0504D] text-white">
            <th className="px-3 py-2.5 text-left font-semibold w-28">
              Announced On
            </th>
            <th className="px-3 py-2.5 text-left font-semibold w-32">
              Subject
            </th>
            <th className="px-3 py-2.5 text-left font-semibold w-28">
              Type
            </th>
            <th className="px-3 py-2.5 text-left font-semibold w-28">
              Exam Date
            </th>
            <th className="px-3 py-2.5 text-left font-semibold">
              Topics to Cover
            </th>
            <th className="px-3 py-2.5 text-center font-semibold w-32">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => {
            const isPast = item.examDate < today;
            return (
              <tr
                key={item._id}
                className={cn(
                  "border-b border-[#BFBFBF]",
                  isPast && "opacity-60"
                )}
                style={{ backgroundColor: "#FCE4D6" }}
              >
                <td className="px-3 py-2.5">
                  {formatDate(item.announcedDate)}
                </td>
                <td className="px-3 py-2.5">
                  <SubjectTag subject={item.subject} />
                </td>
                <td className="px-3 py-2.5">
                  {formatExamType(item.examType)}
                </td>
                <td className="px-3 py-2.5 font-medium">
                  {formatDate(item.examDate)}
                </td>
                <td className="px-3 py-2.5 whitespace-pre-wrap">
                  {item.portions.join("; ")}
                </td>
                <td className="px-3 py-2 text-center">
                  {item.isAcknowledged ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#C6EFCE] text-[#2E6B3A]">
                      <Check size={12} /> Acknowledged
                    </span>
                  ) : (
                    <button
                      onClick={() => acknowledge({ examId: item._id })}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#FFC7CE] text-[#9C2D2D] hover:bg-[#FFB3B3] transition-colors cursor-pointer"
                    >
                      <AlertTriangle size={12} /> Not Prepared
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Subject Summary Tab ───

function SummaryTab({
  classwork,
  homework,
}: {
  classwork: any[];
  homework: any[];
}) {
  const summaryData = useMemo(() => {
    const map = new Map<
      string,
      {
        topics: Set<string>;
        hasHomework: boolean;
        hwCount: number;
        hwDescriptions: string[];
        dates: Set<string>;
      }
    >();

    for (const item of classwork) {
      const existing = map.get(item.subject) ?? {
        topics: new Set<string>(),
        hasHomework: false,
        hwCount: 0,
        hwDescriptions: [],
        dates: new Set<string>(),
      };
      item.topicsCovered.forEach((t: string) => existing.topics.add(t));
      existing.dates.add(item.entryDate);
      map.set(item.subject, existing);
    }

    for (const item of homework) {
      const existing = map.get(item.subject) ?? {
        topics: new Set<string>(),
        hasHomework: false,
        hwCount: 0,
        hwDescriptions: [],
        dates: new Set<string>(),
      };
      existing.hasHomework = true;
      existing.hwCount++;
      existing.hwDescriptions.push(item.description);
      map.set(item.subject, existing);
    }

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [classwork, homework]);

  if (summaryData.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        message="No subjects recorded yet. Upload PDFs to see a subject-wise summary."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#375623] text-white">
            <th className="px-3 py-2.5 text-left font-semibold w-36">
              Subject
            </th>
            <th className="px-3 py-2.5 text-left font-semibold">
              Topics Covered
            </th>
            <th className="px-3 py-2.5 text-center font-semibold w-32">
              Homework Given?
            </th>
            <th className="px-3 py-2.5 text-left font-semibold w-60">
              Action for Parent
            </th>
          </tr>
        </thead>
        <tbody>
          {summaryData.map(([subject, data]) => {
            const topicsList = [...data.topics];
            const hwGiven = data.hasHomework;
            const parentAction = hwGiven
              ? `Check ${data.hwCount} homework item(s) for completion. Review topics with child.`
              : "Review topics covered in class with child.";

            return (
              <tr
                key={subject}
                className="border-b border-[#BFBFBF] align-top"
                style={{ backgroundColor: getSubjectBg(subject) }}
              >
                <td className="px-3 py-3">
                  <SubjectTag subject={subject} />
                  <div className="text-xs text-text-disabled mt-1">
                    {data.dates.size} day{data.dates.size !== 1 ? "s" : ""}
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-pre-wrap">
                  <ul className="space-y-0.5 list-disc pl-4">
                    {topicsList.map((topic, i) => (
                      <li key={i}>{topic}</li>
                    ))}
                  </ul>
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={cn(
                      "inline-block px-3 py-1 rounded-full text-xs font-bold",
                      hwGiven
                        ? "bg-[#E2EFDA] text-[#375623]"
                        : "bg-[#F2F2F2] text-[#595959]"
                    )}
                  >
                    {hwGiven ? `Yes — ${data.hwCount}` : "No HW"}
                  </span>
                </td>
                <td className="px-3 py-3 text-text-secondary">
                  {parentAction}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Shared Components ───

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: typeof BookOpen;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <Icon size={32} className="mb-2 text-text-disabled" />
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium",
        color
      )}
    >
      <span className="font-bold">{value}</span>
      <span>{label}</span>
    </div>
  );
}

// ─── Main Component ───

export default function ClassTrackerContent() {
  const { selectedChildId, children } = useChildContext();
  const [activeTab, setActiveTab] = useState<Tab>("daily-log");

  const selectedChild = children.find((c) => c._id === selectedChildId);

  const classwork = useQuery(
    api.classTracker.dailyClassLog,
    selectedChildId ? { childId: selectedChildId } : "skip"
  );

  const homework = useQuery(
    api.classTracker.allHomework,
    selectedChildId ? { childId: selectedChildId } : "skip"
  );

  const exams = useQuery(
    api.classTracker.allExams,
    selectedChildId ? { childId: selectedChildId } : "skip"
  );

  const isLoading =
    classwork === undefined || homework === undefined || exams === undefined;

  const handleDownload = async () => {
    if (!classwork || !homework || !exams || !selectedChild) return;
    const { generateClassTrackerExcel } = await import(
      "@/lib/excel-download"
    );
    generateClassTrackerExcel(
      classwork,
      homework,
      exams,
      selectedChild.name,
      selectedChild.schoolName
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <FileSpreadsheet size={24} />
            Class Tracker
          </h1>
          {selectedChild && (
            <p className="text-sm text-text-secondary mt-1">
              {selectedChild.name} — {selectedChild.schoolName}
              {selectedChild.grade && ` | Grade ${selectedChild.grade}`}
            </p>
          )}
        </div>

        {selectedChildId && !isLoading && (
          <Button variant="secondary" size="compact" onClick={handleDownload}>
            <Download size={14} className="mr-1.5" />
            Download Excel
          </Button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-[var(--radius-md)] border border-border p-1 bg-surface">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                activeTab === tab.key
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:text-text-primary hover:bg-primary-light"
              )}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">
                {tab.label.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {!selectedChildId ? (
        <EmptyState
          icon={FileSpreadsheet}
          message="Select a child to view their class tracker, or add a child in Settings."
        />
      ) : isLoading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <Card>
          <CardContent>
            {activeTab === "daily-log" && (
              <DailyLogTab classwork={classwork ?? []} />
            )}
            {activeTab === "homework" && (
              <HomeworkTab homework={homework ?? []} />
            )}
            {activeTab === "exams" && (
              <ExamsTab exams={exams ?? []} />
            )}
            {activeTab === "summary" && (
              <SummaryTab
                classwork={classwork ?? []}
                homework={homework ?? []}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
