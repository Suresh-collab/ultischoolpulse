"use client";

import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useChildContext } from "@/lib/child-context";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

type FileUploadState = {
  name: string;
  status: "queued" | "uploading" | "success" | "error";
  error?: string;
};

export function PdfUpload() {
  const { selectedChildId, children: childList } = useChildContext();
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
  const createEntry = useMutation(api.uploads.createEntryFromUpload);

  const targetChildId: Id<"children"> | null =
    selectedChildId ?? (childList.length === 1 ? childList[0]._id : null);

  // Upload history for the selected child
  const recentEntries = useQuery(
    api.schoolEntries.listForChild,
    targetChildId ? { childId: targetChildId, limit: 10 } : "skip"
  );

  if (childList.length === 0) return null;

  async function uploadSingleFile(file: File, index: number) {
    setFiles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], status: "uploading" };
      return next;
    });

    try {
      // Extract text from PDF in the browser using pdfjs-dist
      let extractedText = "";
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map((item: any) => item.str).join(" "));
        }
        extractedText = pages.join("\n").trim();
        console.log("[pdf-upload] Extracted text length:", extractedText.length);
        if (extractedText.length > 0) {
          console.log("[pdf-upload] First 200 chars:", extractedText.substring(0, 200));
        }
      } catch (extractErr) {
        console.error("[pdf-upload] Browser PDF extraction failed:", extractErr);
      }

      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) throw new Error("Upload failed");

      const { storageId } = await result.json();

      await createEntry({
        childId: targetChildId!,
        fileName: file.name,
        storageId,
        extractedText: extractedText || undefined,
      });

      setFiles((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], status: "success" };
        return next;
      });
    } catch (err: any) {
      setFiles((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          status: "error",
          error: err?.message ?? "Upload failed",
        };
        return next;
      });
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length === 0) return;

    const invalidFiles = selectedFiles.filter(
      (f) => f.type !== "application/pdf"
    );
    if (invalidFiles.length > 0) {
      alert(
        `Only PDF files are supported. Skipped: ${invalidFiles.map((f) => f.name).join(", ")}`
      );
    }

    const validFiles = selectedFiles.filter(
      (f) => f.type === "application/pdf" && f.size <= 20 * 1024 * 1024
    );
    if (validFiles.length === 0) return;

    if (!targetChildId) {
      alert("Please select a child first.");
      return;
    }

    const initialStates: FileUploadState[] = validFiles.map((f) => ({
      name: f.name,
      status: "queued",
    }));
    setFiles(initialStates);
    setIsUploading(true);

    // Upload all files concurrently
    await Promise.all(
      validFiles.map((file, index) => uploadSingleFile(file, index))
    );

    setIsUploading(false);

    // Clear after 4 seconds if all succeeded
    setTimeout(() => {
      setFiles((prev) => {
        if (prev.every((f) => f.status === "success")) return [];
        return prev;
      });
    }, 4000);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDismiss() {
    if (!isUploading) {
      setFiles([]);
    }
  }

  const statusIcon = {
    pending: <Loader2 size={14} className="animate-spin text-info" />,
    processing: <Loader2 size={14} className="animate-spin text-info" />,
    complete: <CheckCircle size={14} className="text-success" />,
    failed: <AlertCircle size={14} className="text-error" />,
    low_confidence: <AlertCircle size={14} className="text-warning" />,
  };

  const statusLabel: Record<string, string> = {
    pending: "Queued",
    processing: "Processing...",
    complete: "Done",
    failed: "Failed",
    low_confidence: "Partial",
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface">
      {/* Upload area */}
      <div className="p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Upload school PDFs"
        />

        {files.length === 0 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed border-border py-5 text-sm text-text-secondary transition-colors hover:border-primary hover:bg-primary-light hover:text-primary"
          >
            <Upload size={18} />
            <span>
              Upload school PDFs
              {targetChildId && childList.length > 1
                ? ` for ${childList.find((c) => c._id === targetChildId)?.name ?? "child"}`
                : ""}
            </span>
          </button>
        )}

        {/* Active upload progress */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">
                {isUploading
                  ? `Uploading ${files.filter((f) => f.status === "uploading" || f.status === "queued").length} of ${files.length}...`
                  : `${files.filter((f) => f.status === "success").length}/${files.length} uploaded`}
              </span>
              {!isUploading && (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-text-disabled hover:text-text-secondary"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs text-text-secondary"
              >
                {f.status === "queued" && (
                  <div className="h-3.5 w-3.5 rounded-full border border-border" />
                )}
                {f.status === "uploading" && (
                  <Loader2 size={14} className="animate-spin text-primary" />
                )}
                {f.status === "success" && (
                  <CheckCircle size={14} className="text-success" />
                )}
                {f.status === "error" && (
                  <AlertCircle size={14} className="text-error" />
                )}
                <FileText size={12} />
                <span className="truncate flex-1">{f.name}</span>
                {f.error && (
                  <span className="text-error shrink-0">{f.error}</span>
                )}
              </div>
            ))}
            {!isUploading && files.some((f) => f.status === "error") && (
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  fileInputRef.current?.click();
                }}
                className="text-xs text-primary hover:underline"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      {/* Upload history */}
      {recentEntries && recentEntries.length > 0 && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-text-secondary hover:bg-primary-light transition-colors"
          >
            <span>Recent uploads ({recentEntries.length})</span>
            {showHistory ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
          {showHistory && (
            <div className="px-4 pb-3 space-y-1.5">
              {recentEntries.map((entry) => (
                <div
                  key={entry._id}
                  className="flex items-center gap-2 text-xs text-text-secondary"
                >
                  {statusIcon[
                    entry.processingStatus as keyof typeof statusIcon
                  ] ?? <FileText size={14} />}
                  <FileText size={12} />
                  <span className="truncate flex-1">{entry.fileName}</span>
                  <span className="shrink-0 text-text-disabled">
                    {statusLabel[entry.processingStatus] ??
                      entry.processingStatus}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!targetChildId && childList.length > 1 && files.length === 0 && (
        <div className="border-t border-border px-4 py-2">
          <p className="text-xs text-text-disabled">
            Select a specific child above to upload their PDF.
          </p>
        </div>
      )}
    </div>
  );
}
