"use client";

import { ChevronDown } from "lucide-react";

export function ChildSwitcher() {
  return (
    <button className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-primary-light transition-colors">
      <span>All Children</span>
      <ChevronDown size={14} className="text-text-secondary" />
    </button>
  );
}
