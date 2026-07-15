// One unified action panel used by every dashboard. Buttons come from the
// workflow engine; role determines which actions are available.
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle2, XCircle, Undo2, Send, Banknote, Printer } from "lucide-react";
import type { Household } from "@/lib/household/types";
import type { DashboardRole } from "@/lib/household/statusEngine";
import { availableActions, type HouseholdAction } from "@/lib/household/workflowEngine";

interface Props {
  household: Household;
  role: DashboardRole;
  onAction: (action: HouseholdAction, household: Household) => void;
  busy?: HouseholdAction | null;
}

const meta: Record<HouseholdAction, { label: string; Icon: typeof Eye; variant?: "default" | "outline" | "destructive" | "secondary" }> = {
  view: { label: "View Household", Icon: Eye, variant: "outline" },
  approve: { label: "Approve", Icon: CheckCircle2, variant: "default" },
  reject: { label: "Reject", Icon: XCircle, variant: "destructive" },
  return_for_correction: { label: "Return for Correction", Icon: Undo2, variant: "secondary" },
  release_to_treasury: { label: "Release to Treasury", Icon: Send, variant: "default" },
  allocate: { label: "Allocate", Icon: Banknote, variant: "default" },
  disburse: { label: "Disburse", Icon: Banknote, variant: "default" },
  print_summary: { label: "Print Summary", Icon: Printer, variant: "outline" },
};

export function HouseholdActionPanel({ household, role, onAction, busy }: Props) {
  const actions = availableActions(role, household);
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(a => {
        const { label, Icon, variant } = meta[a];
        return (
          <Button
            key={a}
            size="sm"
            variant={variant}
            onClick={() => onAction(a, household)}
            disabled={busy === a}
          >
            <Icon className="h-3.5 w-3.5 mr-1.5" />
            {label}
          </Button>
        );
      })}
    </div>
  );
}
