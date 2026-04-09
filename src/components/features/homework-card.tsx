"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { SubjectTag } from "./subject-tag";
import { cn } from "@/lib/utils";

type HomeworkCardProps = {
  subject: string;
  description: string;
  dueDate: string;
  isComplete: boolean;
  onToggleComplete: (isComplete: boolean) => void;
};

export function HomeworkCard({
  subject,
  description,
  dueDate,
  isComplete,
  onToggleComplete,
}: HomeworkCardProps) {
  // Optimistic UI — update immediately before mutation resolves
  const [optimisticComplete, setOptimisticComplete] = useState(isComplete);

  const handleToggle = () => {
    const next = !optimisticComplete;
    setOptimisticComplete(next);
    onToggleComplete(next);
  };

  // Sync optimistic state when prop changes (mutation confirmed)
  if (isComplete !== optimisticComplete && isComplete !== !optimisticComplete) {
    setOptimisticComplete(isComplete);
  }

  return (
    <Card padding="compact">
      <CardContent className="flex items-start gap-3">
        <button
          onClick={handleToggle}
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border-2 border-border transition-colors hover:border-primary"
          aria-label={optimisticComplete ? "Mark incomplete" : "Mark complete"}
        >
          {optimisticComplete && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6L5 9L10 3"
                stroke="var(--color-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <SubjectTag subject={subject} />
            <span className="text-xs text-text-secondary">{dueDate}</span>
          </div>
          <p
            className={cn(
              "text-sm text-text-primary",
              optimisticComplete && "line-through text-text-disabled"
            )}
          >
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
