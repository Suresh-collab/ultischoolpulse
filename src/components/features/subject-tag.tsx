"use client";

import { Badge } from "@/components/ui/badge";

// 6 predefined subject colors cycling by hash
const SUBJECT_COLORS = [
  "#0F7B6C", // teal
  "#3B5BDB", // blue
  "#D97706", // amber
  "#7C3AED", // purple
  "#DC2626", // red
  "#059669", // emerald
];

function hashSubject(subject: string): number {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = (hash << 5) - hash + subject.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function SubjectTag({ subject }: { subject: string }) {
  const color = SUBJECT_COLORS[hashSubject(subject) % SUBJECT_COLORS.length];
  return <Badge color={color}>{subject}</Badge>;
}
