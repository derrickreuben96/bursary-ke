// Officer-facing AI recommendation card. Explainable, auditable, overridable.
// The recommendation is ADVISORY — final authority stays with the officer.
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ShieldCheck, Edit3, Info } from "lucide-react";
import type { HouseholdRecommendation, StudentRecommendation } from "@/lib/ai/decisionEngine";
import { OverrideDialog } from "./OverrideDialog";

interface Props {
  recommendation: HouseholdRecommendation;
  role: "commissioner" | "treasury" | "admin";
  officerName?: string;
  onOverride?: (override: {
    student_id: string;
    original: number;
    new_amount: number;
    justification: string;
    officer: string;
    at: string;
  }) => Promise<void> | void;
}

const KES = (n: number) => `KES ${n.toLocaleString()}`;

function ConfidenceBadge({ c }: { c: StudentRecommendation["confidence"] }) {
  const map = {
    high: "bg-green-500/15 text-green-700 border-green-500/30",
    medium: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    low: "bg-red-500/15 text-red-700 border-red-500/30",
  } as const;
  return (
    <Badge variant="outline" className={map[c]}>
      {c} confidence
    </Badge>
  );
}

export function AIRecommendationCard({ recommendation, role, officerName, onOverride }: Props) {
  const [overriding, setOverriding] = useState<StudentRecommendation | null>(null);
  const canOverride = role !== "admin";

  return (
    <Card className="p-5 space-y-4 border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold text-lg">AI Recommendation (Advisory)</div>
            <div className="text-xs text-muted-foreground">
              Profile v{recommendation.policy_version} · Hash{" "}
              <span className="font-mono">{recommendation.input_hash}</span> ·{" "}
              {new Date(recommendation.generated_at).toLocaleString()}
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          Household score {recommendation.household_needs_score}/100
        </Badge>
      </div>

      <div className="text-xs flex items-start gap-2 text-muted-foreground border-l-2 border-primary/40 pl-3">
        <Info className="h-3.5 w-3.5 mt-0.5" />
        <p>
          The AI is a decision-support engine. Every recommendation is explainable and
          reproducible. Authorized officers must confirm or override with a mandatory
          justification — the AI never allocates on its own.
        </p>
      </div>

      <div className="space-y-3">
        {recommendation.per_student.map((s) => (
          <div key={s.student_id} className="rounded-md border p-3 bg-card">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="font-medium">{s.student_name_masked}</div>
                <div className="text-xs text-muted-foreground">
                  Rank #{s.priority_rank} · Score {s.needs_score}/100
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">
                  {s.eligible ? KES(s.recommended_allocation) : "Ineligible"}
                </div>
                <ConfidenceBadge c={s.confidence} />
              </div>
            </div>

            {s.eligible ? (
              <ul className="space-y-0.5 text-sm">
                {s.reasons.map((r, i) => (
                  <li key={i} className="flex justify-between">
                    <span>✓ {r.message}</span>
                    <span
                      className={`font-mono text-xs ${
                        r.weight < 0 ? "text-red-600" : "text-muted-foreground"
                      }`}
                    >
                      {r.weight > 0 ? "+" : ""}
                      {r.weight}
                    </span>
                  </li>
                ))}
                {s.history_adjustment > 0 && (
                  <li className="text-xs text-primary flex items-center gap-1 mt-1">
                    <ShieldCheck className="h-3 w-3" /> Funding-history bonus applied ·
                    capped at {s.history_adjustment}
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {s.ineligibility_reason}
              </p>
            )}

            {canOverride && s.eligible && (
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setOverriding(s)}>
                  <Edit3 className="h-3.5 w-3.5 mr-1" /> Override
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-right text-sm font-semibold">
        Household total recommended: {KES(recommendation.household_recommended_total)}
      </div>

      {overriding && (
        <OverrideDialog
          open
          student={overriding}
          officerName={officerName ?? "Unknown officer"}
          onClose={() => setOverriding(null)}
          onSubmit={async (payload) => {
            await onOverride?.(payload);
            setOverriding(null);
          }}
        />
      )}
    </Card>
  );
}
