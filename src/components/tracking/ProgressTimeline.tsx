import { CheckCircle2, Clock, Circle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatters";
import { useI18n } from "@/lib/i18n";
import type { TrackingStage } from "@/lib/mockData";

interface ProgressTimelineProps {
  stages: TrackingStage[];
  currentStage: number;
}

export function ProgressTimeline({ stages, currentStage }: ProgressTimelineProps) {
  const { t } = useI18n();

  const stageNameMap: Record<string, string> = {
    "Application Received": "stage.received",
    "Under Review": "stage.review",
    "Verification & Screening": "stage.verification",
    "Approval Decision": "stage.approved",
    "Application Not Successful": "stage.rejected",
    "Funds Disbursed": "stage.disbursed",
  };

  const stageMsgMap: Record<string, string> = {
    "Application Received": "stage.msg.received",
    "Under Review": "stage.msg.review",
    "Verification & Screening": "stage.msg.verification",
    "Approval Decision": "stage.msg.approved",
    "Application Not Successful": "stage.msg.rejected",
    "Funds Disbursed": "stage.msg.disbursed",
  };

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
    if (stages[index]?.name.toLowerCase().includes("reject") || stages[index]?.name.toLowerCase().includes("not successful")) {
      return <XCircle className="h-6 w-6 text-destructive" />;
    }
    return <Circle className="h-6 w-6 text-muted-foreground/40" />;
  };

  const translateName = (name: string) => {
    const key = stageNameMap[name];
    return key ? t(key) : name;
  };

  const translateMessage = (stage: TrackingStage) => {
    // For messages with dynamic content (amounts, institution names), check patterns
    const msg = stage.message;
    if (msg.startsWith("Funds have been sent to ") && msg !== "Funds have been sent to your institution.") {
      const institution = msg.replace("Funds have been sent to ", "").replace(".", "");
      return `${t("stage.msg.disbursed_to")} ${institution}.`;
    }
    if (msg.startsWith("Your application has been approved! Amount:")) {
      const amount = msg.replace("Your application has been approved! Amount: ", "");
      return `${t("stage.msg.approved_amount")} ${amount}`;
    }
    const key = stageMsgMap[stage.name];
    return key ? t(key) : msg;
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
                {translateName(stage.name)}
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
              {translateMessage(stage)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
