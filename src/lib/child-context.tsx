"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { Id } from "../../convex/_generated/dataModel";

type Child = {
  _id: Id<"children">;
  name: string;
  schoolName: string;
  grade?: string;
};

type ChildContextValue = {
  children: Child[];
  selectedChildId: Id<"children"> | null;
  setSelectedChildId: (id: Id<"children"> | null) => void;
  setChildren: (children: Child[]) => void;
};

const ChildContext = createContext<ChildContextValue | null>(null);

export function ChildProvider({ children: reactChildren }: { children: React.ReactNode }) {
  const [childList, setChildList] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<Id<"children"> | null>(null);

  const setChildren = useCallback((newChildren: Child[]) => {
    setChildList(newChildren);
    // Auto-select first child if none selected or selected was removed
    if (newChildren.length > 0 && (!selectedChildId || !newChildren.find(c => c._id === selectedChildId))) {
      setSelectedChildId(newChildren[0]._id);
    }
    if (newChildren.length === 0) {
      setSelectedChildId(null);
    }
  }, [selectedChildId]);

  return (
    <ChildContext.Provider value={{
      children: childList,
      selectedChildId,
      setSelectedChildId,
      setChildren,
    }}>
      {reactChildren}
    </ChildContext.Provider>
  );
}

export function useChildContext() {
  const ctx = useContext(ChildContext);
  if (!ctx) throw new Error("useChildContext must be used within a ChildProvider");
  return ctx;
}
