import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useApplication } from "@/context/ApplicationContext";
import { computeCompletion } from "@/lib/application/completion";
import { LOGO_URL } from "@/lib/brandLogo";

interface Props {
  requiredDocsCount?: number;
  uploadedDocsCount?: number;
  className?: string;
}

/**
 * Kenyan-flag themed completion meter.
 * The track carries the flag's black → white → red → white → green
 * horizontal stripes; the fill sweeps Kenya green into Kenya red, and the
 * travelling indicator is a badge holding the Bursary-KE logo.
 * All colours come from semantic tokens (kenya / primary / accent).
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
        className="relative h-3 w-full rounded-full overflow-visible border border-border"
        style={{
          backgroundImage:
            "linear-gradient(180deg, hsl(var(--kenya-black)) 0%, hsl(var(--kenya-black)) 28%, hsl(var(--kenya-white)) 28%, hsl(var(--kenya-white)) 38%, hsl(var(--kenya-red)) 38%, hsl(var(--kenya-red)) 62%, hsl(var(--kenya-white)) 62%, hsl(var(--kenya-white)) 72%, hsl(var(--kenya-green)) 72%, hsl(var(--kenya-green)) 100%)",
        }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Application completeness"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            backgroundImage:
              "linear-gradient(90deg, hsl(var(--kenya-green)) 0%, hsl(var(--kenya-green) / 0.9) 55%, hsl(var(--kenya-red)) 100%)",
          }}
        />
        {/* Travelling Bursary-KE logo badge */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ease-out"
          style={{ left: `${Math.min(Math.max(pct, 4), 96)}%` }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-kenya-green bg-background shadow-kenya">
            <img
              src={LOGO_URL}
              alt="Bursary-KE logo"
              className="h-6 w-6 rounded-full object-contain"
            />
          </div>
          {/* Kenyan flag tip under the badge */}
          <div className="mx-auto mt-0.5 h-1.5 w-6 rounded-full overflow-hidden flex">
            <span className="flex-1 bg-kenya-black" />
            <span className="flex-1 bg-kenya-red" />
            <span className="flex-1 bg-kenya-green" />
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
