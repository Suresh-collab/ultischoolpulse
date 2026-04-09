"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";

type ChildForm = {
  name: string;
  schoolName: string;
  grade: string;
};

const emptyChild = (): ChildForm => ({ name: "", schoolName: "", grade: "" });

export default function ChildContent() {
  const router = useRouter();
  const createChild = useMutation(api.children.create);

  const [children, setChildren] = useState<ChildForm[]>([emptyChild()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateChild = (idx: number, field: keyof ChildForm, value: string) => {
    setChildren((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  };

  const addChild = () => setChildren((prev) => [...prev, emptyChild()]);

  const removeChild = (idx: number) => {
    if (children.length > 1) {
      setChildren((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const handleNext = async () => {
    // Validate at least one child has name + school
    const valid = children.filter(
      (c) => c.name.trim() && c.schoolName.trim()
    );
    if (valid.length === 0) {
      setError("Please add at least one child with a name and school.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      for (const child of valid) {
        await createChild({
          name: child.name.trim(),
          schoolName: child.schoolName.trim(),
          grade: child.grade.trim() || undefined,
        });
      }
      router.push("/onboarding/folder");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-center gap-2">
        <div className="h-2 w-8 rounded-full bg-primary" />
        <div className="h-2 w-8 rounded-full bg-primary" />
        <div className="h-2 w-8 rounded-full bg-border" />
      </div>

      <Card>
        <CardContent className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-text-primary">
              Add your child
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Tell us about your child so we can organize their school updates.
            </p>
          </div>

          {children.map((child, idx) => (
            <div
              key={idx}
              className="space-y-3 rounded-[var(--radius-md)] border border-border p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-secondary">
                  Child {idx + 1}
                </span>
                {children.length > 1 && (
                  <button
                    onClick={() => removeChild(idx)}
                    className="text-text-secondary hover:text-error transition-colors"
                    aria-label="Remove child"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-primary">
                  Child&apos;s name
                </label>
                <Input
                  value={child.name}
                  onChange={(e) => updateChild(idx, "name", e.target.value)}
                  placeholder="e.g. Arjun"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-primary">
                  School name
                </label>
                <Input
                  value={child.schoolName}
                  onChange={(e) =>
                    updateChild(idx, "schoolName", e.target.value)
                  }
                  placeholder="e.g. Delhi Public School"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-primary">
                  Grade{" "}
                  <span className="text-text-secondary font-normal">
                    (optional)
                  </span>
                </label>
                <Input
                  value={child.grade}
                  onChange={(e) => updateChild(idx, "grade", e.target.value)}
                  placeholder="e.g. Grade 5"
                />
              </div>
            </div>
          ))}

          <button
            onClick={addChild}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-border py-2.5 text-sm text-text-secondary hover:border-primary hover:text-primary transition-colors"
          >
            <Plus size={14} />
            Add another child
          </button>

          {error && (
            <p className="text-sm text-error">{error}</p>
          )}

          <Button
            onClick={handleNext}
            disabled={saving}
            className="w-full"
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
