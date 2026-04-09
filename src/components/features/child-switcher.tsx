"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useChildContext } from "@/lib/child-context";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function ChildSwitcher() {
  const { children, selectedChildId, setSelectedChildId } = useChildContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Loading state
  if (children.length === 0) {
    return <Skeleton className="h-9 w-28" />;
  }

  // Single child — hide switcher
  if (children.length === 1) {
    return null;
  }

  const selected = children.find((c) => c._id === selectedChildId);
  const displayName = selected?.name ?? "Select child";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-primary-light transition-colors"
      >
        <span>{displayName}</span>
        <ChevronDown
          size={14}
          className={cn(
            "text-text-secondary transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-[var(--radius-md)] border border-border bg-surface py-1 shadow-md">
          {children.map((child) => (
            <button
              key={child._id}
              onClick={() => {
                setSelectedChildId(child._id);
                setOpen(false);
              }}
              className={cn(
                "w-full px-3 py-2 text-left text-sm transition-colors",
                child._id === selectedChildId
                  ? "bg-primary-light text-primary font-medium"
                  : "text-text-primary hover:bg-primary-light"
              )}
            >
              {child.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
