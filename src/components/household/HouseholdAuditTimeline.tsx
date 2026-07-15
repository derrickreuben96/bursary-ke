import type { AuditEntry } from "@/lib/household/auditEngine";

const toneClass: Record<AuditEntry["tone"], string> = {
  neutral: "bg-muted-foreground",
  info: "bg-blue-500",
  success: "bg-green-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

export function HouseholdAuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No timeline entries yet.</p>;
  return (
    <ol className="relative border-l border-border pl-4 space-y-3">
      {entries.map(e => (
        <li key={e.key} className="relative">
          <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${toneClass[e.tone]}`} />
          <p className="text-sm font-medium">{e.action}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(e.at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
            {e.actor ? ` · ${e.actor}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
