"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useChildContext } from "@/lib/child-context";
import { Card, CardContent } from "@/components/ui/card";
import { SubjectTag } from "@/components/features/subject-tag";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Clock, ChevronDown } from "lucide-react";
import { startOfWeek, subWeeks, format, addDays } from "date-fns";

function getWeekRanges(weeksBack: number): { start: string; end: string; label: string }[] {
  const ranges = [];
  const now = new Date();

  for (let i = 0; i < weeksBack; i++) {
    const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    ranges.push({
      start: format(weekStart, "yyyy-MM-dd"),
      end: format(weekEnd, "yyyy-MM-dd"),
      label:
        i === 0
          ? "This Week"
          : i === 1
            ? "Last Week"
            : `${format(weekStart, "MMM d")} — ${format(weekEnd, "MMM d")}`,
    });
  }

  return ranges;
}

type ClassworkItem = {
  _id: string;
  subject: string;
  topicsCovered: string[];
  entryDate: string;
};

function WeekSection({
  label,
  items,
}: {
  label: string;
  items: ClassworkItem[];
}) {
  // Group by subject
  const bySubject = useMemo(() => {
    const map = new Map<string, { topics: string[]; dates: string[] }>();
    for (const item of items) {
      const existing = map.get(item.subject) ?? { topics: [], dates: [] };
      existing.topics.push(...item.topicsCovered);
      if (!existing.dates.includes(item.entryDate)) {
        existing.dates.push(item.entryDate);
      }
      map.set(item.subject, existing);
    }
    return Array.from(map.entries());
  }, [items]);

  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
        {label}
      </h3>
      {bySubject.map(([subject, data]) => (
        <Card key={subject} padding="compact">
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <SubjectTag subject={subject} />
              <span className="text-xs text-text-disabled">
                {data.dates.length} day{data.dates.length !== 1 ? "s" : ""}
              </span>
            </div>
            <ul className="space-y-1 pl-4">
              {[...new Set(data.topics)].map((topic, i) => (
                <li key={i} className="list-disc text-sm text-text-primary">
                  {topic}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export default function HistoryContent() {
  const { selectedChildId } = useChildContext();
  const [weeksToShow, setWeeksToShow] = useState(4);

  const weekRanges = useMemo(() => getWeekRanges(weeksToShow), [weeksToShow]);

  // Use the full date range for a single query
  const fullStart = weekRanges[weekRanges.length - 1]?.start ?? "";
  const fullEnd = weekRanges[0]?.end ?? "";

  const allClasswork = useQuery(
    api.classwork.forChildByDateRange,
    selectedChildId && fullStart
      ? { childId: selectedChildId, startDate: fullStart, endDate: fullEnd }
      : "skip"
  );

  const isLoading = allClasswork === undefined;

  // Split classwork into week buckets
  const weekBuckets = useMemo(() => {
    if (!allClasswork) return [];
    return weekRanges.map((range) => ({
      ...range,
      items: allClasswork.filter(
        (item: ClassworkItem) =>
          item.entryDate >= range.start && item.entryDate <= range.end
      ),
    }));
  }, [allClasswork, weekRanges]);

  const hasAnyData = weekBuckets.some((w) => w.items.length > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">History</h1>

      {!selectedChildId ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Clock size={32} className="mb-2 text-text-disabled" />
          <p className="text-sm text-text-secondary">
            Add a child in Settings to see classwork history
          </p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3 max-w-xl">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : !hasAnyData ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Clock size={32} className="mb-2 text-text-disabled" />
          <p className="text-sm text-text-secondary">
            No classwork recorded yet — start dropping PDFs to see what&apos;s been covered.
          </p>
        </div>
      ) : (
        <div className="space-y-8 max-w-xl">
          {weekBuckets.map((week) => (
            <WeekSection
              key={week.start}
              label={week.label}
              items={week.items}
            />
          ))}

          <Button
            variant="secondary"
            onClick={() => setWeeksToShow((prev) => prev + 4)}
            className="w-full"
          >
            <ChevronDown size={14} className="mr-1" />
            Load earlier
          </Button>
        </div>
      )}
    </div>
  );
}
