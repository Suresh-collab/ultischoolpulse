"use client";

import { useState } from "react";
import { differenceInDays, parseISO } from "date-fns";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubjectTag } from "./subject-tag";
import { cn } from "@/lib/utils";

type ExamCardProps = {
  subject: string;
  examType: string;
  examDate: string;
  portions: string[];
  isAcknowledged?: boolean;
  onAcknowledge?: () => void;
};

const examTypeLabels: Record<string, string> = {
  slip_test: "Slip Test",
  unit_test: "Unit Test",
  exam: "Exam",
  quiz: "Quiz",
  other: "Other",
};

export function ExamCard({
  subject,
  examType,
  examDate,
  portions,
  isAcknowledged,
  onAcknowledge,
}: ExamCardProps) {
  const [expanded, setExpanded] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examDateParsed = parseISO(examDate);
  const daysLeft = differenceInDays(examDateParsed, today);

  const daysChipColor =
    daysLeft <= 2
      ? "text-error bg-error-light"
      : daysLeft <= 7
        ? "text-warning bg-warning-light"
        : "text-text-secondary bg-bg";

  return (
    <Card variant="exam" padding="compact">
      <CardContent>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <SubjectTag subject={subject} />
              <Badge>{examTypeLabels[examType] ?? examType}</Badge>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-sm text-text-primary">{examDate}</span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  daysChipColor
                )}
              >
                {daysLeft === 0
                  ? "Today"
                  : daysLeft === 1
                    ? "Tomorrow"
                    : `${daysLeft} days`}
              </span>
            </div>
          </div>

          {onAcknowledge && !isAcknowledged && (
            <button
              onClick={onAcknowledge}
              className="shrink-0 rounded-[var(--radius-md)] border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-primary-light hover:text-primary transition-colors"
            >
              Acknowledge
            </button>
          )}
        </div>

        {portions.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-text-secondary hover:text-primary transition-colors"
            >
              <span>{portions.length} portion{portions.length !== 1 ? "s" : ""}</span>
              <ChevronDown
                size={12}
                className={cn("transition-transform", expanded && "rotate-180")}
              />
            </button>

            {expanded && (
              <ul className="mt-1.5 space-y-0.5 pl-3 text-sm text-text-primary">
                {portions.map((portion, i) => (
                  <li key={i} className="list-disc">
                    {portion}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
