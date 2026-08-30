import { useMemo } from "react";
import { useApplication } from "@/context/ApplicationContext";
import { computeCompletion } from "@/lib/application/completion";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  requiredDocsCount?: number;
  uploadedDocsCount?: number;
  className?: string;
}

/**
 * Step-by-step status list for the application, shown on Review & Submit and
 * on the submitted-confirmation modal. Status is conveyed with an icon, a
 * word ("Complete" / "Partial") and a percentage — never colour alone.
 */
export function CompletionStepStatus({
  requiredDocsCount = 0,
  uploadedDocsCount = 0,
  className,
}: Props) {
  const { data, liveParent, liveStudents } = useApplication();
  const result = useMemo(
    () => computeCompletion({ data, liveParent, liveStudents, requiredDocsCount, uploadedDocsCount }),
    [data, liveParent, liveStudents, requiredDocsCount, uploadedDocsCount]
  );

  return (
    <ul className={cn("space-y-1.5", className)}>
      {result.sections.map((s) => {
        const done = s.ratio >= 1;
        return (
          <li key={s.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
              ) : (
                <CircleDashed className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              )}
              <span className={done ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {done ? "Complete" : `Partial · ${Math.round(s.ratio * 100)}%`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
