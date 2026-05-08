import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Users, RefreshCw } from "lucide-react";

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
  const [amounts, setAmounts] = useState<Record<string, string>>({});
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

  const updateStudent = async (
    studentId: string,
    payload: { status: string; allocated_amount?: number | null; ai_decision_reason?: string },
  ) => {
    setBusy(studentId);
    const { error } = await supabase
      .from("student_beneficiaries")
      .update({
        ...payload,
        ...(payload.status === "approved"
          ? { allocation_date: new Date().toISOString() }
          : {}),
      })
      .eq("id", studentId);
    setBusy(null);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Updated", description: `Student marked ${payload.status}.` });
    load();
  };

  const approve = (s: StudentRow) => {
    const amt = Number(amounts[s.id] ?? "35000");
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: "Invalid amount", description: "Enter a positive KES amount.", variant: "destructive" });
      return;
    }
    updateStudent(s.id, {
      status: "approved",
      allocated_amount: amt,
      ai_decision_reason: `Manually approved by commissioner. KES ${amt.toLocaleString()} allocated.`,
    });
  };

  const reject = (s: StudentRow) =>
    updateStudent(s.id, {
      status: "rejected",
      allocated_amount: null,
      ai_decision_reason: "Manually rejected by commissioner.",
    });

  const releaseStudent = async (s: StudentRow) => {
    setBusy(s.id);
    const { error } = await supabase
      .from("student_beneficiaries")
      .update({ released_to_treasury: true })
      .eq("id", s.id);
    setBusy(null);
    if (error) {
      toast({ title: "Release failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Released", description: "Student record sent to Treasury." });
    load();
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "approved":
        return <Badge className="bg-green-100 text-green-700">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "disbursed":
        return <Badge className="bg-blue-100 text-blue-700">Disbursed</Badge>;
      default:
        return <Badge variant="secondary">{s}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Per-Student Review
            </CardTitle>
            <CardDescription>
              Approve, reject, or release individual students within each multi-student application.
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
            {parents.map((p) => (
              <div key={p.id} className="border rounded-lg p-4 bg-card">
                <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{p.tracking_number}</p>
                    <p className="font-medium">{p.parent_name_masked}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.parent_ward || p.parent_county} · {p.total_students} student(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.poverty_tier && <Badge variant="outline">{p.poverty_tier}</Badge>}
                    {statusBadge(p.status)}
                    {p.released_to_treasury && (
                      <Badge className="bg-amber-100 text-amber-800">Released</Badge>
                    )}
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Institution</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount (KES)</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.students.map((s) => {
                      const isPending = ["received", "review", "verification"].includes(s.status);
                      const isApproved = s.status === "approved";
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm">{s.student_name_masked}</TableCell>
                          <TableCell className="capitalize text-sm">{s.student_type}</TableCell>
                          <TableCell className="text-sm">{s.institution_name}</TableCell>
                          <TableCell>{statusBadge(s.status)}</TableCell>
                          <TableCell>
                            {isPending ? (
                              <Input
                                type="number"
                                min={1000}
                                placeholder="35000"
                                value={amounts[s.id] ?? ""}
                                onChange={(e) =>
                                  setAmounts((m) => ({ ...m, [s.id]: e.target.value }))
                                }
                                className="h-8 w-28"
                              />
                            ) : (
                              <span className="text-sm">
                                {s.allocated_amount
                                  ? `KES ${Number(s.allocated_amount).toLocaleString()}`
                                  : "—"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {isPending && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => approve(s)}
                                    disabled={busy === s.id}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => reject(s)}
                                    disabled={busy === s.id}
                                  >
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              )}
                              {isApproved && !s.released_to_treasury && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => releaseStudent(s)}
                                  disabled={busy === s.id}
                                >
                                  Release
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
