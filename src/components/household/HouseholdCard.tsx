// The canonical household summary card. Used by every dashboard.
// Renders header, metrics, cohort sub-lists and (when expanded) the full detail panel.
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import type { Household } from "@/lib/household/types";
import type { DashboardRole } from "@/lib/household/statusEngine";
import { displayStatus, recommendedAllocation } from "@/lib/household/statusEngine";
import { HouseholdCohortList } from "./HouseholdCohortList";
import { HouseholdAuditTimeline } from "./HouseholdAuditTimeline";
import { HouseholdActionPanel } from "./HouseholdActionPanel";
import { buildTimeline, type StatusHistoryRow } from "@/lib/household/auditEngine";
import type { HouseholdAction } from "@/lib/household/workflowEngine";

interface Props {
  household: Household;
  role: DashboardRole;
  expanded: boolean;
  onToggle: (id: string) => void;
  history?: StatusHistoryRow[];
  onAction: (action: HouseholdAction, h: Household) => void;
  busyAction?: HouseholdAction | null;
}

const toneClass = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
} as const;

function HouseholdCardImpl({ household, role, expanded, onToggle, history = [], onAction, busyAction }: Props) {
  const secondary = household.students.filter(s => s.cohort === "secondary").length;
  const higherEd = household.students.filter(s => s.cohort === "higher_ed").length;
  const total = household.students.length;
  const status = displayStatus(household, role);
  const recAmount = recommendedAllocation(household);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            onClick={() => onToggle(household.id)}
            className="flex items-start gap-2 text-left group"
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground" />}
            <div>
              <p className="font-mono text-xs text-muted-foreground">{household.tracking_number}</p>
              <p className="font-semibold group-hover:underline">{household.parent_name_masked}</p>
              <p className="text-xs text-muted-foreground">
                {household.parent_ward || household.parent_county} · Submitted{" "}
                {new Date(household.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {household.poverty_tier && role !== "commissioner" && (
              <Badge variant="outline">{household.poverty_tier}</Badge>
            )}
            <Badge className={toneClass[status.tone]}>{status.label}</Badge>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {total} Beneficiar{total === 1 ? "y" : "ies"}
          </span>
          {secondary > 0 && <span>· {secondary} Secondary</span>}
          {higherEd > 0 && <span>· {higherEd} Higher Education</span>}
          {recAmount > 0 && (
            <span>
              · {role === "commissioner" ? "Recommended Allocation" : "Allocation"}: KES {recAmount.toLocaleString()}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <HouseholdCohortList household={household} compact />
        {expanded && (
          <div className="space-y-4 pt-3 border-t">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Household Assessment</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {household.household_income != null && (
                  <div><p className="text-muted-foreground">Income</p><p className="font-medium">KES {household.household_income.toLocaleString()}</p></div>
                )}
                {household.household_dependents != null && (
                  <div><p className="text-muted-foreground">Dependents</p><p className="font-medium">{household.household_dependents}</p></div>
                )}
                {household.poverty_score != null && role !== "commissioner" && (
                  <div><p className="text-muted-foreground">Poverty Score</p><p className="font-medium">{household.poverty_score}</p></div>
                )}
                <div><p className="text-muted-foreground">Stage</p><p className="font-medium">{household.current_stage ?? "—"}</p></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Audit Timeline</p>
              <HouseholdAuditTimeline entries={buildTimeline(household, history)} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Officer Actions</p>
              <HouseholdActionPanel household={household} role={role} onAction={onAction} busy={busyAction ?? null} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const HouseholdCard = memo(HouseholdCardImpl);
