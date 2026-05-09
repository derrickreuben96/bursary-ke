import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, RefreshCw, Send, Sparkles, ShieldCheck } from "lucide-react";

/**
 * Read-only AI allocation review panel.
 *
 * Governance contract: the commissioner DOES NOT score, allocate, approve or
 * reject individual students. The AI Allocation Engine performs all scoring and
 * fund allocation. The commissioner's only authoritative action here is to
 * RELEASE an AI-finalised parent batch to County Treasury for disbursement.
 */
interface StudentRow {
  id: string;
  student_name_masked: string;
  student_type: string;
  institution_name: string;
  class_form: string | null;
  year_of_study: string | null;
  status: string;
  allocated_amount: number | null;
  released_to_treasury: boolean;
  ai_decision_reason: string | null;
}

interface ParentRow {
  id: string;
  tracking_number: string;
  status: string;
  current_stage: string;
  parent_name_masked: string;
  parent_county: string;
  parent_ward: string | null;
  poverty_tier: string | null;
  total_students: number;
  released_to_treasury: boolean;
  students: StudentRow[];
}

export function StudentBeneficiariesPanel({
  assignedWard,
  assignedCounty,
}: {
  assignedWard: string | null;
  assignedCounty: string | null;
}) {
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_parent_applications_for_commissioner");
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    let rows = ((data || []) as unknown as ParentRow[]).map((r) => ({
      ...r,
      students: (Array.isArray(r.students) ? r.students : []) as StudentRow[],
    }));
    if (assignedWard) rows = rows.filter((r) => r.parent_ward === assignedWard);
    else if (assignedCounty) rows = rows.filter((r) => r.parent_county === assignedCounty);
    setParents(rows);
    setLoading(false);
  };

  useEffect(() => {
    if (assignedWard || assignedCounty) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedWard, assignedCounty]);

  /** Release an entire household batch (all AI-approved students under one parent) to Treasury. */
  const releaseHousehold = async (p: ParentRow) => {
    const approvedStudentIds = p.students
      .filter((s) => s.status === "approved" && !s.released_to_treasury)
      .map((s) => s.id);
    if (approvedStudentIds.length === 0) {
      toast({
        title: "Nothing to release",
        description: "AI has not yet approved any student in this household.",
        variant: "destructive",
      });
      return;
    }
    setBusy(p.id);
    const { error: stuErr } = await supabase
      .from("student_beneficiaries")
      .update({ released_to_treasury: true })
      .in("id", approvedStudentIds);
    if (stuErr) {
      setBusy(null);
      toast({ title: "Release failed", description: stuErr.message, variant: "destructive" });
      return;
    }
    // Mirror at the parent record so Treasury sees the household
    await supabase
      .from("parent_applications")
      .update({ released_to_treasury: true })
      .eq("id", p.id);
    setBusy(null);
    toast({
      title: "Released to Treasury",
      description: `${approvedStudentIds.length} student record(s) sent to Treasury.`,
    });
    load();
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "approved":
        return <Badge className="bg-green-100 text-green-700">AI Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">AI Rejected</Badge>;
      case "disbursed":
        return <Badge className="bg-blue-100 text-blue-700">Disbursed</Badge>;
      default:
        return <Badge variant="secondary">Pending AI</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Household AI Allocation Review
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5 mt-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Read-only oversight. The AI Allocation Engine determines amounts and approvals.
              Your only action is to release AI-approved households to Treasury.
            </CardDescription>
          </div>
          <Button variant="outline" size="icon" onClick={load}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : parents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No parent applications in your jurisdiction.
          </div>
        ) : (
          <div className="space-y-6">
            {parents.map((p) => {
              const aiApprovedReleasable = p.students.filter(
                (s) => s.status === "approved" && !s.released_to_treasury,
              ).length;
              const totalAllocated = p.students.reduce(
                (sum, s) => sum + Number(s.allocated_amount || 0),
                0,
              );
              return (
                <div key={p.id} className="border rounded-lg p-4 bg-card">
                  <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{p.tracking_number}</p>
                      <p className="font-medium">{p.parent_name_masked}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.parent_ward || p.parent_county} · {p.total_students} student(s)
                        {totalAllocated > 0 && (
                          <> · AI total: KES {totalAllocated.toLocaleString()}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.poverty_tier && <Badge variant="outline">{p.poverty_tier}</Badge>}
                      {statusBadge(p.status)}
                      {p.released_to_treasury && (
                        <Badge className="bg-amber-100 text-amber-800">Released</Badge>
                      )}
                      <Button
                        size="sm"
                        onClick={() => releaseHousehold(p)}
                        disabled={busy === p.id || aiApprovedReleasable === 0}
                      >
                        {busy === p.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3 mr-1" />
                        )}
                        Release {aiApprovedReleasable > 0 && `(${aiApprovedReleasable})`}
                      </Button>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Institution</TableHead>
                        <TableHead>AI Status</TableHead>
                        <TableHead>AI Amount</TableHead>
                        <TableHead className="min-w-[260px]">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> AI Rationale
                          </span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.students.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm">{s.student_name_masked}</TableCell>
                          <TableCell className="capitalize text-sm">{s.student_type}</TableCell>
                          <TableCell className="text-sm">{s.institution_name}</TableCell>
                          <TableCell>{statusBadge(s.status)}</TableCell>
                          <TableCell className="text-sm">
                            {s.allocated_amount
                              ? `KES ${Number(s.allocated_amount).toLocaleString()}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-pre-line">
                            {s.ai_decision_reason || "Awaiting AI processing"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
