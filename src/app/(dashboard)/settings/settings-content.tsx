"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useChildContext } from "@/lib/child-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Plus, UserPlus } from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";

function ProfileSection() {
  const currentUser = useQuery(api.users.getCurrent);
  const updateProfile = useMutation(api.users.updateProfile);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (currentUser) setName(currentUser.name);
  }, [currentUser]);

  const handleSave = async () => {
    if (name.trim()) {
      await updateProfile({ name: name.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-primary">
            Display name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <Button onClick={handleSave} size="compact">
          {saved ? (
            <>
              <Check size={14} className="mr-1" /> Saved
            </>
          ) : (
            "Save"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function ChildrenSection() {
  const { children } = useChildContext();
  const updateChild = useMutation(api.children.update);
  const createChild = useMutation(api.children.create);
  const addTutor = useMutation(api.children.addTutor);

  const [editingId, setEditingId] = useState<Id<"children"> | null>(null);
  const [editName, setEditName] = useState("");
  const [editSchool, setEditSchool] = useState("");
  const [editGrade, setEditGrade] = useState("");

  const [tutorEmails, setTutorEmails] = useState<Record<string, string>>({});
  const [tutorStatus, setTutorStatus] = useState<Record<string, string>>({});

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSchool, setNewSchool] = useState("");
  const [newGrade, setNewGrade] = useState("");

  const startEdit = (child: (typeof children)[0]) => {
    setEditingId(child._id);
    setEditName(child.name);
    setEditSchool(child.schoolName);
    setEditGrade(child.grade ?? "");
  };

  const saveEdit = async () => {
    if (editingId && editName.trim() && editSchool.trim()) {
      await updateChild({
        childId: editingId,
        name: editName.trim(),
        schoolName: editSchool.trim(),
        grade: editGrade.trim() || undefined,
      });
      setEditingId(null);
    }
  };

  const handleAddChild = async () => {
    if (newName.trim() && newSchool.trim()) {
      await createChild({
        name: newName.trim(),
        schoolName: newSchool.trim(),
        grade: newGrade.trim() || undefined,
      });
      setNewName("");
      setNewSchool("");
      setNewGrade("");
      setShowAdd(false);
    }
  };

  const handleAddTutor = async (childId: Id<"children">) => {
    const email = tutorEmails[childId]?.trim();
    if (!email) return;

    const result = await addTutor({ childId, tutorEmail: email });
    setTutorStatus((prev) => ({
      ...prev,
      [childId]:
        result.status === "linked"
          ? "Tutor linked!"
          : "Invite sent (they'll need to sign up)",
    }));
    setTutorEmails((prev) => ({ ...prev, [childId]: "" }));
    setTimeout(() => {
      setTutorStatus((prev) => ({ ...prev, [childId]: "" }));
    }, 3000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Children</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {children.map((child) => (
          <div
            key={child._id}
            className="rounded-[var(--radius-md)] border border-border p-4 space-y-3"
          >
            {editingId === child._id ? (
              <div className="space-y-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Child's name"
                />
                <Input
                  value={editSchool}
                  onChange={(e) => setEditSchool(e.target.value)}
                  placeholder="School name"
                />
                <Input
                  value={editGrade}
                  onChange={(e) => setEditGrade(e.target.value)}
                  placeholder="Grade (optional)"
                />
                <div className="flex gap-2">
                  <Button onClick={saveEdit} size="compact">
                    Save
                  </Button>
                  <Button
                    onClick={() => setEditingId(null)}
                    variant="secondary"
                    size="compact"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-primary">{child.name}</p>
                  <p className="text-sm text-text-secondary">
                    {child.schoolName}
                    {child.grade ? ` — ${child.grade}` : ""}
                  </p>
                </div>
                <Button
                  onClick={() => startEdit(child)}
                  variant="secondary"
                  size="compact"
                >
                  Edit
                </Button>
              </div>
            )}

            {/* Add tutor */}
            <div className="flex items-center gap-2">
              <Input
                value={tutorEmails[child._id] ?? ""}
                onChange={(e) =>
                  setTutorEmails((prev) => ({
                    ...prev,
                    [child._id]: e.target.value,
                  }))
                }
                placeholder="Tutor's email"
                className="text-sm"
              />
              <Button
                onClick={() => handleAddTutor(child._id)}
                variant="secondary"
                size="compact"
              >
                <UserPlus size={14} />
              </Button>
            </div>
            {tutorStatus[child._id] && (
              <p className="text-xs text-success">{tutorStatus[child._id]}</p>
            )}
          </div>
        ))}

        {showAdd ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-border p-4 space-y-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Child's name"
            />
            <Input
              value={newSchool}
              onChange={(e) => setNewSchool(e.target.value)}
              placeholder="School name"
            />
            <Input
              value={newGrade}
              onChange={(e) => setNewGrade(e.target.value)}
              placeholder="Grade (optional)"
            />
            <div className="flex gap-2">
              <Button onClick={handleAddChild} size="compact">
                Add
              </Button>
              <Button
                onClick={() => setShowAdd(false)}
                variant="secondary"
                size="compact"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-border py-2.5 text-sm text-text-secondary hover:border-primary hover:text-primary transition-colors"
          >
            <Plus size={14} />
            Add child
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function DigestSection() {
  const currentUser = useQuery(api.users.getCurrent);
  const updateDigest = useMutation(api.users.updateDigestSettings);
  const [saved, setSaved] = useState(false);

  const [digestEnabled, setDigestEnabled] = useState(true);
  const [digestTime, setDigestTime] = useState("morning");

  useEffect(() => {
    if (currentUser) {
      setDigestEnabled(currentUser.digestEnabled);
      setDigestTime(currentUser.digestTime);
    }
  }, [currentUser]);

  const handleSave = async () => {
    await updateDigest({ digestEnabled, digestTime });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Digest</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">
              Email digest
            </p>
            <p className="text-xs text-text-secondary">
              Get a daily summary of homework and upcoming exams
            </p>
          </div>
          <button
            onClick={() => setDigestEnabled(!digestEnabled)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              digestEnabled ? "bg-primary" : "bg-border"
            }`}
            role="switch"
            aria-checked={digestEnabled}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-sm ${
                digestEnabled ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>

        {digestEnabled && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">
              Delivery time
            </label>
            <div className="flex rounded-[var(--radius-md)] border border-border p-1">
              <button
                onClick={() => setDigestTime("morning")}
                className={`flex-1 rounded-[var(--radius-sm)] py-2 text-sm font-medium transition-colors ${
                  digestTime === "morning"
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Morning (6 AM)
              </button>
              <button
                onClick={() => setDigestTime("evening")}
                className={`flex-1 rounded-[var(--radius-sm)] py-2 text-sm font-medium transition-colors ${
                  digestTime === "evening"
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Evening (6 PM)
              </button>
            </div>
          </div>
        )}

        <Button onClick={handleSave} size="compact">
          {saved ? (
            <>
              <Check size={14} className="mr-1" /> Saved
            </>
          ) : (
            "Save digest settings"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function SettingsContent() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <ProfileSection />
          <DigestSection />
        </div>
        <ChildrenSection />
      </div>
    </div>
  );
}
