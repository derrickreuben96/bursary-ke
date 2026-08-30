import { useMemo } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApplication } from "@/context/ApplicationContext";
import { computeCompletion } from "@/lib/application/completion";

interface Props {
  requiredDocsCount?: number;
  uploadedDocsCount?: number;
  className?: string;
}

/**
 * Kenyan-themed completion meter.
 * The travelling indicator is a book (education) sitting in a green → red
 * gradient track that mirrors the national palette used across the app.
 * All colours come from semantic tokens (primary / accent / foreground).
 */
export function ApplicationProgressBar({
  requiredDocsCount = 0,
  uploadedDocsCount = 0,
  className,
}: Props) {
  const { data, liveParent, liveStudents } = useApplication();

  const result = useMemo(
    () => computeCompletion({ data, liveParent, liveStudents, requiredDocsCount, uploadedDocsCount }),
    [data, liveParent, liveStudents, requiredDocsCount, uploadedDocsCount]
  );

  const pct = result.percent;

  return (
    <div className={cn("w-full mb-6", className)} aria-live="polite">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-foreground">
          Application completeness
        </span>
        <span className="text-xs font-semibold text-primary tabular-nums">{pct}%</span>
      </div>

      <div
        className="relative h-3 w-full rounded-full bg-muted overflow-visible"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Application completeness"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-primary to-accent transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
        {/* Travelling book indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ease-out"
          style={{ left: `${Math.min(Math.max(pct, 3), 97)}%` }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-background shadow-md">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {result.sections.map((s) => (
          <span
            key={s.key}
            className={cn(
              "text-[11px]",
              s.ratio >= 1 ? "text-primary font-medium" : "text-muted-foreground"
            )}
          >
            {s.ratio >= 1 ? "✓ " : ""}
            {s.label} {Math.round(s.ratio * 100)}%
          </span>
        ))}
      </div>

      {result.nextSection && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Next up: {result.nextSection.label}
        </p>
      )}
    </div>
  );
}
