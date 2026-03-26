import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Star, History } from "lucide-react";

interface Application {
  id: string;
  tracking_number: string;
  student_type: string;
  status: string;
  poverty_tier: string;
  ai_decision_reason: string | null;
  allocated_amount: number | null;
  parent_county: string;
  parent_ward: string | null;
  created_at: string;
  is_duplicate: boolean;
  student_name_masked: string;
  parent_name_masked: string;
  poverty_score: number | null;
  household_income: number | null;
  household_dependents: number | null;
  released_to_treasury: boolean;
}

interface FairnessInfo {
  applicationId: string;
  isFairnessPriority: boolean;
  historicalStatus: string;
  fraudRiskLevel: string;
  fairnessPriorityScore: number;
}

interface StatusHistoryEntry {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_at: string;
}

interface Props {
  apps: Application[];
  fairnessMap: Map<string, FairnessInfo>;
  statusHistory: Record<string, StatusHistoryEntry[]>;
  showAmount?: boolean;
}

function getStatusBadge(status: string, isDuplicate: boolean) {
  if (isDuplicate) return <Badge variant="outline" className="bg-muted text-muted-foreground">Duplicate</Badge>;
  switch (status) {
    case "approved": return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Approved</Badge>;
    case "rejected": return <Badge variant="destructive">Rejected</Badge>;
    case "received": case "review": case "verification":
      return <Badge variant="secondary">Pending</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

export function CommissionerAppTable({ apps, fairnessMap, statusHistory, showAmount = false }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tracking #</TableHead>
          <TableHead>Student</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Ward</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Fairness</TableHead>
          <TableHead>Fraud Risk</TableHead>
          {showAmount && <TableHead>Amount</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead>AI Reason</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {apps.map((app) => {
          const f = fairnessMap.get(app.id);
          return (
            <React.Fragment key={app.id}>
              <TableRow>
                <TableCell className="font-mono text-xs">{app.tracking_number}</TableCell>
                <TableCell className="text-sm">{app.student_name_masked}</TableCell>
                <TableCell className="capitalize text-sm">{app.student_type}</TableCell>
                <TableCell className="text-sm">{app.parent_ward || app.parent_county}</TableCell>
                <TableCell><Badge variant="outline">{app.poverty_tier}</Badge></TableCell>
                <TableCell>
                  {f?.isFairnessPriority ? (
                    <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                      <Star className="h-3 w-3 mr-1" />+{f.fairnessPriorityScore}
                    </Badge>
                  ) : f?.historicalStatus === "returning_funded" ? (
                    <Badge variant="outline" className="text-amber-600"><History className="h-3 w-3 mr-1" />Returning</Badge>
                  ) : (
                    <Badge variant="secondary">New</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={f?.fraudRiskLevel === "high" ? "destructive" : f?.fraudRiskLevel === "medium" ? "secondary" : "outline"}>
                    {f?.fraudRiskLevel || "low"}
                  </Badge>
                </TableCell>
                {showAmount && (
                  <TableCell className="font-medium">KES {(app.allocated_amount || 0).toLocaleString()}</TableCell>
                )}
                <TableCell>{getStatusBadge(app.status, app.is_duplicate)}</TableCell>
                <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                  {app.ai_decision_reason || "—"}
                </TableCell>
              </TableRow>
              {statusHistory[app.id]?.length > 0 && (
                <TableRow>
                  <TableCell colSpan={showAmount ? 10 : 9} className="py-1 px-6">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-muted-foreground">Status History</p>
                      {statusHistory[app.id].map((entry) => (
                        <p key={entry.id} className="text-xs text-muted-foreground">
                          {entry.from_status ?? "submitted"} → {entry.to_status}{" "}
                          <span className="opacity-60">
                            {new Date(entry.changed_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </p>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
