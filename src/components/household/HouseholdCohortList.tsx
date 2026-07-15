// Renders "Secondary Students" and "Higher Education Students" lists.
// Automatically hides any cohort with zero members — no manual gating.
import type { Household, HouseholdCohort } from "@/lib/household/types";
import { cohortLabel } from "@/lib/household/types";
import { GraduationCap, School } from "lucide-react";

interface Props { household: Household; compact?: boolean; }

export function HouseholdCohortList({ household, compact }: Props) {
  const groups: Record<HouseholdCohort, typeof household.students> = {
    secondary: household.students.filter(s => s.cohort === "secondary"),
    higher_ed: household.students.filter(s => s.cohort === "higher_ed"),
  };
  const cohorts: HouseholdCohort[] = ["secondary", "higher_ed"];

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {cohorts.map(c => {
        const list = groups[c];
        if (list.length === 0) return null;
        return (
          <div key={c}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
              {c === "secondary" ? <School className="h-3.5 w-3.5" /> : <GraduationCap className="h-3.5 w-3.5" />}
              {cohortLabel(c)}
            </p>
            <ul className={compact ? "text-sm space-y-0.5" : "text-sm space-y-1"}>
              {list.map(s => (
                <li key={s.id} className="flex items-baseline gap-2">
                  <span className="text-foreground">• {s.name_masked}</span>
                  {s.institution_name && (
                    <span className="text-muted-foreground">— {s.institution_name}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
