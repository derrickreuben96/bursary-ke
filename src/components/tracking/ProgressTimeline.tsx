import { CheckCircle2, Clock, Circle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatters";
import type { TrackingStage } from "@/lib/mockData";

interface ProgressTimelineProps {
  stages: TrackingStage[];
  currentStage: number;
}

export function ProgressTimeline({ stages, currentStage }: ProgressTimelineProps) {
  const getStageIcon = (status: TrackingStage["status"], index: number) => {
    if (status === "completed") {
      return <CheckCircle2 className="h-6 w-6 text-primary" />;
    }
    if (status === "current") {
      return (
        <div className="relative">
          <Clock className="h-6 w-6 text-accent" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-accent animate-pulse" />
        </div>
      );
    }
    // Check if it's a rejection stage
    if (stages[index]?.name.toLowerCase().includes("reject")) {
      return <XCircle className="h-6 w-6 text-destructive" />;
    }
    return <Circle className="h-6 w-6 text-muted-foreground/40" />;
  };

  return (
    <div className="relative">
      {stages.map((stage, index) => (
        <div key={index} className="relative flex gap-4 pb-8 last:pb-0">
          {/* Vertical line */}
          {index < stages.length - 1 && (
            <div
              className={cn(
                "absolute left-3 top-8 w-0.5 h-[calc(100%-32px)]",
                stage.status === "completed" ? "bg-primary" : "bg-muted-foreground/20"
              )}
            />
          )}

          {/* Icon */}
          <div className="relative z-10 flex h-6 w-6 items-center justify-center bg-background">
            {getStageIcon(stage.status, index)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <h3
                className={cn(
                  "font-semibold",
                  stage.status === "completed" && "text-primary",
                  stage.status === "current" && "text-accent",
                  stage.status === "pending" && "text-muted-foreground"
                )}
              >
                {stage.name}
              </h3>
              {stage.date && (
                <span className="text-sm text-muted-foreground">
                  {formatDate(stage.date)}
                </span>
              )}
            </div>
            <p
              className={cn(
                "text-sm mt-1",
                stage.status === "pending"
                  ? "text-muted-foreground/60"
                  : "text-muted-foreground"
              )}
            >
              {stage.message}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
