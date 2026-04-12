"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import type { Id } from "../../convex/_generated/dataModel";

type Child = {
  _id: Id<"children">;
  name: string;
  schoolName: string;
  grade?: string;
  pendingTutorInvites?: string[];
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
  const selectedChildIdRef = useRef(selectedChildId);
  selectedChildIdRef.current = selectedChildId;

  const setChildren = useCallback((newChildren: Child[]) => {
    setChildList(newChildren);
    // Auto-select: single child → select it; multiple → null (All) unless already valid
    const currentSelected = selectedChildIdRef.current;
    if (newChildren.length === 1) {
      setSelectedChildId(newChildren[0]._id);
    } else if (newChildren.length > 1 && currentSelected !== null && !newChildren.find(c => c._id === currentSelected)) {
      setSelectedChildId(null);
    }
    if (newChildren.length === 0) {
      setSelectedChildId(null);
    }
  }, []);

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
