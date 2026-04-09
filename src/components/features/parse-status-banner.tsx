"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";

type ParseStatusBannerProps = {
  childName: string;
  date: string;
  status: "low_confidence" | "failed";
  pdfUrl?: string | null;
  onRetry?: () => void;
};

export function ParseStatusBanner({
  childName,
  date,
  status,
  pdfUrl,
  onRetry,
}: ParseStatusBannerProps) {
  const isLow = status === "low_confidence";

  return (
    <div
      className={`flex items-start gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${
        isLow
          ? "border-warning bg-warning-light text-warning"
          : "border-error bg-error-light text-error"
      }`}
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p>
          {isLow
            ? `We had trouble reading ${childName}'s PDF for ${date}. The data shown may be incomplete.`
            : `We couldn't process ${childName}'s PDF for ${date}.`}
        </p>
        <div className="mt-1 flex items-center gap-3">
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium underline"
            >
              View original PDF <ExternalLink size={10} />
            </a>
          )}
          {status === "failed" && onRetry && (
            <button
              onClick={onRetry}
              className="text-xs font-medium underline"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
