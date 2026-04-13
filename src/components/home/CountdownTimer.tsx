import { useCountdown } from "@/hooks/useCountdown";
import { Clock, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface CountdownTimerProps {
  deadline: string;
}

export function CountdownTimer({ deadline }: CountdownTimerProps) {
  const { days, hours, minutes, seconds, isExpired } = useCountdown(deadline);
  const { t } = useI18n();

  if (isExpired) {
    return (
      <div className="flex items-center gap-2 p-3 bg-destructive/20 rounded-xl border border-destructive/30">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <span className="font-semibold text-destructive">{t("timer.closed")}</span>
      </div>
    );
  }

  const isUrgent = days <= 3;

  return (
    <div className={`p-4 rounded-xl border-2 ${isUrgent ? 'bg-destructive/10 border-destructive/30' : 'bg-primary/10 border-primary/30'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Clock className={`h-4 w-4 ${isUrgent ? 'text-destructive' : 'text-primary'}`} />
        <span className={`text-xs font-medium uppercase tracking-wide ${isUrgent ? 'text-destructive' : 'text-primary'}`}>
          {isUrgent ? t("timer.deadline_approaching") : t("timer.time_remaining")}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-background/80 rounded-lg p-2 shadow-sm">
          <div className={`text-2xl font-bold ${isUrgent ? 'text-destructive' : 'text-primary'}`}>
            {String(days).padStart(2, '0')}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("timer.days")}</div>
        </div>
        <div className="bg-background/80 rounded-lg p-2 shadow-sm">
          <div className={`text-2xl font-bold ${isUrgent ? 'text-destructive' : 'text-primary'}`}>
            {String(hours).padStart(2, '0')}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("timer.hours")}</div>
        </div>
        <div className="bg-background/80 rounded-lg p-2 shadow-sm">
          <div className={`text-2xl font-bold ${isUrgent ? 'text-destructive' : 'text-primary'}`}>
            {String(minutes).padStart(2, '0')}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("timer.mins")}</div>
        </div>
        <div className="bg-background/80 rounded-lg p-2 shadow-sm">
          <div className={`text-2xl font-bold animate-pulse ${isUrgent ? 'text-destructive' : 'text-primary'}`}>
            {String(seconds).padStart(2, '0')}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("timer.secs")}</div>
        </div>
      </div>
    </div>
  );
}
